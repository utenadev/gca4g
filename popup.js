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
            passwordView: document.getElementById('password-view'),
            chatView: document.getElementById('chat-view'),
            apiKeyInput: document.getElementById('api-key-input'),
            masterPasswordInput: document.getElementById('master-password-input'),
            confirmPasswordInput: document.getElementById('confirm-password-input'),
            saveApiKeyButton: document.getElementById('save-api-key-btn'),
            savePasswordButton: document.getElementById('save-password-btn'),
            backToApiKeyButton: document.getElementById('back-to-api-key-btn'),
            changeApiKeyButton: document.getElementById('change-api-key-btn'),
            authenticateGasButton: document.getElementById('authenticate-gas-btn'),
            pullProjectButton: document.getElementById('pull-project-btn'),
            pushProjectButton: document.getElementById('push-project-btn'),
            chatLog: document.getElementById('chat-log'),
            errorDiv: document.getElementById('error'),
            promptTextarea: document.getElementById('prompt-textarea'),
            sendButton: document.getElementById('send-btn'),
            resetAllDataButton: document.getElementById('reset-all-data-btn'),
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
        console.log('Gca4gPopup: initialize() called');
        this.addEventListeners();
        await this.loadChatHistory();
        console.log('Gca4gPopup: loadChatHistory() completed');
        try {
            const response = await this.sendMessageToSw({ type: 'GET_API_KEY' });
            console.log('Gca4gPopup: GET_API_KEY response received:', response);
            const apiKey = response ? response.apiKey : null;
            if (apiKey && apiKey.startsWith('AIzaSy')) {
                console.log('Gca4gPopup: API key found, showing chat view');
                this.showView('chat');
            } else {
                console.log('Gca4gPopup: API key not found or invalid, showing api key view');
                this.showView('apiKey');
            }
        } catch (error) {
            console.error('Gca4gPopup: Error in initialize:', error);
        }
    }

    addEventListeners() {
        this.elements.saveApiKeyButton.addEventListener('click', () => this.saveApiKey());
        this.elements.savePasswordButton.addEventListener('click', () => this.saveMasterPassword());
        this.elements.backToApiKeyButton.addEventListener('click', () => this.showView('apiKey'));
        this.elements.changeApiKeyButton.addEventListener('click', () => this.showView('apiKey'));
        this.elements.authenticateGasButton.addEventListener('click', () => this.handleAuthenticateGAS());
        this.elements.pullProjectButton.addEventListener('click', () => this.handlePullProject());
        this.elements.pushProjectButton.addEventListener('click', () => this.handlePushProject());
        this.elements.sendButton.addEventListener('click', () => this.handleSend());
        this.elements.resetAllDataButton.addEventListener('click', () => this.handleResetAllData());
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
        console.log('Gca4gPopup: Sending message to SW:', message);
        try {
            const response = await chrome.runtime.sendMessage(message);
            console.log('Gca4gPopup: Message response received:', response);
            return response;
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
        ['apiKeyView', 'passwordView', 'chatView'].forEach(id => {
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
        // APIキーの入力を取得
        const apiKey = this.elements.apiKeyInput.value.trim();
        // 簡易的なAPIキーの形式チェック
        if (!apiKey.startsWith('AIzaSy')) {
            this.showError('無効な形式のAPIキーです。');
            return;
        }

        // マスターパスワードが設定されているか確認
        const response = await this.sendMessageToSw({ type: 'GET_MASTER_PASSWORD_STATUS' });
        if (response && response.hasPassword) {
            // パスワードが設定されていれば、直接保存
            await this.saveApiKeyInternal(apiKey);
        } else {
            // パスワードが未設定であれば、パスワード設定画面を表示
            // APIキーは一時的に保持 (例: インスタンス変数に)
            this.pendingApiKey = apiKey;
            this.showView('password');
        }
    }

    // マスターパスワードを保存する処理
    async saveMasterPassword() {
        const password = this.elements.masterPasswordInput.value.trim();
        const confirmPassword = this.elements.confirmPasswordInput.value.trim();

        if (password !== confirmPassword) {
            this.showError('パスワードが一致しません。');
            return;
        }

        if (password.length < 8) {
            this.showError('パスワードは8文字以上で入力してください。');
            return;
        }

        const response = await this.sendMessageToSw({ type: 'SET_MASTER_PASSWORD', password });
        if (response && response.success) {
            // マスターパスワード設定成功後、APIキーを保存
            if (this.pendingApiKey) {
                await this.saveApiKeyInternal(this.pendingApiKey);
                // 保存後に一時変数をクリア
                delete this.pendingApiKey;
            } else {
                // エラー: APIキーが見つからない
                this.showError('APIキーが見つかりません。');
            }
        } else {
            this.showError(response?.error || 'パスワードの設定に失敗しました。');
        }
    }

    // APIキーをService Workerに送信して保存する処理 (内部用)
    async saveApiKeyInternal(apiKey) {
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

    // --- clasp 関連の処理 ---
    async handlePullProject() {
        console.log('Clasp: Pull button clicked');
        this.elements.pullProjectButton.disabled = true;
        try {
            const response = await this.sendMessageToSw({ type: 'PULL_PROJECT' });
            if (response && response.success) {
                // プルしたファイル数をチャットログに表示
                const fileCount = response.files ? response.files.length : 0;
                this.renderMessage({ id: Date.now().toString(), role: 'assistant', text: `プル成功: ${fileCount} 個のファイルを取得しました。`, timestamp: Date.now() });
            } else {
                throw new Error(response?.error || 'プルに失敗しました。');
            }
        } catch (e) {
            this.showError(e.message);
        } finally {
            this.elements.pullProjectButton.disabled = false;
        }
    }

    async handlePushProject() {
        console.log('Clasp: Push button clicked');
        this.elements.pushProjectButton.disabled = true;
        try {
            // 最新のオリジナルファイルと差分データを取得
            // 最後にGeminiからの応答を受け取ったメッセージを取得 (diffData と originalFiles を持つ)
            const lastGeminiResponse = [...this.chatHistory].reverse().find(m => m.role === 'assistant' && m.diffData && m.originalFiles);
            if (!lastGeminiResponse) {
                throw new Error('プッシュするファイルデータが見つかりません。まずメッセージを送信してコードを生成してください。');
            }

            // originalFiles と diffData をマージして、最終的なファイルセットを構築
            // diffData には updates が含まれ、{file: "name", content: "new_content"} の配列
            const originalFiles = lastGeminiResponse.originalFiles;
            const updates = lastGeminiResponse.diffData.updates;

            // originalFiles をコピーし、updates の内容で上書き
            const finalFiles = originalFiles.map(originalFile => {
                const update = updates.find(u => u.file === originalFile.name);
                if (update) {
                    // ファイル名が一致する場合は、更新された内容に置き換える
                    return {
                        name: originalFile.name,
                        type: originalFile.type,
                        source: update.content
                    };
                }
                // 一致しない場合は、元の内容を保持
                return originalFile;
            });

            // 新規ファイル (originalFilesにないがupdatesにあるもの) を追加
            updates.forEach(update => {
                const existingFile = originalFiles.find(f => f.name === update.file);
                if (!existingFile) {
                    // GASのファイルタイプは 'server_js' または 'html' に決まっているため、拡張子から推定
                    const type = update.file.endsWith('.html') ? 'html' : 'server_js';
                    finalFiles.push({
                        name: update.file,
                        type: type,
                        source: update.content
                    });
                }
            });

            console.log('Clasp: Pushing files:', finalFiles);

            const response = await this.sendMessageToSw({ type: 'PUSH_PROJECT', files: finalFiles });
            if (response && response.success) {
                this.renderMessage({ id: Date.now().toString(), role: 'assistant', text: 'プッシュ成功: ファイルをGASプロジェクトにアップロードしました。', timestamp: Date.now() });
            } else {
                throw new Error(response?.error || 'プッシュに失敗しました。');
            }
        } catch (e) {
            this.showError(e.message);
        } finally {
            this.elements.pushProjectButton.disabled = false;
        }
    }
    // --- ここまで ---

    // --- GAS認証 関連の処理 ---
    async handleAuthenticateGAS() {
        console.log('Clasp: Authenticate GAS button clicked');
        this.elements.authenticateGasButton.disabled = true;
        try {
            const response = await this.sendMessageToSw({ type: 'AUTHENTICATE_GAS' });
            if (response && response.success) {
                this.renderMessage({ id: Date.now().toString(), role: 'assistant', text: 'GAS認証に成功しました。', timestamp: Date.now() });
            } else {
                throw new Error(response?.error || 'GAS認証に失敗しました。');
            }
        } catch (e) {
            this.showError(e.message);
        } finally {
            this.elements.authenticateGasButton.disabled = false;
        }
    }

    async handleResetAllData() {
        const confirmed = window.confirm('すべてのデータ (APIキー、マスターパスワード、Clasp認証情報、プロジェクト設定) をリセットしてもよろしいですか？');
        if (confirmed) {
            console.log('Resetting all data...');
            const response = await this.sendMessageToSw({ type: 'RESET_ALL_DATA' });
            if (response && response.success) {
                // チャット履歴をクリア
                this.chatHistory = [];
                await this.saveChatHistory(); // session storage を更新
                this.elements.chatLog.innerHTML = ''; // 表示上のログを消去

                // APIキー入力画面に切り替え
                this.showView('apiKey');
                
                // 共通のメッセージ表示エリアにリセット完了を通知
                this.showError('すべてのデータがリセットされました。');
            } else {
                this.showError(response?.error || 'データのリセットに失敗しました。');
            }
        }
    }
    // --- ここまで ---
}

new Gca4gPopup();