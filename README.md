# CAD Convert — DWG / DXF / JWW 一括変換 Web アプリ

ブラウザに図面ファイルをドロップするだけで、**印刷用 PDF** または **DXF** にまとめて変換する Web アプリです。
旧版（Flask 製・社内 LAN 限定）を **Laravel + React** で作り直し、インターネット上で誰でも使える構成にしました。

- 利用者はインストール・ユーザー登録不要（ブラウザだけ）
- DWG / DXF / JWW（JW_CAD）に対応、複数ファイルを一括変換・ZIP でまとめてダウンロード
- PDF は用紙（A4〜A0 / B4 / Letter）・向き・白黒/カラー・モデル空間/全レイアウトを指定可能
- 日本語テキスト（Shift-JIS の JWW 文字列を含む）を正しく出力
- アップロードされた図面と変換結果は一定時間（既定 60 分）で自動削除、IP ごとのアップロード回数制限つき
- 日本語 / English 切り替え、スマホ対応

## 構成

```
┌──────────── ブラウザ ────────────┐
│ React + TypeScript + Tailwind v4 │  resources/js/
│ (framer-motion アニメーション)   │
└───────────────┬──────────────────┘
                │ /api/batches (multipart)  → ポーリング → ダウンロード
┌───────────────▼──────────────────┐
│ Laravel 13                       │  app/
│  BatchController / ConvertDrawing│  キュー(ジョブ)で1ファイルずつ変換
│  conversions:prune (5分毎)       │  期限切れデータを削除
└───────────────┬──────────────────┘
                │ python -m cadconv IN --to pdf|dxf --out OUT   (JSON を1行返す)
┌───────────────▼──────────────────┐
│ converter/cadconv (Python)       │  ezdxf + PyMuPDF でベクター PDF
│  ├ DWG → dwg2dxf (LibreDWG) / ODA File Converter（あれば優先）
│  └ JWW → jww2jif (jwwlib, C++) → JIF(JSON) → ezdxf で DXF 組み立て
└──────────────────────────────────┘
```

| パス | 内容 |
| --- | --- |
| `app/Http/Controllers/Api/` | アップロード・状態取得・ダウンロード・削除 API |
| `app/Jobs/ConvertDrawing.php` | 変換ジョブ（キュー） |
| `app/Services/DrawingConverter.php` | Python 変換 CLI の呼び出し |
| `config/converter.php` | 保存期間・上限・レート制限などの設定 |
| `resources/js/` | React フロントエンド |
| `converter/cadconv/` | 変換エンジン本体（Python） |
| `converter/native/jww2jif/` | JWW 読み込みツールのソースとビルドスクリプト |
| `Dockerfile`, `docker/` | 本番用コンテナ（FrankenPHP + キューワーカー + スケジューラ） |
| `deploy/Caddyfile.example` | HTTPS 用リバースプロキシ（Caddy）の設定例 |

## 公開サーバーで動かす（Docker・推奨）

```bash
docker compose up -d --build
# → http://localhost:8080 （サーバー自身からのみアクセス可能）
```

- 変換ツール（LibreDWG の `dwg2dxf`、`jww2jif`）はイメージのビルド時に自動でソースからビルドされます。
- データ（SQLite・一時ファイル・APP_KEY）は `storage` ボリュームに保存されます。
- 既定ではポート 8080 を **そのマシン自身（127.0.0.1）にだけ** 公開します。
  社内 LAN の他の PC から HTTP のまま試す場合は、`docker-compose.yml` の `ports` を `"8080:8080"` に変更してください。

### HTTPS で公開する（Caddy を前に置く）

1. ドメイン（例 `cad.example.com`）の DNS A レコードをサーバーの IP アドレスに向けます。
2. サーバーのファイアウォールで 80 番・443 番ポートを開けます。
3. サーバーに Caddy を入れます：`sudo apt install -y caddy`
4. [`deploy/Caddyfile.example`](deploy/Caddyfile.example) を `/etc/caddy/Caddyfile` にコピーし、`cad.example.com` を自分のドメインに書き換えます。
5. `sudo systemctl reload caddy` — 証明書は Caddy が自動で取得・更新します。
6. `docker-compose.yml` の `APP_URL` を `https://自分のドメイン` にして `docker compose up -d` で反映します。

