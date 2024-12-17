import { API_CONFIG, STORAGE_KEYS } from './config.js';
import { getApiKey } from './background.js';

// 初始化omnibox
chrome.omnibox.onInputStarted.addListener(() => {
    console.log('Omnibox search started');
});

// 处理输入变化
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    console.log('Search query:', text);
    if (!text.trim()) {
        return;
    }

    try {
        const suggestions = await searchBookmarks(text);
        suggest(suggestions);
    } catch (error) {
        console.error('Search error:', error);
        suggest([{
            content: 'error',
            description: '搜索出错，请稍后重试'
        }]);
    }
});

// 处理选择结果
chrome.omnibox.onInputEntered.addListener((url, disposition) => {
    if (url === 'error') return;

    switch (disposition) {
        case "currentTab":
            chrome.tabs.update({ url });
            break;
        case "newForegroundTab":
            chrome.tabs.create({ url });
            break;
        case "newBackgroundTab":
            chrome.tabs.create({ url, active: false });
            break;
    }
});

// 查询扩展：使用AI生成相关概念
async function expandQuery(query) {
    try {
        const response = await fetch(API_CONFIG.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + await getApiKey()
            },
            body: JSON.stringify({
                model: API_CONFIG.model,
                messages: [
                    {
                        role: "system",
                        content: `你是一个帮助扩展搜索查询的助手。请分析用户的查询，生成相关的概念和同义词。返回JSON数组格式。
示例：
输入："价格"
输出：["价格", "价钱", "多少钱", "费用", "成本", "优惠", "便宜", "贵"]

输入："Python"
输出：["Python", "编程", "开发", "代码", "脚本", "程序设计"]

注意：
1. 必须返回JSON数组格式
2. 包含原始查询词
3. 生成的词要相关且实用
4. 数组长度控制在3-8个词`
                    },
                    {
                        role: "user",
                        content: `请为以下查询生成相关概念和同义词：${query}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 200
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('Query expansion result:', result);
        
        try {
            // 尝试解析返回的JSON数组
            const expandedTerms = JSON.parse(result.choices[0].message.content);
            if (Array.isArray(expandedTerms)) {
                return expandedTerms;
            }
        } catch (e) {
            console.error('Failed to parse expanded terms:', e);
        }
        
        // 如果解析失败，返回原查询词
        return [query];
    } catch (error) {
        console.error('Query expansion failed:', error);
        return [query];
    }
}

// 搜索书签
async function searchBookmarks(query) {
    try {
        // 获取知识库数据
        const data = await chrome.storage.local.get(STORAGE_KEYS.knowledgeBase);
        const knowledgeBase = data[STORAGE_KEYS.knowledgeBase] || [];
        
        console.log('Knowledge base:', knowledgeBase);
        console.log('Original query:', query);

        // 如果知识库为空，返回空结果
        if (knowledgeBase.length === 0) {
            console.log('Empty knowledge base');
            return [];
        }

        // 使用 AI 进行语义搜索
        const response = await fetch(API_CONFIG.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + await getApiKey()
            },
            body: JSON.stringify({
                model: API_CONFIG.model,
                messages: [
                    {
                        role: "system",
                        content: `你是一个智能搜索助手，帮助用户在书签库中找到最相关的内容。
任务要求：
1. 理解用户搜索词背后的真实意图
2. 分析每个书签的自定义描述，理解其核心含义
3. 找出搜索意图与描述之间的语义关联
4. 不要局限于关键词匹配，要理解潜在的相关性
5. 考虑同义词、相关概念、上下文语境

例如：
- 用户搜索"编程教程"，应该匹配"Python入门指南"、"软件开发学习资源"等
- 用户搜索"美食"，应该匹配"烹饪技巧"、"菜谱分享"、"美食推荐"等
- 用户搜索"工具"，应该匹配"效率软件"、"在线工具"、"实用程序"等`
                    },
                    {
                        role: "user",
                        content: `用户搜索词: "${query}"

当前书签库:
${knowledgeBase.map(site => 
`---
标题: ${site.title || '无标题'}
URL: ${site.url}
描述: ${site.description || '无描述'}
自定义描述: ${site.customDescription || '无自定义描述'}`
).join('\n')}

请分析搜索词的意图，并找出最相关的书签。对每个匹配的结果：
1. 给出相关度评分(0-100)
2. 解释为什么它与搜索意图相关
3. 考虑标题、描述和自定义描述的语义关联

返回格式：
URL: [网址]
标题: [标题]
相关度: [分数]
匹配原因: [详细解释匹配原因]`
                    }
                ],
                temperature: 0.7,
                max_tokens: 800
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('AI response:', result);

        const suggestions = parseAISuggestions(result.choices[0].message.content);
        console.log('Parsed suggestions:', suggestions);

        if (suggestions.length === 0) {
            return fallbackSearch(query, knowledgeBase);
        }

        return suggestions.map(suggestion => ({
            content: suggestion.url,
            description: `${suggestion.title} (相关度: ${suggestion.score}%) - ${suggestion.reason}`
        }));

    } catch (error) {
        console.error('Search error:', error);
        return fallbackSearch(query, knowledgeBase);
    }
}

// 解析 AI 返回的建议
function parseAISuggestions(content) {
    const suggestions = [];
    const lines = content.split('\n');
    let currentSuggestion = {};

    for (const line of lines) {
        const lineContent = line.trim();
        if (!lineContent) continue;

        if (lineContent.startsWith('URL:')) {
            if (currentSuggestion.url) {
                suggestions.push({ ...currentSuggestion });
            }
            currentSuggestion = {
                url: lineContent.replace('URL:', '').trim()
            };
        } else if (lineContent.startsWith('标题:')) {
            currentSuggestion.title = lineContent.replace('标题:', '').trim();
        } else if (lineContent.startsWith('相关度:')) {
            currentSuggestion.score = parseInt(lineContent.replace('相关度:', '').trim()) || 0;
        } else if (lineContent.startsWith('匹配原因:')) {
            currentSuggestion.reason = lineContent.replace('匹配原因:', '').trim();
        }
    }

    if (currentSuggestion.url) {
        suggestions.push({ ...currentSuggestion });
    }

    return suggestions;
}

// 后备搜索方法
function fallbackSearch(query, knowledgeBase) {
    console.log('Using fallback search');
    const queryTerms = query.toLowerCase().split(/\s+/);
    const results = [];

    for (const bookmark of knowledgeBase) {
        // 组合所有可搜索的文本，包括扩展的关键词
        const searchText = [
            bookmark.title || '',
            bookmark.description || '',
            bookmark.content || '',
            (bookmark.keywords || []).join(' ')  // 添加扩展的关键词
        ].join(' ').toLowerCase();

        let matchCount = 0;
        let matchedTerms = new Set();
        
        // 检查每个查询词
        for (const term of queryTerms) {
            if (searchText.includes(term.toLowerCase())) {
                matchCount++;
                matchedTerms.add(term);
            }
        }
        
        // 检查扩展关键词
        if (bookmark.keywords) {
            for (const keyword of bookmark.keywords) {
                for (const term of queryTerms) {
                    if (keyword.toLowerCase().includes(term.toLowerCase())) {
                        matchCount++;
                        matchedTerms.add(term);
                    }
                }
            }
        }
        
        if (matchCount > 0) {
            const score = Math.round((matchCount / queryTerms.length) * 100);
            const matchInfo = Array.from(matchedTerms).join(', ');
            let description = `${bookmark.title || bookmark.url} - 匹配词: ${matchInfo}`;
            
            // 如果有匹配的关键词，显示它们
            if (bookmark.keywords && bookmark.keywords.length > 0) {
                description += ` [相关词: ${bookmark.keywords.join(', ')}]`;
            }
            
            description += ` (匹配度: ${score}%)`;
            
            results.push({
                content: bookmark.url,
                description: description
            });
        }
    }

    console.log('Fallback results:', results);
    return results.sort((a, b) => {
        const scoreA = parseInt(a.description.match(/匹配度: (\d+)%/)[1]);
        const scoreB = parseInt(b.description.match(/匹配度: (\d+)%/)[1]);
        return scoreB - scoreA;
    });
}