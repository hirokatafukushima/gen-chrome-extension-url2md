# Goal Description
閲覧中のブラウザのURLを取得し、ドメインに応じて特定のカテゴリ名でMarkdown記法のリンク `[カテゴリ名](URL)` に変換してクリップボードにコピーするChrome拡張機能です。
AmazonのURLについてはトラッキングパラメータを排除し、シンプルな `dp/{商品ID}` の形式に短縮します。

## 構成ファイルリスト (url2mdフォルダ直下)

### manifest.json
- Chrome Extension (Manifest V3) の基本設定。
- 権限 (`permissions`): `activeTab` (現在開いているタブの情報取得のため)
- Action: アイコンクリック時に `popup.html` を表示する設定。

### popup.html
- アイコンを使用せず、シンプルなテキストで構築されたUI。
- 処理完了のメッセージ `✅ Done!` と、それを閉じるための `<button id="ok-btn">OK</button>` を配置。

### popup.css
- 無駄な装飾を省いたミニマルで分かりやすいデザイン。

### popup.js
以下のロジックを実装します：
1. 現在アクティブなタブのURLとタイトルを取得。
2. URLのホストネームを解析して「表示名（カテゴリ）」を決定。
   - `chatgpt.com` -> ChatGPT
   - `gemini.google.com` -> Gemini
   - `grok.com` -> Grok
   - `notebooklm.google.com` -> NotebookLM
   - `claude.ai` -> Claude
   - `mail.google.com` -> Gmail
   - `amazon` -> Amazon page
   - その他 -> ページタイトル
3. Amazonドメインの場合、URLから商品ID（ASIN）を正規表現で抽出し、`https://www.amazon.co.jp/dp/{ASIN}/` の形式に短縮。
4. `[表示名](URL)` のMarkdown文字列を作成し、`navigator.clipboard.writeText` でクリップボードにコピー。
5. コピー成功後、画面に「✅ Done!」メッセージを表示。
6. 「OK」ボタン押下時に `window.close()` でポップアップを閉じる。
