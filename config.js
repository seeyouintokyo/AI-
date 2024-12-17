// API 配置
export const API_CONFIG = {
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    temperature: 0.3,  // 保持适度的创造性
    maxTokens: 200,    // 减少 token 数量
    systemPrompt: `分析内容并生成JSON格式输出：
{
    "tags": ["标签1", "标签2", "标签3"],  // 3个关键标签
    "summary": "一句话总结（20字内）",
    "concepts": ["概念1", "概念2"]  // 2个关键概念
}`
};

// 存储相关配置
export const STORAGE_CONFIG = {
    keys: {
        apiKey: 'AI_BOOKMARK_API_KEY',
        bookmarks: 'AI_BOOKMARK_DATA',
        settings: 'AI_BOOKMARK_SETTINGS'
    },
    version: '1.1'
};

// 书签相关配置
export const BOOKMARK_CONFIG = {
    // 标签生成相关
    tagGeneration: {
        maxTags: 3,
        minTagLength: 2,
        maxTagLength: 10,
        defaultTags: ['未分类']
    },
    
    // 内容提取相关
    contentExtraction: {
        maxLength: 1000,  // 减少处理的文本长度
        excludeSelectors: [
            'header',
            'footer',
            'nav',
            'style',
            'script',
            'iframe',
            '.ads',
            '#comments'
        ],
        includeSelectors: [
            'article',
            '.content',
            '.post',
            'main'
        ]
    },
    
    // 存储相关
    storage: {
        bookmarkPrefix: 'bm_',
        contentPrefix: 'ct_',
        maxBookmarks: 1000  // 最大书签数量
    },
    
    // UI相关
    ui: {
        maxDescriptionLength: 200,
        maxSummaryLength: 50,
        loadingTimeout: 10000,  // 10秒超时
        maxTagDisplay: 5,
        notifications: {
            saveSuccess: '书签保存成功！',
            saveError: '保存失败，请重试',
            apiKeySuccess: 'API Key 已保存',
            apiKeyError: 'API Key 保存失败'
        }
    }
};
