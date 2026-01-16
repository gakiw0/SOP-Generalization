# スコアリングJSON作成UI（React）: 実装計画（JSON作成に絞る）

## ゴール（MVP）
- UIから「ルールセットJSON（schema v1準拠）」を新規作成できる
- UI上で編集し、バリデーション（最低限）を実行できる
- 完成したJSONをExport（ダウンロード）できる

---

## 参照（現状の真実）
- スキーマ: `Engine/configs/rules/schema/v1.json`
- 既存例（テンプレ参考）: `Engine/configs/rules/baseball_swing_v1.json`
- 参照検証ロジック（参考）: `Engine/scripts/validate_rules.py`

---

## スコープ（今回やる / やらない）
### やる
- ルールセットJSONの新規作成（空テンプレ）
- 編集フォーム（最低限）
- Validate（まずは必須項目+参照整合性の一部）
- Export（JSONダウンロード）

### やらない（今回）
- RuleEngineを実行するプレビュー
- plugin/metricの自動補完（候補表示は将来）
- 認証/権限/承認/監査ログ
- DB保存（将来）

---

## 方針
- UIは `ui/`（Vite + React + TypeScript）で開発する
- `ruleSetDraft` を唯一の状態（source of truth）にして、フォーム操作で更新する
- まずは「作れること」を優先し、厳密なスキーマ検証（AJV）はStep4で入れる

---

## UI（MVP）
- 上部: `New / Validate / Export` ボタン
- 左: 入力フォーム（必須項目 + phases/rules）
- 右: JSONプレビュー（`JSON.stringify(ruleSetDraft, null, 2)`）

---

## 作業タスク分解（順序）
### Step 1: 仕様固定（決定）
- MVPは `schema v1` のまま（拡張なし）
- 新規作成は「空テンプレ」から開始し、必須項目のみ事前入力する（`rule_set_id`, `sport`, `sport_version`, `metadata.title`）

### Step 2: UI骨組み
- 1画面に `New / Edit / Validate / Export` を配置する（まずは単一画面）
- 空テンプレ生成関数を用意し、`ruleSetDraft` を初期化できるようにする

### Step 3: 編集フォーム（細分化して段階実装）
#### 3.1 ルールセット基本情報（必須）
- フィールド: `rule_set_id`, `sport`, `sport_version`, `metadata.title`
- Done: 入力内容がJSONプレビューに反映される

#### 3.2 inputs（最低限）
- フィールド: `inputs.expected_fps`, `inputs.keypoints_format`, `inputs.camera_view`, `inputs.preprocess`
- 入力形式: `preprocess` はCSVで入力し配列に変換
- Done: JSONに `inputs` が必ず存在し、配下が編集できる

#### 3.3 globals（最低限）
- フィールド: `globals.confidence_threshold`, `globals.angle_units`, `globals.feature_pipeline`
- 入力形式: `feature_pipeline` はCSVで入力し配列に変換
- Done: JSONに `globals` が必ず存在し、配下が編集できる

#### 3.4 phases（CRUD）
- できること: 追加/削除
- フィールド: `phases[].id`, `phases[].label`, `phases[].joints_of_interest`
- フィールド（区間指定）: `phases[].frame_range` または `phases[].event_window`（schemaの `oneOf`）
- `event_window` の中身: `event`, `window_ms`
- 入力形式: `joints_of_interest` はCSV（数値配列）
- Done: phaseを追加して `phases[]` に反映でき、削除もできる

#### 3.5 rules（CRUD: ベース）
- できること: 追加/削除
- フィールド: `rules[].id`, `rules[].label`, `rules[].phase`, `rules[].category`, `rules[].severity`
- UI: `rules[].phase` は `phases[].id` から選択
- Done: ruleを追加/削除でき、phaseが選択できる

#### 3.6 signal（最小）
- フィールド: `rules[].signal.type`（`frame_range_ref` / `direct` / `event_window`）
- `type=frame_range_ref`: `rules[].signal.ref`（`ref=phase:<phaseId>`）
- `type=direct`: `rules[].signal.frame_range`
- `type=event_window`: `rules[].signal.event`, `rules[].signal.window_ms`, `rules[].signal.default_phase`（任意）
- 初期値: `type=frame_range_ref`, `ref=phase:<phaseId>` を想定（自動生成は将来でも可）
- Done: signalを編集してJSONに反映できる

#### 3.7 conditions（CRUD: 最小）
- できること: conditionの追加/削除（rule内）
- フィールド（共通）: `conditions[].id`, `conditions[].type`
- フィールド（threshold/range/boolean）: `conditions[].metric`, `conditions[].op`, `conditions[].value`, `conditions[].abs_val`（任意）, `conditions[].tolerance`（任意）
- フィールド（composite）: `conditions[].logic`, `conditions[].conditions`（cond id参照の配列）
- 入力形式: `value` は「数値 or JSON文字列」を許可（最初はゆるく）
- Done: conditionを増やしてJSONに反映できる

#### 3.8 score（最小）
- フィールド: `score.mode`, `score.pass_score`, `score.max_score`（weightsはStep4以降）
- Done: score設定がJSONに反映される

#### 3.9 feedback（CRUD: 最小）
- できること: feedbackの追加/削除（rule内）
- フィールド: `feedback[].condition_ids`, `feedback[].message`, `feedback[].severity`
- 入力形式: `condition_ids` はCSV（文字列配列）
- Done: feedbackがJSONに反映される

### Step 4: Validate（厳密化）
- AJVで `schema/v1.json` による検証（draft2020-12）
- 参照整合性チェック（`validate_rules.py` 相当）
  - `phases[].id` 重複
  - `rules[].id` 重複
  - `rule.phase` が `phases.id` に存在する
  - `rule.conditions[].id` 重複（rule内）
  - `feedback.condition_ids` が条件idを参照している
  - `signal.type=frame_range_ref` の `ref=phase:<id>` が存在する
  - `signal.type=direct` の `frame_range` が `[start,end]` 形式である
  - `signal.type=event_window` の `event/window_ms` が妥当、`default_phase` がある場合は `phases.id` に存在する
  - `type=composite` の `conditions[]` が同一rule内の条件idを参照している
- Done: エラーがUIに表示され、該当箇所が分かる

### Step 5: Export
- `rule_set_id` をファイル名にしてJSONをダウンロード
- Done: ダウンロードしたJSONが期待どおりである

---

## Done（MVP完了条件）
- UIで `phases` と `rules` を作成でき、ExportでJSONが出力できる
- Step4のValidateでスキーマ/参照整合性のエラーが検出できる（最低限）
