# URL to Markdown Link Copy

## 概要
ブラウザで閲覧中のページのURLを、ワンクリックでMarkdown形式のリンク（例: `[タイトル](URL)`）に変換してクリップボードにコピーするChrome拡張機能です。

## 作成日
2026-02-26

## 主な機能
- **自動カテゴリ判定**: 指定のドメインではリンクのラベルを自動的にサービス名に設定します。
- **Amazon URL短縮**: 商品ページの複雑なトラッキングパラメータを削除し、ASINを含むシンプルなURLを生成します。
- **汎用コピー**: 上記以外のサイトでは、ページのタイトルをラベルとしてMarkdownリンクを生成します。

## 仕様

### 対応ドメインと表示名
以下のドメインでは、ページタイトルに関わらず決まった表示名でコピーされます。

| 対応ドメイン | 表示名 |
| :--- | :--- |
| `chatgpt.com` | ChatGPT |
| `gemini.google.com` | Gemini |
| `grok.com` | Grok |
| `claude.ai` | Claude |
| `notebooklm.google.com` | NotebookLM |
| `mail.google.com` | Gmail |
| `amazon.co.jp` 等 | Amazon page |

### Amazon URLの短縮ルール
Amazonドメインに関しては，URLから余分な情報が排除されるようにしています。
URL内に `dp/`, `gp/product/`, `gp/aw/d/` 等のパターンと10桁のASINが含まれる場合、以下の形式に整形されます。
- `https://www.amazon.co.jp/dp/{ASIN}/`

## 使い方
1. Chromeの拡張機能アイコンをクリックします。
2. 自動的にMarkdownリンクがクリップボードにコピーされます。
3. ポップアップに「✅ Done!」と表示されたら、OKボタンを押して閉じます。

## インストール方法（デベロッパーモード）
1. Chromeで `chrome://extensions/` を開きます。
2. 右上の「デベロッパー モード」をオンにします。
3. 「パッケージ化されていない拡張機能を読み込む」を選択し、本リポジトリのルートフォルダ（`manifest.json` があるフォルダ）を選択します。
