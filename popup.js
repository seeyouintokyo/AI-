import { STORAGE_CONFIG } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
    // API Key 相关元素
    const apiKeyInput = document.getElementById('apiKey');
    const saveApiKeyBtn = document.getElementById('saveApiKey');
    const apiKeyStatus = document.getElementById('apiKeyStatus');
    const toggleVisibilityButton = document.getElementById('toggleVisibility');

    // 书签保存相关元素
    const titleInput = document.getElementById('title');
    const urlInput = document.getElementById('url');
    const descriptionInput = document.getElementById('description');
    const saveBookmarkBtn = document.getElementById('saveBookmark');
    const tagsContainer = document.getElementById('tags');
    const bookmarkStatus = document.getElementById('bookmarkStatus');

    let customTags = [];

    // 自动获取当前标签页的标题和URL
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
        const currentTab = tabs[0];
        titleInput.value = currentTab.title;
        urlInput.value = currentTab.url;

        try {
            // 注入content script
            await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                files: ['content.js']
            });

            // 自动提取页面信息
            const response = await chrome.tabs.sendMessage(currentTab.id, { type: 'GET_PAGE_CONTENT' });
            if (response && response.content) {
                // 将提取的内容设置到描述框中
                descriptionInput.value = response.content;
            }
        } catch (error) {
            console.error('Error extracting content:', error);
        }

        // 获取已保存的书签信息
        const response = await chrome.runtime.sendMessage({
            type: 'getBookmark',
            data: { url: currentTab.url }
        });

        if (response && response.data) {
            const bookmark = response.data;
            if (bookmark.tags && bookmark.tags.length > 0) {
                customTags = [...bookmark.tags];
                updateTagsDisplay(customTags, true);
            }
            if (bookmark.description) {
                descriptionInput.value = bookmark.description;
            }
        }
    });

    // 处理描述框输入
    descriptionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            descriptionInput.value = descriptionInput.value + '\n';
        }
    });

    // 更新标签显示
    function updateTagsDisplay(tags = [], isUserTag = true) {
        tagsContainer.innerHTML = tags
            .map(tag => `<span class="tag ${isUserTag ? 'user-tag' : ''}">${tag}</span>`)
            .join('');
    }

    // 加载已保存的 API Key
    chrome.storage.local.get([STORAGE_CONFIG.keys.apiKey], (result) => {
        if (result[STORAGE_CONFIG.keys.apiKey]) {
            apiKeyInput.value = result[STORAGE_CONFIG.keys.apiKey];
        }
    });

    // 保存 API Key
    saveApiKeyBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showStatus(apiKeyStatus, '请输入 API Key', 'error');
            return;
        }

        try {
            await chrome.storage.local.set({
                [STORAGE_CONFIG.keys.apiKey]: apiKey
            });
            showStatus(apiKeyStatus, '保存成功', 'success');
        } catch (error) {
            console.error('Error saving API key:', error);
            showStatus(apiKeyStatus, '保存失败', 'error');
        }
    });

    // 切换 API Key 显示/隐藏
    toggleVisibilityButton.addEventListener('click', function() {
        const type = apiKeyInput.type === 'password' ? 'text' : 'password';
        apiKeyInput.type = type;
        
        // 更新图标
        const eyeIcon = this.querySelector('svg');
        if (type === 'text') {
            eyeIcon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            `;
        } else {
            eyeIcon.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            `;
        }
    });

    // 保存书签
    saveBookmarkBtn.addEventListener('click', async () => {
        const title = titleInput.value.trim();
        const url = urlInput.value.trim();
        const description = descriptionInput.value.trim();
        
        // 禁用保存按钮
        saveBookmarkBtn.disabled = true;
        saveBookmarkBtn.textContent = '保存中...';
        
        try {
            // 发送消息给 background script 处理书签保存
            const response = await chrome.runtime.sendMessage({
                type: 'saveBookmark',
                data: {
                    url: url,
                    title: title,
                    description: description,
                    customTags: customTags
                }
            });

            if (response.success) {
                showStatus(bookmarkStatus, '保存成功', 'success');
                // 显示生成的标签
                if (response.data && response.data.tags) {
                    const aiTags = response.data.tags.filter(tag => !customTags.includes(tag));
                    // 先显示 AI 标签
                    tagsContainer.innerHTML = aiTags
                        .map(tag => `<span class="tag">${tag}</span>`)
                        .join('');
                    // 再显示用户标签
                    tagsContainer.innerHTML += customTags
                        .map(tag => `<span class="tag user-tag">${tag}</span>`)
                        .join('');
                }
            } else {
                throw new Error(response.error || '保存失败');
            }
        } catch (error) {
            console.error('Error saving bookmark:', error);
            showStatus(bookmarkStatus, '保存失败: ' + error.message);
        } finally {
            // 恢复保存按钮
            saveBookmarkBtn.disabled = false;
            saveBookmarkBtn.textContent = '保存书签';
        }
    });
});

// 显示状态信息
function showStatus(element, message, type, duration = 3000) {
    element.textContent = message;
    element.className = `status ${type}`;
    element.style.display = 'block';
    
    setTimeout(() => {
        element.style.display = 'none';
    }, duration);
}
