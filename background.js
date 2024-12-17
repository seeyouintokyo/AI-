import { API_CONFIG, STORAGE_CONFIG, BOOKMARK_CONFIG } from './config.js';

// 初始化
async function initialize() {
    try {
        // 获取API key
        const data = await chrome.storage.local.get(STORAGE_CONFIG.keys.apiKey);
        const apiKey = data[STORAGE_CONFIG.keys.apiKey];
        
        if (!apiKey) {
            console.warn('API key not set. Please set it in the extension settings.');
        }
        
        console.log('Background script initialized');
    } catch (error) {
        console.error('初始化失败:', error);
    }
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        switch (request.type) {
            case 'saveBookmark':
                saveBookmark(request.data)
                    .then(result => sendResponse(result))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                break;
            case 'getBookmark':
                getBookmark(request.data.url)
                    .then(bookmark => sendResponse({ success: true, data: bookmark }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                break;
            case 'searchBookmarks':
                searchBookmarks(request.query)
                    .then(results => sendResponse({ success: true, data: results }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                break;
            default:
                sendResponse({ success: false, error: '未知的消息类型' });
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
    }
    return true; // 保持消息通道开放
});

// 处理书签保存
async function saveBookmark(data) {
    try {
        const { url, title, description, customTags } = data;
        
        // 获取API key
        const storage = await chrome.storage.local.get(STORAGE_CONFIG.keys.apiKey);
        const apiKey = storage[STORAGE_CONFIG.keys.apiKey];
        
        if (!apiKey) {
            throw new Error('请先设置 API Key');
        }

        // 获取当前标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // 注入content script来获取页面内容
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        });

        // 获取页面内容
        const contentResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
        const pageContent = contentResponse?.content || '';

        // 调用 API 生成标签和摘要
        const response = await fetch(API_CONFIG.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: API_CONFIG.model,
                messages: [
                    { role: 'system', content: API_CONFIG.systemPrompt },
                    { 
                        role: 'user', 
                        content: `标题：${title}
描述：${description || ''}
页面内容：
${pageContent}`
                    }
                ],
                temperature: API_CONFIG.temperature,
                max_tokens: API_CONFIG.maxTokens
            })
        });

        if (!response.ok) {
            throw new Error('API 调用失败');
        }

        const result = await response.json();
        let aiResult;
        try {
            aiResult = JSON.parse(result.choices[0].message.content);
        } catch (error) {
            console.error('Failed to parse AI response:', error);
            aiResult = {
                tags: [],
                summary: description || title,
                concepts: []
            };
        }

        // 合并 AI 标签和自定义标签
        const allTags = [...new Set([...(aiResult.tags || []), ...(customTags || [])])];

        // 保存书签数据
        const bookmarkData = {
            url,
            title,
            description: description || '',
            tags: allTags,
            summary: aiResult.summary || '',
            concepts: aiResult.concepts || [],
            timestamp: Date.now()
        };

        // 获取现有书签
        const existingData = await chrome.storage.local.get(STORAGE_CONFIG.keys.bookmarks);
        const bookmarks = existingData[STORAGE_CONFIG.keys.bookmarks] || {};

        // 添加新书签
        bookmarks[url] = bookmarkData;

        // 保存更新后的书签数据
        await chrome.storage.local.set({
            [STORAGE_CONFIG.keys.bookmarks]: bookmarks
        });

        return {
            success: true,
            data: {
                tags: allTags
            }
        };
    } catch (error) {
        console.error('Error saving bookmark:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 获取书签
async function getBookmark(url) {
    try {
        const data = await chrome.storage.local.get(STORAGE_CONFIG.keys.bookmarks);
        const bookmarks = data[STORAGE_CONFIG.keys.bookmarks] || {};
        return bookmarks[url];
    } catch (error) {
        console.error('Error getting bookmark:', error);
        throw error;
    }
}

// 搜索书签
async function searchBookmarks(query) {
    try {
        // 获取所有书签
        const data = await chrome.storage.local.get(STORAGE_CONFIG.keys.bookmarks);
        const bookmarks = data[STORAGE_CONFIG.keys.bookmarks] || {};

        // 如果没有查询，返回最近的书签
        if (!query) {
            return Object.values(bookmarks)
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 10);
        }

        // 转换查询为小写以进行不区分大小写的搜索
        query = query.toLowerCase();

        // 搜索匹配项
        return Object.values(bookmarks)
            .filter(bookmark => {
                const searchableText = [
                    bookmark.title,
                    bookmark.description,
                    bookmark.summary,
                    ...(bookmark.tags || []),
                    ...(bookmark.concepts || []),
                    ...(bookmark.customKeywords || []) // 加入提取的关键词
                ].join(' ').toLowerCase();

                return searchableText.includes(query);
            })
            .sort((a, b) => {
                // 优先显示标题匹配的结果
                const aTitle = a.title.toLowerCase();
                const bTitle = b.title.toLowerCase();
                if (aTitle.includes(query) && !bTitle.includes(query)) return -1;
                if (!aTitle.includes(query) && bTitle.includes(query)) return 1;
                // 其次按时间排序
                return b.timestamp - a.timestamp;
            })
            .slice(0, 10); // 限制返回结果数量
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

// 处理地址栏输入
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    try {
        const results = await searchBookmarks(text);
        const suggestions = results.map(bookmark => ({
            content: bookmark.url,
            description: `${bookmark.title} - ${bookmark.tags.join(', ')}`
        }));
        suggest(suggestions);
    } catch (error) {
        console.error('Search error:', error);
        suggest([{
            content: '',
            description: '搜索出错，请重试'
        }]);
    }
});

// 处理地址栏选择
chrome.omnibox.onInputEntered.addListener((url) => {
    // 如果是有效的URL，打开它
    if (url.startsWith('http://') || url.startsWith('https://')) {
        chrome.tabs.create({ url });
    }
});

// 初始化
initialize();