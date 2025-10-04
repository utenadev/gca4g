class Gca4gPopup {
    constructor() {
        this.elements = this.getElements();
        this.validateElements();

        this.chatHistory = [];
        this.initialize();
    }

    getElements() {
        return {
            apiKeyView: document.getElementById('api-key-view'),
            chatView: document.getElementById('chat-view'),
            apiKeyInput: document.getElementById('api-key-input'),
            saveApiKeyButton: document.getElementById('save-api-key-btn'),
            changeApiKeyButton: document.getElementById('change-api-key-btn'),
            chatLog: document.getElementById('chat-log'),
            errorDiv: document.getElementById('error'),
            promptTextarea: document.getElementById('prompt-textarea'),
            sendButton: document.getElementById('send-btn'),
        };
    }

    validateElements() {
        for (const key in this.elements) {
            if (!this.elements[key]) {
                const errorMsg = `UI Error: Element not found: ${key}`;
                console.error(errorMsg);
                document.body.innerHTML = `<div style="color: red; padding: 10px;">${errorMsg}</div>`;
                throw new Error(errorMsg);
            }
        }
    }

    async initialize() {
        this.addEventListeners();
        await this.loadChatHistory();
        const response = await this.sendMessageToSw({ type: 'GET_API_KEY' });
        const apiKey = response ? response.apiKey : null;
        if (apiKey && apiKey.startsWith('AIzaSy')) {
            this.showView('chat');
        } else {
            this.showView('apiKey');
        }
    }

    addEventListeners() {
        this.elements.saveApiKeyButton.addEventListener('click', () => this.saveApiKey());
        this.elements.changeApiKeyButton.addEventListener('click', () => this.showView('apiKey'));
        this.elements.sendButton.addEventListener('click', () => this.handleSend());
        this.elements.promptTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });
        
        this.elements.chatLog.addEventListener('click', (e) => {
            if (e.target && e.target.matches('.diff-result-button')) {
                const messageId = e.target.dataset.messageId;
                const message = this.chatHistory.find(m => m.id === messageId);
                if (message && message.diffData) {
                    this.openDiffWindow(message.diffData, message.originalFiles);
                }
            }
        });
    }
    
    async openDiffWindow(diffData, originalFiles) {
        await chrome.storage.local.set({ 
            tempDiffData: diffData,
            tempOriginalFiles: originalFiles 
        });
        
        const { diffWindowState } = await chrome.storage.local.get('diffWindowState');
        
        const defaultWidth = 850;
        const defaultHeight = 700;
        
        await chrome.windows.create({
            url: 'diff_window.html',
            type: 'popup',
            width: diffWindowState?.width || defaultWidth,
            height: diffWindowState?.height || defaultHeight,
            left: diffWindowState?.left,
            top: diffWindowState?.top,
        });
    }

    async sendMessageToSw(message) {
        try {
            return await chrome.runtime.sendMessage(message);
        } catch (error) {
            console.error('Service Worker connection error:', error);
            this.showError('拡張機能のバックグラウンドと通信できません。');
            return null;
        }
    }
    
    async loadChatHistory() {
        const { history } = await chrome.storage.session.get('history');
        if (history) {
            this.chatHistory = history;
            this.chatHistory.forEach(msg => this.renderMessage(msg, false));
        }
    }
    
    async saveChatHistory() {
        await chrome.storage.session.set({ history: this.chatHistory });
    }

    showView(viewName) {
        ['apiKeyView', 'chatView'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        const viewId = `${viewName}View`;
        const elToShow = document.getElementById(viewId);
        if (elToShow) {
            elToShow.classList.remove('hidden');
        }
    }

    renderMessage(message, save = true) {
        const { id, role, text, timestamp, diffData } = message;
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `chat-message ${role}-message`;
        
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        
        const textNode = document.createTextNode(text);
        bubble.appendChild(textNode);
        
        if (diffData) {
            const button = document.createElement('button');
            button.className = 'diff-result-button';
            button.textContent = '変更内容を新しいウィンドウで確認';
            button.dataset.messageId = id;
            bubble.appendChild(document.createElement('br'));
            bubble.appendChild(button);
        }

        const time = document.createElement('div');
        time.className = 'timestamp';
        time.textContent = new Date(timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

        messageWrapper.appendChild(bubble);
        messageWrapper.appendChild(time);
        this.elements.chatLog.appendChild(messageWrapper);

        if (save) {
            this.chatHistory.push(message);
            this.saveChatHistory();
        }
        
        this.elements.chatLog.scrollTop = this.elements.chatLog.scrollHeight;
    }

    async saveApiKey() {
        const apiKey = this.elements.apiKeyInput.value.trim();
        const response = await this.sendMessageToSw({ type: 'SAVE_API_KEY', apiKey });
        if (response && response.success) {
            this.showView('chat');
        } else {
            this.showError(response?.error || 'キーの保存に失敗しました。');
        }
    }

    async handleSend() {
        const prompt = this.elements.promptTextarea.value.trim();
        if (!prompt) return;

        this.elements.promptTextarea.value = '';
        this.showError(null);
        this.elements.sendButton.disabled = true;

        this.renderMessage({ id: Date.now().toString(), role: 'user', text: prompt, timestamp: Date.now() });
        const thinkingMessage = { id: (Date.now() + 1).toString(), role: 'assistant', text: '考え中...', timestamp: Date.now() };
        this.renderMessage(thinkingMessage);

        try {
            const tabs = await chrome.tabs.query({ active: true, url: "https://script.google.com/home/projects/*" });
            if (tabs.length === 0) throw new Error('GASエディタのタブが見つかりません。');
            
            const originalFiles = await chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_FILES' });
            const response = await this.sendMessageToSw({ type: 'GENERATE_CODE', prompt, files: originalFiles });
            
            const existingMessageIndex = this.chatHistory.findIndex(m => m.id === thinkingMessage.id);
            if (existingMessageIndex > -1) {
                let updatedMessage;
                if (response && response.success) {
                    updatedMessage = {
                        ...thinkingMessage,
                        text: 'コードの変更案を生成しました。',
                        diffData: response.data,
                        originalFiles: originalFiles
                    };
                } else {
                     updatedMessage = {
                        ...thinkingMessage,
                        text: `エラー: ${response?.error || '生成に失敗しました。'}`
                    };
                }
                this.chatHistory[existingMessageIndex] = updatedMessage;
                
                this.elements.chatLog.innerHTML = '';
                this.chatHistory.forEach(msg => this.renderMessage(msg, false));
                this.saveChatHistory();
            }
        } catch (e) {
            this.showError(e.message);
        } finally {
            this.elements.sendButton.disabled = false;
        }
    }
    
    showError(message) {
        if (message) {
            this.elements.errorDiv.textContent = message;
            this.elements.errorDiv.classList.remove('hidden');
        } else {
            this.elements.errorDiv.classList.add('hidden');
        }
    }
}

new Gca4gPopup();