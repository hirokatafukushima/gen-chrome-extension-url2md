# Goal Description
閲覧中のブラウザのURLを取得し、ドメインに応じて特定のカテゴリ名でMarkdown記法のリンク `[カテゴリ名](URL)` に変換してクリップボードにコピーするChrome拡張機能です。
AmazonのURLについてはトラッキングパラメータを排除し、シンプルな `dp/{商品ID}` の形式に短縮します。
さらに、Elsevierなどの学術論文ページ（`citation_author` や `citation_publication_date` などのメタデータを持つページ）では、著者数とタイトル言語（日本語/英語）に応じて自動連携された `[著者フォーマット, 出版年](URL)` 形式のリンクを生成します。

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
### popup.js
以下のロジックを実装します：
1. 現在アクティブなタブのURLとタイトルを取得。
2. `chrome.scripting.executeScript` を用いて、アクティブなタブ内でメタデータ（`citation_author`, `citation_publication_date`等）を抽出する関数を実行し、結果をポップアップ側へ返す。
3. URLのホストネームを解析して「表示名（カテゴリ）」を決定。
   - 学術論文メタデータ（`citation_author`等）が取得できた場合：
     - このルートを最優先とし、取得できた場合のみ言語・人数ごとの特殊フォーマットを適用する。
     - タイトルに日本語が含まれるかで言語（日/英）を判定。
     - 取得した著者数（1名, 2名, 3名以上）と言語に応じて以下のルールの文字を生成。
       - 英語1名: `[姓, 年]` / 英語2名: `[姓1 & 姓2, 年]` / 英語3名以上: `[姓1 et al., 年]`
       - 日本語1名: `[姓, 年]` / 日本語2名: `[姓1・姓2, 年]` / 日本語3名以上: `[姓1 他., 年]`
     - カテゴリ名をこの文字列とする。
   - 学術論文メタデータがない場合：
     - これまで通りURLドメイン（ホストネーム）に応じた処理へフォールバックする（既存機能への完全な安全性の担保）。
   - `chatgpt.com` -> ChatGPT
   - `gemini.google.com` -> Gemini
   - `grok.com` -> Grok
   - `notebooklm.google.com` -> NotebookLM
   - `claude.ai` -> Claude
   - `mail.google.com` -> Gmail
   - `amazon` -> Amazon page
   - その他 -> ページタイトル
4. Amazonドメインの場合、URLから商品ID（ASIN）を正規表現で抽出し、`https://www.amazon.co.jp/dp/{ASIN}/` の形式に短縮。
5. `[表示名](URL)` のMarkdown文字列を作成し、クリップボードにコピー（`navigator.clipboard` エラー時のフォールバック処理も含む）。
6. コピー成功後、画面に「✅ Done!」メッセージを表示。
7. 「OK」ボタン押下時に `window.close()` でポップアップを閉じる。
