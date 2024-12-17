// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message in content script:', request);
    
    if (request.type === 'GET_PAGE_CONTENT') {
        try {
            // 获取选中的文本
            const selectedText = window.getSelection().toString().trim();
            
            // 如果有选中文本，优先使用选中的文本
            if (selectedText) {
                sendResponse({ content: selectedText });
                return true;
            }

            // 否则尝试获取主要内容
            const content = extractPageContent();
            const pageInfo = extractPageInfo();
            
            sendResponse({ 
                content: content,
                ...pageInfo
            });
        } catch (error) {
            console.error('Error getting page content:', error);
            sendResponse({ content: '', error: error.message });
        }
    }
    
    return true; // 保持消息通道开放
});

// 提取页面主要内容
function extractPageContent() {
    // 尝试获取文章主体内容
    const article = document.querySelector('article') || 
                   document.querySelector('.article') || 
                   document.querySelector('.post') ||
                   document.querySelector('main');
    
    if (article) {
        return article.textContent.trim();
    }

    // 如果找不到主体内容，尝试获取第一个大段落
    const paragraphs = Array.from(document.getElementsByTagName('p'))
        .filter(p => p.textContent.trim().length > 100);
    
    if (paragraphs.length > 0) {
        return paragraphs[0].textContent.trim();
    }

    // 如果还是找不到，获取页面描述
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
        return metaDescription.getAttribute('content');
    }

    // 最后的备选方案：获取标题
    return document.title;
}

// 提取页面关键信息
function extractPageInfo() {
    let keywords = [];
    let description = '';
    
    // 从meta标签获取关键词
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
        keywords = keywords.concat(metaKeywords.content.split(',').map(k => k.trim()));
    }
    
    // 获取所有标题文本
    const headings = document.querySelectorAll('h1, h2, h3');
    headings.forEach(heading => {
        const text = heading.textContent.trim();
        if (text) keywords.push(text);
    });
    
    // 获取加粗文本
    const boldTexts = document.querySelectorAll('strong, b');
    boldTexts.forEach(bold => {
        const text = bold.textContent.trim();
        if (text) keywords.push(text);
    });
    
    // 获取meta描述
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        description = metaDesc.content;
    }
    
    // 去重并限制关键词数量
    keywords = [...new Set(keywords)].slice(0, 10);
    
    return {
        keywords: keywords,
        description: description,
        title: document.title
    };
}