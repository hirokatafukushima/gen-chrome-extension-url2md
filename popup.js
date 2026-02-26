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

        const markdownText = generateMarkdownLink(tab.url, tab.title);

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
 * URLとタイトルからMarkdownリンクを生成する
 */
function generateMarkdownLink(url, title) {
    let category = title || 'ページタイトルなし';
    let finalUrl = url;

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