HTTPS にすると Chrome の「安全でないダウンロード」警告も出なくなります。
アプリは `TRUSTED_PROXIES`（既定：127.0.0.1 と Docker のネットワーク）からの `X-Forwarded-*` ヘッダーだけを信用するので、
アップロード回数制限は利用者ごとの本当の IP アドレスで数えられ、外部から IP を偽装することはできません。

### 主な設定（環境変数）

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `CONVERTER_RETENTION_MINUTES` | 60 | 図面・変換結果を保持する分数 |
| `CONVERTER_MAX_FILES` | 50 | 1 回にアップロードできるファイル数 |
| `CONVERTER_MAX_FILE_KB` | 51200 | 1 ファイルの上限（KB） |
| `CONVERTER_RATE_LIMIT` | 20 | 1 分あたり・1 IP あたりのアップロード回数 |
| `CONVERTER_TIMEOUT` | 300 | 1 ファイルの変換タイムアウト（秒） |
| `QUEUE_WORKERS` | 2 | 同時に変換するワーカー数 |
| `TRUSTED_PROXIES` | `127.0.0.1,::1,172.16.0.0/12` | 信用するリバースプロキシ（カンマ区切り、CIDR 可） |
| `APP_LISTEN` | `:8080` | コンテナ内で待ち受けるアドレス |
| `CADCONV_ODA` | – | ODA File Converter のパス（あれば DWG 変換で優先使用） |

## 開発環境（Ubuntu / macOS）

必要なもの：PHP 8.3+、Composer、Node.js 20+、Python 3.10+、g++、日本語フォント（例 `fonts-ipaexfont-gothic`）

```bash
composer install
npm install
cp .env.example .env && php artisan key:generate
touch database/database.sqlite && php artisan migrate

pip install -r converter/requirements.txt
converter/native/jww2jif/build.sh          # jww2jif をビルド（jwwlib を自動取得）
# DWG を扱う場合は LibreDWG (dwg2dxf) をインストール（Dockerfile の手順を参照）

npm run build            # または npm run dev
php artisan serve        # http://localhost:8000
php artisan queue:work   # 別ターミナルで変換ワーカーを起動
```

### テスト

```bash
php artisan test                         # Laravel API（変換処理はモック）
(cd converter && python -m pytest -q)    # 変換エンジン（JWW/DWG の通しテストを含む）
npx tsc -p . && vendor/bin/pint --test   # 型チェック・コード整形
```

## 旧版（Flask 版）からの変更点

- 社内 LAN 限定・ログインなし → **インターネット公開前提**（匿名利用、アップロード回数制限、自動削除、推測不能な UUID で結果にアクセス）
- 変換処理を Web リクエストから切り離し、**キュー（ジョブ）で非同期実行**。大きな図面でも画面が固まらず、進捗がリアルタイムに表示されます
- DXF→PDF を matplotlib から **PyMuPDF バックエンドのベクター PDF** に変更（用紙サイズ・余白を正確に指定）
- 旧版で対応した以下の処理は新エンジンにも移植済み
  - JWW：レイヤー名の伝播不具合の回避、Shift-JIS(CP932) 文字列のデコード、`Printer_Orientation = 0` のような JW_CAD 内部設定文字列の除外
  - 空の TEXT/MTEXT の除去（用紙範囲の誤算防止）
  - DWG 変換は ODA File Converter があれば優先、なければ LibreDWG
- サーバーは Linux（Docker）で動作するため、Windows 版 exe と Symantec Endpoint Protection のスキャン遅延問題の影響を受けません

## ライセンスについて

`jww2jif` は LibreCAD の jwwlib（GPL-2.0）を、DWG 変換は LibreDWG（GPL-3.0）を利用します。
いずれもビルド時に公式配布元から取得しており、本リポジトリにはソースを同梱していません。
