# スコアリングJSON作成UI（React）: 実行計画（JSON作成に絞る）

## ゴール（MVP）
- UIから「ルールセットJSON（schema v1準拠）」を **新規作成** できる
- UI上で編集し、**スキーマ/参照整合性を検証** できる
- 完成したJSONを **Export（ダウンロード）** できる（保存は任意で後回し可）

---

## 対象ファイル/仕様（現状の真実）
- スキーマ: `Engine/configs/rules/schema/v1.json`
- 既存例（テンプレ元）: `Engine/configs/rules/baseball_swing_v1.json`
- 検証ロジック（参考）: `Engine/scripts/validate_rules.py`

---

## スコープ（やる / やらない）
### やる
- ルールセットの新規作成（テンプレ生成）
- 編集（フォーム中心、必要ならJSONタブ併設）
- Validate（schema + 参照 + 重複ID）
- Export（JSON）

### やらない（今回）
- RuleEngine実行によるプレビュー
- plugin/metricの実装や推論
- 権限/承認/監査ログ
- DB保存（必要なら次フェーズ）

---

## 実装方針（最小で確実）
- フロント単体で完結（MVP）
  - スキーマ検証: `ajv`（draft 2020-12対応）を利用
  - 参照検証: フロントで `validate_rules.py` 相当の軽いロジックを実装
- 編集UIは「フォーム」を基本にして、必要なら「JSONタブ」も用意（MVPでも有効）

---

## UI要件（画面/操作）
### 1) 新規作成
- `New Rule Set` ボタン
- 生成方法:
  - (推奨) `baseball_swing_v1.json` をベースに必要最小限だけ残して初期化
  - もしくは “空テンプレ” を固定で用意
- 初期入力:
  - `rule_set_id`, `sport`, `sport_version`, `metadata.title`

### 2) 編集（最低限のフォーム）
- `metadata`（title/description/authors）
- `inputs`（expected_fps, keypoints_format, camera_view, preprocess）
- `globals`（confidence_threshold, angle_units, feature_pipeline）
- `phases` CRUD（id, label, frame_range, joints_of_interest）
- `rules` CRUD（id, label, phase, category, severity, signal, conditions, score, feedback）

### 3) Validate
- ボタン押下で検証
- エラーは「一覧 + 該当箇所へのジャンプ（可能なら）」で表示

### 4) Export
- 現在のJSONを `rule_set_id` などからファイル名生成してダウンロード

---

## バリデーション実装（MVP）
### A. JSON Schema検証（AJV）
- `Engine/configs/rules/schema/v1.json` をUI側に取り込み（静的同梱）
- draft2020-12 で検証し、エラーに JSONパスを付与して表示

### B. 参照/整合性チェック（追加）
- `phases[].id` の重複禁止
- `rules[].id` の重複禁止
- 各 `rule.phase` が `phases.id` に存在すること
- 各 `rule.conditions[].id` の重複禁止（rule内）
- 各 `feedback[].condition_ids[]` が同一rule内の condition.id を参照していること
- `signal.type == frame_range_ref` のとき `ref == "phase:<id>"` かつ `<id>` が存在すること

---

## データモデル（フロントの状態管理）
- `ruleSetDraft: RuleSetV1` を単一のsource-of-truthにする
- フォームは `react-hook-form` で `ruleSetDraft` に反映
- JSONタブを作る場合は「テキスト→parse→ruleSetDraft更新」「ruleSetDraft→stringify」の同期

---

## 作業タスク分解（順序）
### Step 1: 仕様固定（決定済み）
- MVPは `schema v1` のまま（拡張なし）。
- 新規作成は「空テンプレ」から開始し、最低限の必須項目のみ事前入力する（`rule_set_id`, `sport`, `sport_version`, `metadata.title`）。

### Step 2: UI骨組み（実装内容）
- 画面遷移は1画面構成（`New / Edit / Validate / Export` を同一画面に配置）で開始する。
- `ruleSetDraft` の初期生成は「空テンプレ」生成関数として実装する（Step 1で決めた必須項目を初期値にする）。

### Step 3: 編集フォーム（優先順）
1. metadata / sport情報
2. phases CRUD
3. rules CRUD（phase選択、conditions/score/feedback）
4. inputs/globals（必要最低限）

### Step 4: Validate実装
- AJVスキーマ検証
- 参照整合性チェック
- エラー表示（JSONパス/メッセージ）

### Step 5: Export実装
- `JSON.stringify(ruleSetDraft, null, 2)` をダウンロード
- Validate成功時のみExport可にするかは任意（MVPは両方可でもよい）

---

## 受け入れ条件（Doneの定義）
- UIから新規作成→phases/rulesを追加→Validateでエラー0→ExportでJSONが出力できる
- schema違反・参照ミスがある場合、どこが悪いかUIで分かる
- ExportしたJSONが `schema/v1.json` に通る（AJV結果で確認）

---

## 次フェーズ候補（今回の外）
- plugin/metric一覧の提示（入力補助）
- 保存（サーバ/DB）とバージョニング
- RuleEngineプレビュー実行
