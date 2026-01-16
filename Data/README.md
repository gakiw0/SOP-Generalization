# SOP Data Repository

このフォルダは、SOP Engine が参照するデータ（例: `datasets/EZmocap/CASA_outputs/<data_name>/aligned/...`）を配置するための場所です。

## 期待する配置

`SOP/Data/datasets/EZmocap/CASA_outputs/bs1404/aligned/...`

## 既存データからコピー（例）

`CAS-Alignment/datasets/EZmocap/CASA_outputs/bs1404` をそのまま `SOP/Data/datasets/EZmocap/CASA_outputs/` 配下にコピーしてください。

## Engine から参照する方法

- 推奨: 環境変数 `SOP_DATA_ROOT` に `SOP/Data/datasets/EZmocap/CASA_outputs` を設定
- もしくは `--data_root` で明示指定（`SOP/Engine/scripts/run_engine.py` / `compare_parity.py`）

## （任意）git リポジトリ化

この環境からは `git init` がロックファイルの作成/置換で失敗することがあるため、手元のターミナルで以下を実行してください。

- `cd SOP/Data`
- `git init`
