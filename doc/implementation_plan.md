# Goal Description
閲覧中のブラウザのURLを取得し、ドメインに応じて特定のカテゴリ名でMarkdown記法のリンク `[カテゴリ名](URL)` に変換してクリップボードにコピーするChrome拡張機能です。
AmazonのURLについてはトラッキングパラメータを排除し、シンプルな `dp/{商品ID}` の形式に短縮します。
さらに、Elsevierなどの学術論文ページでは、著者数とタイトル言語（日本語/英語）に応じた `[著者フォーマット, 出版年](URL)` 形式のリンクを生成します。

## 構成ファイルリスト (url2mdフォルダ直下)

### manifest.json
- Chrome Extension (Manifest V3) の基本設定。
- 権限 (`permissions`): `activeTab`, `clipboardWrite`, `scripting` (ページ内のメタデータ抽出処理のため)
- Action: アイコンクリック時に `popup.html` を表示する設定。

### popup.html
- アイコンを使用せず、シンプルなテキストで構築されたUI。
- 処理完了のメッセージ `✅ Done!` と、それを閉じるための `<button id="ok-btn">OK</button>` を配置。

### popup.css
- 無駄な装飾を省いたミニマルで分かりやすいデザイン。

### popup.js
以下のロジックを実装します：
1. 現在アクティブなタブのURLとタイトルを取得。
2. `chrome.scripting.executeScript` を用いて、アクティブなタブ内でメタデータを抽出する関数を実行し、結果をポップアップ側へ返す。
3. メタデータ抽出は以下の3つのソースから優先的に取得する：
   - **ソース1: HighWire Press メタタグ** (`citation_author`, `citation_publication_date`, `citation_title` 等)
   - **ソース2: Dublin Core メタタグ** (`dc.creator`, `dc.date`, `dc.title`, `prism.coverDate` 等)
   - **ソース3: JSON-LD 構造化データ** (`application/ld+json` 内の `ScholarlyArticle` / `Article` 型)
4. 「表示名（カテゴリ）」の決定：
   - **学術論文メタデータが取得できた場合（最優先、既存ロジックへ進まない）：**
     - 論文タイトル (`citationTitle`) に日本語文字が含まれるかで言語（日/英）を判定。
     - 著者数と言語に応じた著者フォーマットを生成。

       #### 文献タイトルが英語の場合
       - 著者1名: `[著者の姓, 出版年](URL)`
       - 著者2名: `[第一著者の姓 & 第二著者の姓, 出版年](URL)`
       - 著者3名以上: `[第一著者の姓 et al., 出版年](URL)`

       #### 文献タイトルが日本語の場合
       - 著者1名: `[著者の姓, 出版年](URL)`
       - 著者2名: `[第一著者の姓・第二著者の姓, 出版年](URL)`
       - 著者3名以上: `[第一著者の姓 他., 出版年](URL)`

   - **学術論文メタデータがない場合（フォールバック、既存機能の安全性を担保）：**
     - `chatgpt.com` -> ChatGPT
     - `gemini.google.com` -> Gemini
     - `grok.com` -> Grok
     - `notebooklm.google.com` -> NotebookLM
     - `claude.ai` -> Claude
     - `mail.google.com` -> Gmail
     - `amazon` -> Amazon page（ASIN抽出によるURL短縮あり）
     - その他 -> ページタイトル
5. `[表示名](URL)` のMarkdown文字列を作成し、クリップボードにコピー（`navigator.clipboard` エラー時のフォールバック処理も含む）。
6. コピー成功後、画面に「✅ Done!」メッセージを表示。
7. 「OK」ボタン押下時に `window.close()` でポップアップを閉じる。
