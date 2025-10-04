// service-worker.js

// キャッシュ用のグローバル変数
const apiCache = new Map();
// キャッシュの有効期限 (5分)
const CACHE_TIMEOUT = 5 * 60 * 1000;

// --- APIキー関連 ---
const saveApiKey = async (apiKey) => {
  await chrome.storage.local.set({ apiKey: apiKey });
  console.log('GCA4G: API Key saved (unencrypted).');
};

const getApiKey = async () => {
  const result = await chrome.storage.local.get('apiKey');
  console.log('GCA4G: API Key retrieved:', result.apiKey ? 'found' : 'not found');
  return result.apiKey;
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