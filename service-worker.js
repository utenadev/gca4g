// service-worker.js

// Clasp クラスのインポート
import Clasp from './clasp/Clasp.js';

// キャッシュ用のグローバル変数
const apiCache = new Map();
// キャッシュの有効期限 (5分)
const CACHE_TIMEOUT = 5 * 60 * 1000;

// --- APIキー関連 ---
// 鍵導出用のSalt (危険: 平文でコードに含むべきではない)
const importKeySalt = new Uint8Array([2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17, 20, 19, 22, 21, 24, 23, 26, 25, 28, 27, 30, 29, 32, 31]); // 32 bytes

// マスターパスワード (危険: 平文でコードに含むべきではない)
let masterPassword = null;

const setMasterPassword = async (password) => {
  if (!password) {
    console.error('Master password is required.');
    return;
  }
  masterPassword = password;
  // マスターパスワードはメモリ上にのみ保持することを推奨 (chrome.storage に保存しない)
  // 必要に応じて、chrome.storage に暗号化して保存することも可能 (追加の鍵が必要)
  console.log('Master password set (in memory).');
};

const deriveKey = async (password) => {
  if (!password) {
    throw new Error('Password is required to derive key.');
  }
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: importKeySalt,
      iterations: 100000, // 高いイテレーション数でブルートフォース攻撃を困難に
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return derivedKey;
};

const encryptData = async (data, key) => {
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(data);

  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for AES-GCM
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encodedData
  );

  const encryptedArray = new Uint8Array(encryptedBuffer);
  const result = new Uint8Array(iv.length + encryptedArray.length);
  result.set(iv, 0);
  result.set(encryptedArray, iv.length);

  return result;
};

const decryptData = async (encryptedData, key) => {
  const iv = encryptedData.slice(0, 12); // 12 bytes for AES-GCM IV
  const ciphertext = encryptedData.slice(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
};

const saveApiKey = async (apiKey) => {
  if (!masterPassword) {
    throw new Error('Master password must be set before saving API key. Use SET_MASTER_PASSWORD message.');
  }

  const key = await deriveKey(masterPassword);
  const encryptedApiKey = await encryptData(apiKey, key);

  // 暗号化されたAPIキーをUint8Arrayとして保存 (Base64等にエンコードして保存も可能)
  await chrome.storage.local.set({ apiKey: Array.from(encryptedApiKey) });
  console.log('GCA4G: API Key saved (encrypted).');
};

const getApiKey = async () => {
  if (!masterPassword) {
    console.log('GCA4G: Master password is not set.');
    return null; // パスワードがなければnullを返す
  }

  const result = await chrome.storage.local.get('apiKey');
  if (!result.apiKey) {
    console.log('GCA4G: Encrypted API Key not found.');
    return null; // 保存されていなければnullを返す
  }

  // Uint8Arrayとして保存されている暗号化されたAPIキーを復号
  const encryptedApiKeyArray = new Uint8Array(result.apiKey);
  const key = await deriveKey(masterPassword);

  try {
    const apiKey = await decryptData(encryptedApiKeyArray, key);
    console.log('GCA4G: API Key retrieved (decrypted).');
    return apiKey;
  } catch (error) {
    console.error('GCA4G: Failed to decrypt API Key:', error);
    return null; // 復号失敗時もnullを返す
  }
};

// --- Gemini API 呼び出し ---
const GEMINI_MODEL = 'gemini-flash-latest';

// キャッシュキーの生成
const getCacheKey = (prompt, files) => {
  const filesString = files.map(f => f.name + f.content).join('');
  return prompt + filesString;
};

const getCachedResponse = (prompt, files) => {
  const key = getCacheKey(prompt, files);
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TIMEOUT) {
    console.log('GCA4G: キャッシュから応答を返します');
    return cached.response;
  }
  return null;
};

const setCachedResponse = (prompt, files, response) => {
  const key = getCacheKey(prompt, files);
  apiCache.set(key, {
    response,
    timestamp: Date.now()
  });
};

