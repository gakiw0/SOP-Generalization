# SOP Scoring 汎用化：UIで採点ルールを編集できるようにする実装計画（React）

## 0. 目的 / スコープ
- **目的**: ルールJSON（例: `Engine/configs/rules/baseball_swing_v1.json`）を、非エンジニアでもUIから安全に編集・検証・適用できるようにする
- **対象**: スポーツごとのルールセット（phase/conditions/score/feedback 等）をCRUD + 検証 + プレビュー
- **非対象（初期）**: ルールエンジンの数学ロジック刷新、学習モデル連携、複雑な権限ワークフロー（最低限から開始）

---

## 1. 前提（現状整理）
- ルールは **JSON** として管理され、スキーマは `Engine/configs/rules/schema/v1.json`
- 実行側は Python の RuleEngine（例: `Engine/src/rules_engine/engine.py`）
- 編集で壊れやすいポイント
  - `rule.phase` が `phases.id` を参照（整合性必須）
  - `condition.metric` が plugin の計算メトリクスと一致（不一致は実行時エラー）
  - `rule.id / condition.id` 重複、feedback の condition 参照ミス

---

## 2. 目指すUX（MVP）
- ルールセットを「フォーム」で編集（JSON直編集も併用可能）
- スキーマ/参照/メトリクス整合性を **その場でバリデーション**
- サンプルデータに対して **プレビュー実行**（Score/判定/feedback を確認）
- 変更差分の確認、保存、エクスポート（JSON）

---

## 3. システム構成案
### 3.1 Backend（推奨: Python API）
React単体ではエンジン実行やサーバ保管が難しいため、薄いAPIを追加する想定。

- **API サーバ**: FastAPI（推奨）または Flask
- **責務**
  - ルールセットCRUD（ファイル or DB）
  - JSONスキーマ検証（`schema/v1.json`）+ 参照検証（`validate_rules.py`相当）
  - pluginごとの「利用可能メトリクス一覧」を返す
  - サンプルデータで RuleEngine を実行し、プレビュー結果を返す

### 3.2 Frontend（React）
- ルール編集UI（フォーム + JSON）
- バリデーション結果（エラー位置/原因/修正ガイド）
- プレビュー結果（phaseごとのルール通過、Score、feedback）

---

## 4. データ設計（ルールセット管理）
### 4.1 ルールセットの保存先（段階導入）
- **MVP**: ルールJSONをサーバ側の保存ディレクトリに保管（バージョン付き）
- **拡張**: DB（PostgreSQL等）にメタ情報 + 本体JSON、監査ログ

### 4.2 バージョニング
- `metadata.changelog`（スキーマに存在）をUIから追記できるようにする
- 保存時に `version/date/changes` を必須化（最低限）

---

## 5. API設計（例）
### 5.1 参照系
- `GET /api/schema/v1` : スキーマJSONを返す
- `GET /api/plugins` : プラグイン一覧（baseball 等）
- `GET /api/plugins/{plugin}/metrics` : 利用可能メトリクス一覧（phase別も可）

### 5.2 ルールセットCRUD
- `GET /api/rule-sets` : ルールセット一覧（id, title, sport, version）
- `GET /api/rule-sets/{id}` : 本体取得
- `POST /api/rule-sets` : 新規作成（テンプレから）
- `PUT /api/rule-sets/{id}` : 更新
- `POST /api/rule-sets/{id}/validate` : スキーマ + 参照 + メトリクス検証
- `POST /api/rule-sets/{id}/export` : JSONダウンロード

### 5.3 プレビュー
- `POST /api/preview`
  - input: `{ ruleSet, plugin, dataName | (student, coach paths) }`
  - output: phaseごとの結果（Rules/Score/StepClassification/Feedback）

---

## 6. React実装計画（画面/コンポーネント）
### 6.1 画面構成
1. **RuleSet一覧**
   - 作成/複製/削除、検索（sport/version）
2. **RuleSet編集（メイン）**
   - 左: ナビ（Phases / Rules / Metadata / JSON）
   - 右: 編集フォーム + バリデーション結果
3. **プレビュー**
   - 対象データ選択（dataNameなど）→実行→結果表示
4. **差分表示**
   - 保存前に差分確認（JSON diff）

### 6.2 フォーム編集（推奨方式）
- `react-hook-form` + `zod`（フロントは軽い検証、最終はサーバ検証）
- 追加/削除/並び替え（phases, rules, conditions, feedback）
- ID自動生成（重複防止、slug化）

### 6.3 JSON編集の併用
- Monaco Editor 等で JSON を表示/編集
- JSON編集→フォームに反映、フォーム編集→JSONに反映（片方向でも可、MVPは「JSONタブで直編集」+「Validate」でも成立）

---

## 7. バリデーション設計（重要）
### 7.1 検証レイヤ
- **フロント**: 必須入力・型・簡易チェック（空/数値範囲）
- **サーバ**（正）:
  1) JSON schema validation（`schema/v1.json`）
  2) cross-reference validation（phase存在、feedback condition参照、id重複）
  3) plugin metrics validation（`condition.metric` が plugin 出力に存在するか）

### 7.2 エラー表示
- JSONパス（例: `rules[3].conditions[0].metric`）で特定
- UI上は該当フォーム項目へジャンプ可能にする

---

## 8. スポーツ追加に耐える設計
- pluginを増やす前提で、UIは「plugin選択→metrics候補が変わる」だけに留める
- ルールセットは `sport` と `plugin` を紐付け（明示フィールド or メタ情報）
- テンプレート生成（新スポーツの雛形）
  - phasesだけ用意、rulesは空でも作れるようにする

---

## 9. セキュリティ / 権限（最小）
- MVP: 認証なし or 社内限定
- 次段階:
  - ロール: viewer/editor/admin
  - 監査ログ: だれがいつ何を変更したか（保存時に記録）
  - 「本番適用」手前で承認フロー（将来）

---

## 10. テスト/品質
- Backend
  - schema validationのユニットテスト
  - metrics整合性チェックのテスト
  - preview実行のスモークテスト（小さなfixtureデータ）
- Frontend
  - 主要フォームの入力→validate→保存のE2E（Playwright推奨）
  - JSONタブの編集→エラー表示のスモーク

---

## 11. 進め方（マイルストーン）
### M1: 最小編集+検証（1〜2週目）
- FastAPIで `schema取得 / validate / rule-set取得・保存` を実装
- Reactで「一覧→編集（JSONタブ）→Validate→Save→Export」

### M2: フォーム編集（3〜4週目）
- phases/rules/conditions/score/feedback をフォーム化
- id生成、並び替え、参照整合性のUX改善

### M3: プレビュー（5週目〜）
- データ選択→preview実行→結果表示
- diff表示、changelog入力

### M4: 運用機能（任意）
- バージョン管理、ロール、監査ログ、承認フロー

---

## 12. 未決事項（最初に決める）
- ルールの保存先: ファイル運用かDBか（MVPはファイル推奨）
- previewデータの扱い: dataName指定（`SOP_DATA_ROOT`配下）にするか、アップロードにするか
- 既存の `Score` 集計仕様（pass/failの100/30平均）をUIでどう説明/将来変更するか
