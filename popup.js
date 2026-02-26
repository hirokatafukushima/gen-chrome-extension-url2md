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
 * 現在のページのDOMから学術論文のメタデータ（著者、出版年、タイトル）を抽出する関数。
 * この関数はWebページのコンテキスト（Content Script）内で実行されるため、外部変数は参照できません。
 * 
 * 以下の3つのソースから優先順位をつけて抽出を試みる：
 * 1. HighWire Press メタタグ (citation_author 等)
 * 2. Dublin Core メタタグ (dc.creator 等)
 * 3. JSON-LD 構造化データ (application/ld+json)
 */
function extractCitationMetadata() {
    let authors = [];
    let year = "";
    let citationTitle = "";

    // --- ソース1: HighWire Press メタタグ ---
    const hwAuthorTags = document.querySelectorAll('meta[name="citation_author"]');
    hwAuthorTags.forEach(tag => {
        if (tag.content) authors.push(tag.content.trim());
    });

    const hwDateTag = document.querySelector('meta[name="citation_publication_date"], meta[name="citation_date"], meta[name="citation_year"], meta[name="citation_online_date"]');
    if (hwDateTag && hwDateTag.content) {
        const match = hwDateTag.content.match(/(19|20)\d{2}/);
        if (match) year = match[0];
    }

    const hwTitleTag = document.querySelector('meta[name="citation_title"]');
    if (hwTitleTag && hwTitleTag.content) {
        citationTitle = hwTitleTag.content.trim();
    }

    // --- ソース2: Dublin Core メタタグ ---
    if (authors.length === 0) {
        const dcAuthorTags = document.querySelectorAll('meta[name="dc.creator"], meta[name="DC.creator"], meta[name="dc.Creator"]');
        dcAuthorTags.forEach(tag => {
            if (tag.content) authors.push(tag.content.trim());
        });
    }

    if (!year) {
        const dcDateTag = document.querySelector('meta[name="dc.date"], meta[name="DC.date"], meta[name="dc.Date"], meta[name="prism.publicationDate"], meta[name="prism.coverDate"]');
        if (dcDateTag && dcDateTag.content) {
            const match = dcDateTag.content.match(/(19|20)\d{2}/);
            if (match) year = match[0];
        }
    }

    if (!citationTitle) {
        const dcTitleTag = document.querySelector('meta[name="dc.title"], meta[name="DC.title"], meta[name="dc.Title"]');
        if (dcTitleTag && dcTitleTag.content) {
            citationTitle = dcTitleTag.content.trim();
        }
    }

    // --- ソース3: JSON-LD 構造化データ ---
    if (authors.length === 0) {
        try {
            const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of ldScripts) {
                const data = JSON.parse(script.textContent);
                // 単一オブジェクトまたは配列の場合を処理
                const items = Array.isArray(data) ? data : [data];
                for (const item of items) {
                    if (item["@type"] && (
                        item["@type"] === "ScholarlyArticle" ||
                        item["@type"] === "Article" ||
                        item["@type"] === "MedicalScholarlyArticle" ||
                        (Array.isArray(item["@type"]) && item["@type"].some(t => t === "ScholarlyArticle" || t === "Article"))
                    )) {
                        // 著者の抽出
                        if (item.author) {
                            const authorList = Array.isArray(item.author) ? item.author : [item.author];
                            for (const a of authorList) {
                                if (typeof a === "string") {
                                    authors.push(a.trim());
                                } else if (a.name) {
                                    authors.push(a.name.trim());
                                } else if (a.familyName) {
                                    // JSON-LDでは familyName / givenName が分離されている場合がある
                                    const fn = a.familyName.trim();
                                    const gn = a.givenName ? a.givenName.trim() : "";
                                    authors.push(gn ? `${fn}, ${gn}` : fn);
                                }
                            }
                        }
                        // 出版年の抽出
                        if (!year) {
                            const dateStr = item.datePublished || item.dateCreated || "";
                            const match = dateStr.match(/(19|20)\d{2}/);
                            if (match) year = match[0];
                        }
                        // タイトルの抽出
                        if (!citationTitle && item.name) {
                            citationTitle = item.name.trim();
                        } else if (!citationTitle && item.headline) {
                            citationTitle = item.headline.trim();
                        }
                        if (authors.length > 0) break; // 見つかったらループ終了
                    }
                }
                if (authors.length > 0) break;
            }
        } catch (e) {
            // JSON-LDのパースに失敗した場合は無視して続行
        }
    }

    if (authors.length === 0) {
        return null;
    }

    return { authors, year, citationTitle };
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
        // 言語判定：論文のcitationTitleが取れている場合はそちらを優先してチェック
        const titleToCheck = citationData.citationTitle || title || "";
        const isJapanese = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\uFAFF]/.test(titleToCheck);

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
