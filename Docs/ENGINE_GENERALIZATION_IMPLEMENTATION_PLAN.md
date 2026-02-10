# エンジン汎用化（他スポーツ対応）実装計画

## 2026-02 実装更新（Generic 1v1）
- schema v2 を追加し、metric_profile をランタイム解決の起点に変更
- schema v1 は互換運用として維持（validator/runnerで併存）
- generic_core plugin を追加し、scalar + series メトリクスを提供
- evaluator は8条件タイプ（threshold/range/boolean/event_exists/composite/trend/angle/distance）を実行可能化
- capability export は profile ベース（ui/src/generated/pluginCapabilities.json）へ更新
- v1→v2移行スクリプト: Engine/scripts/migrate_ruleset_v1_to_v2.py

---
## 目的（この計画のスコープ）
- 「野球以外のスポーツにも同じエンジン構造で適用できる」状態に近づける
- 競技ごとの違いは **rule-set（JSON）** と **plugin（メトリクス計算）** の差し替えで吸収できること

## 非目的（明示的にやらない）
- データ配置/ファイル名/入出力フォーマットの統一（例: `student_aligned_skeleton.json` 等）
- 既存の野球（`baseball_swing_v1.json` + `BaseballPlugin`）の挙動変更
- UI/DB/APIの設計・実装（別計画）

---

## 現状の阻害要因（要点）
1. **plugin選択が野球固定**（`runner.py` / `run_engine.py` のデフォルトと分岐）
2. **BaseballPluginがstep1..4前提**で、競技やphase構成を差し替えにくい
3. schemaにある汎用表現（`event_window` / `signal` / 多様なcondition）に対して、runtimeが追いついていない

---

## 目標アーキテクチャ（最小）
- `rule_set.sport` を起点に plugin を解決できる（明示指定も可能）
- engine は **phaseの切り出し** と **ruleの対象フレーム範囲** を `signal` で解決できる（少なくとも `frame_range_ref` と `direct`）
- evaluator は schemaで許している最低限の汎用オプション（`abs_val`/`tolerance` と `composite`）を解釈できる
- 既存野球ルールは「互換モード」のまま動く

---

## 実装マイルストーン

### M1: plugin選択の汎用化（最優先・影響小）
**狙い**: 競技追加時に `runner.py` を編集しなくても動かせるようにする。

**作業**
- 新規: `Engine/src/rules_engine/plugins/registry.py`
  - `PluginRegistry`（`sport -> plugin_factory` の登録/取得）
  - `register_plugin(sport: str)` デコレータ（任意）
- 変更: `Engine/src/rules_engine/runner.py`
  - `_get_plugin()` を registry 経由に変更
  - `RunnerOptions.plugin_name` を `"auto"`（または `None`）で受け、`rule_set["sport"]` から自動解決
- 変更: `Engine/scripts/run_engine.py`
  - `--plugin` のデフォルトを `"auto"` に変更（既存 `"baseball"` 指定は引き続き有効）

**受け入れ条件**
- `--plugin auto` で `rule_set.sport` に応じた plugin が選ばれる
- 既存の `--plugin baseball` は今まで通り動く

**補足**
- この段階では baseball 以外の plugin 実装は「雛形のみ」でOK（`plugins/base.py` のI/Fに従う）

---

### M2: phase切り出しの汎用化（`event_window` 導入の下準備）
**狙い**: phaseを `frame_range` 固定から脱却できる土台を作る（いきなり完全実装しない）。

**作業**
- 変更: `Engine/src/rules_engine/engine.py`
  - `_phase_frame_range(phase)` を `frame_range` と `event_window` の両方に対応できる構造に変更
  - まずは `event_window` の場合に参照する **イベント情報の受け取り口** を追加:
    - `RuleEngine.analyze(..., context={...})` に `context["events"]`（例: `{ "impact": frame_idx }`）を許容
    - phase側 `event_window.event` を `context["events"]` から解決し、`window_ms` と `expected_fps` からフレーム範囲に変換
  - イベントが無い場合の扱い（例: エラー/スキップ/デフォルトphase）を仕様化して実装

**受け入れ条件**
- `frame_range` の挙動が変わらない
- `event_window` 指定のphaseでも、`context["events"]` が与えられればフレーム範囲を解決できる

---

### M3: rule.signal のruntime実装（汎用ルール適用の中核）
**狙い**: 「phaseの枠」だけでなく「ruleごとの対象区間」を扱えるようにする（スポーツごとの区間定義に耐える）。

**作業**
- 変更: `Engine/src/rules_engine/engine.py`
  - rule評価前に `signal` を解釈して対象フレーム範囲を求める関数を追加（例: `_resolve_signal_frames(rule, phase_map, context)`）
  - 最低限サポート:
    - `signal.type = frame_range_ref`（既存JSON互換）
    - `signal.type = direct`（schema定義あり）
  - 次点サポート:
    - `signal.type = event_window`（M2の仕組みを再利用）
- `joints`（schemaの `direct.joints`）は **最初は無視**してよい（最小の汎用化のため）

**受け入れ条件**
- 野球の既存ルールは `frame_range_ref` のまま動く
- `direct.frame_range` を使うルールセットでも評価できる

---

### M4: evaluatorの汎用オプション対応（abs/tolerance + composite）
**狙い**: 競技が変わったときにルール表現で調整しやすくする。

**作業**
- 変更: `Engine/src/rules_engine/evaluator.py`
  - `threshold` / `range` で `abs_val` を適用（比較前に `abs(val)`）
  - `tolerance` を適用（例: `threshold` の境界を緩める、`range` を拡張する等。仕様を文書化して実装）
  - `composite` を実装:
    - ルール内で「基本条件」→「composite条件」の順に評価できるよう、`RuleEngine._evaluate_rule()` 側で condition 結果を参照しながら評価
    - `logic` = all/any/none を実装

**受け入れ条件**
- 既存野球ルールに影響が出ない（未使用フィールドの解釈追加のみ）
- schemaの `composite` が使える

---

## 進め方（推奨順序）
1. M1（plugin registry）→ “他競技を差し込める”入口を作る
2. M3（signal: frame_range_ref/direct）→ ルール適用の汎用性を上げる
3. M2（event_window）→ 区間決定をイベント駆動にできる
4. M4（abs/tolerance/composite）→ ルール表現力の汎用化

---

## 追加で用意すると良い最小サンプル（任意）
- `Engine/configs/rules/tennis_swing_v1.json`（仮）:
  - `sport: "tennis"` のみ差し替え、phase/ruleは極小（`direct.frame_range` で成立するもの）
- `Engine/src/rules_engine/plugins/tennis.py`（仮）:
  - 1〜2個のダミーメトリクスだけ実装して registry に登録

※ これは「汎用化の動作確認」用であり、データフォーマット統一の話はここでは扱わない。

---

## 完了判定（Definition of Done）
- 新規スポーツ（例: tennis）の rule-set + plugin を追加して、runner/engine/evaluatorの改修無しで実行できる
- 既存の野球 rule-set（`baseball_swing_v1.json`）が同じ結果を出す（少なくとも形式と主要スコアが変わらない）

