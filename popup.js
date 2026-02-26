document.addEventListener('DOMContentLoaded', async () => {
    const statusElement = document.getElementById('status');
    const okBtn = document.getElementById('ok-btn');

    // OKボタンが押されたらポップアップを閉じる
    okBtn.addEventListener('click', () => {
        window.close();
    });

    try {
        // 現在アクティブなタブを取得
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url) {
            statusElement.textContent = 'URLの取得に失敗しました';
            okBtn.classList.remove('hidden');
            return;
        }

        // ページ内から citation メタデータを取得する
        let citationData = null;
        if (!tab.url.startsWith("chrome://") && !tab.url.startsWith("edge://")) {
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: extractCitationMetadata
                });
                if (results && results[0] && results[0].result) {
                    citationData = results[0].result;
                }
            } catch (e) {
                console.warn("Script injection failed or restricted:", e);
            }
        }

        const markdownText = generateMarkdownLink(tab.url, tab.title, citationData);

        // クリップボードへコピー（navigator.clipboard がエラーになる環境へのフォールバック）
        try {
            await navigator.clipboard.writeText(markdownText);
        } catch (clipboardError) {
            console.warn("navigator.clipboard failed, falling back to execCommand", clipboardError);
            const textArea = document.createElement("textarea");
            textArea.value = markdownText;
            // 画面外に配置
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);

            if (!successful) {
                throw new Error("Fallback copy failed.");
            }
        }

        // 成功メッセージの表示
        statusElement.textContent = '✅ Done!';
        okBtn.classList.remove('hidden');

    } catch (error) {
        statusElement.textContent = 'エラー: ' + error.message;
        console.error(error);
        okBtn.classList.remove('hidden');
    }
});

/**
 * 現在のページのDOMから `<meta name="citation_author">` と `<meta name="citation_publication_date">` を抽出する関数
 * この関数はWebページのコンテキスト（Content Script）内で実行されるため、外部変数は参照できません。
 */
function extractCitationMetadata() {
    // 著者名の抽出
    const authorTags = document.querySelectorAll('meta[name="citation_author"], meta[name="dc.creator"]');
    const authors = [];
    authorTags.forEach(tag => {
        if (tag.content) {
            // "Smith, John" や "John Smith" など様々な書式があるが、最後尾の単語やカンマ前を「姓」として扱うため
            // ここでは一旦そのまま取得し、フォーマット時に姓名を分割する
            authors.push(tag.content.trim());
        }
    });

    // 出版年の抽出
    // citation_publication_date や citation_year など
    const dateTag = document.querySelector('meta[name="citation_publication_date"], meta[name="citation_date"], meta[name="citation_year"]');
    let year = "";
    if (dateTag && dateTag.content) {
        // "2025/02", "2025" などから年（4桁）を抽出
        const match = dateTag.content.match(/\b(19|20)\d{2}\b/);
        if (match) {
            year = match[0];
        } else {
            // 取れなかった場合は最初の4文字などを取るかフォールバック
            year = dateTag.content.substring(0, 4);
        }
    }

    if (authors.length === 0) {
        return null;
    }

    return { authors, year };
}

/**
 * URL、タイトル、およびメタデータからMarkdownリンクを生成する
 */
function generateMarkdownLink(url, title, citationData) {
    let category = title || 'ページタイトルなし';
    let finalUrl = url;

    // 1. 学術論文のメタデータが存在する場合は最優先で処理（既存のドメイン判定処理には進まない）
    if (citationData && citationData.authors && citationData.authors.length > 0) {
        const authors = citationData.authors;
        const year = citationData.year ? `, ${citationData.year}` : "";
        const isJapanese = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\xf900-\uFAFF]/.test(title || "");

        // 「姓」を抽出するヘルパー（"Smith, John" -> "Smith", "John Smith" -> "Smith" (簡易判定), "山田 太郎" -> "山田"）
        const extractLastName = (fullName) => {
            if (fullName.includes(",")) {
                return fullName.split(",")[0].trim();
            }
            if (fullName.includes(" ")) {
                const parts = fullName.split(" ");
                // 英語の場合、最後が姓であることが多い (John Smith -> Smith)。日本語の場合は最初 (山田 太郎 -> 山田) だが、
                // メタデータ上はどう登録されているか一概に言えないので、カンマがなければ単語の最後（英語）か最初（日本語）を取る
                return isJapanese ? parts[0] : parts[parts.length - 1]; // 英語なら最後の単語、日本語なら最初の単語（スペース区切りの場合）
            }
            if (fullName.includes("　")) {
                return fullName.split("　")[0].trim(); // 全角スペース区切り
            }
            return fullName; // 区切りがなければそのまま
        };

        let authorFormatted = "";
        if (authors.length === 1) {
            authorFormatted = extractLastName(authors[0]);
        } else if (authors.length === 2) {
            const last1 = extractLastName(authors[0]);
            const last2 = extractLastName(authors[1]);
            authorFormatted = isJapanese ? `${last1}・${last2}` : `${last1} & ${last2}`;
        } else {
            const last1 = extractLastName(authors[0]);
            authorFormatted = isJapanese ? `${last1} 他.` : `${last1} et al.`;
        }

        category = `${authorFormatted}${year}`;
        return `[${category}](${finalUrl})`;
    }

    // 2. 学術論文メタデータがない場合のフォールバック（これまでのドメイン別処理）
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        if (hostname.includes('chatgpt.com')) {
            category = 'ChatGPT';
        } else if (hostname.includes('gemini.google.com')) {
            category = 'Gemini';
        } else if (hostname.includes('grok.com')) {
            category = 'Grok';
        } else if (hostname.includes('notebooklm.google.com')) {
            category = 'NotebookLM';
        } else if (hostname.includes('claude.ai')) {
            category = 'Claude';
        } else if (hostname.includes('mail.google.com')) {
            category = 'Gmail';
        } else if (hostname.includes('amazon')) {
            category = 'Amazon page';
            // ASINを抽出して短縮URLを作成 (dp/ASIN または gp/product/ASIN など)
            const asinMatch = url.match(/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})/i);
            if (asinMatch && asinMatch[1]) {
                const asin = asinMatch[1];
                finalUrl = `https://www.amazon.co.jp/dp/${asin}/`;
            }
        }
    } catch (e) {
        // URLのパースに失敗した場合（chrome://拡張など）はそのままの処理を継続
        console.warn("URL Error:", e);
    }

    return `[${category}](${finalUrl})`;
}