const callGeminiApi = async (prompt, files) => {
  console.log('GCA4G: callGeminiApi started.');
  const cachedResponse = getCachedResponse(prompt, files);
  if (cachedResponse) {
    return cachedResponse;
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('APIキーが設定されていません。');
  }

  const systemPrompt = `あなたはGoogle Apps Script (GAS)を専門とするAIアシスタントです.
提供された複数のファイル情報とユーザーの指示に基づき、コードを修正・生成してください.
応答は必ず以下のJSON形式のみで返してください.説明や他のテキストは一切含めないでください.
{
  "updates": [
    {
      "file": "ファイル名.gs",
      "content": "新しいファイル全体のコード内容"
    }
  ]
}`;

  const fullPrompt = `${systemPrompt}\n\n--- 既存のファイル ---\n${files.map(f => `// File: ${f.name}\n${f.content}`).join('\n\n')}\n\n--- ユーザーの指示 ---\n${prompt}`;
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  for (let i = 0; i < 3; i++) {
    console.log(`GCA4G: Attempting fetch, try #${i + 1}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
          const parsedResponse = JSON.parse(result.candidates[0].content.parts[0].text);
          if (!parsedResponse?.updates || !Array.isArray(parsedResponse.updates)) {
            throw new Error(`Geminiからの応答が予期せぬ形式です。"updates"配列が見つかりません。`);
          }
          setCachedResponse(prompt, files, parsedResponse);
          return parsedResponse;
        } else {
          throw new Error('Geminiからの応答に有効なコンテンツが含まれていません。');
        }
      }

      if (response.status >= 500 && i < 2) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        continue;
      }
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('リクエストがタイムアウトしました。');
      }
      if (i === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleRequest = async () => {
    try {
      switch (request.type) {
        case 'GET_API_KEY':
          return { apiKey: await getApiKey() };
        case 'SAVE_API_KEY':
          if (!request.apiKey?.startsWith('AIzaSy')) {
            return { success: false, error: '無効な形式のAPIキーです。' };
          }
          await saveApiKey(request.apiKey);
          return { success: true };
        case 'GENERATE_CODE':
          const response = await callGeminiApi(request.prompt, request.files);
          return { success: true, data: response };
        // --- Clasp 関連のメッセージ処理 ---
        case 'PULL_PROJECT':
          // Clasp クラスのインスタンスを作成 (storage は chrome.storage.local を想定)
          const claspPull = new Clasp(chrome.storage.local);
          // 認証情報とプロジェクト設定をロード
          await claspPull.loadCredentials();
          const pullSettings = await claspPull.loadProjectSettings();
          if (!pullSettings || !pullSettings.scriptId) {
            throw new Error('プル対象のプロジェクトが設定されていません。');
          }
          // GASプロジェクトからファイルを取得
          const files = await claspPull.pullProject(pullSettings.scriptId);
          return { success: true, files: files };
        case 'PUSH_PROJECT':
          // Clasp クラスのインスタンスを作成 (storage は chrome.storage.local を想定)
          const claspPush = new Clasp(chrome.storage.local);
          // 認証情報とプロジェクト設定をロード
          await claspPush.loadCredentials();
          const pushSettings = await claspPush.loadProjectSettings();
          if (!pushSettings || !pushSettings.scriptId) {
            throw new Error('プッシュ対象のプロジェクトが設定されていません。');
          }
          // リクエストからファイルデータを取得 (存在確認)
          if (!request.files || !Array.isArray(request.files)) {
            throw new Error('プッシュするファイルが指定されていません。');
          }
          // GASプロジェクトにファイルをプッシュ
          await claspPush.pushProject(pushSettings.scriptId, request.files);
          return { success: true };
        case 'SET_PROJECT_ID':
          // Clasp クラスのインスタンスを作成 (storage は chrome.storage.local を想定)
          const claspSettings = new Clasp(chrome.storage.local);
          // リクエストからプロジェクトIDを取得
          if (!request.projectId) {
            throw new Error('プロジェクトIDが指定されていません。');
          }
          // 新しいプロジェクト設定を保存
          await claspSettings.saveProjectSettings({ scriptId: request.projectId });
          return { success: true };
        case 'SET_MASTER_PASSWORD':
          // リクエストからマスターパスワードを取得
          if (!request.password) {
            throw new Error('マスターパスワードが指定されていません。');
          }
          // マスターパスワードを設定
          await setMasterPassword(request.password);
          return { success: true };
        case 'GET_MASTER_PASSWORD_STATUS':
          // 現在のマスターパスワードが設定されているかを返す
          return { hasPassword: !!masterPassword };
        case 'AUTHENTICATE_GAS':
          // chrome.identity を使用してアクセストークンを取得
          try {
            // getAuthToken はコールバック形式なので、Promiseでラップ
            const token = await new Promise((resolve, reject) => {
              chrome.identity.getAuthToken({ interactive: true }, (token) => {
                if (chrome.runtime.lastError) {
                  console.error('GCA4G: Error getting access token:', chrome.runtime.lastError);
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  console.log('GCA4G: Access token acquired via chrome.identity.');
                  resolve(token);
                }
              });
            });

            // 取得したアクセストークンをClaspクラス経由で保存
            const claspAuth = new Clasp(chrome.storage.local);
            await claspAuth.saveCredentials({ accessToken: token });
            return { success: true };
          } catch (error) {
            console.error('GCA4G: Failed to authenticate GAS:', error);
            return { success: false, error: error.message };
          }
        // --- ここまで ---
        default:
          return { success: false, error: '不明なメッセージタイプです。' };
      }
    } catch (error) {
      console.error(`GCA4G: Error in ${request.type} handler:`, error);
      return { success: false, error: error.message };
    }
  };
  handleRequest().then(sendResponse);
  return true;
});