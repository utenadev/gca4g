// clasp/Clasp.js
// GAS APIとの通信、プロジェクト/認証情報の管理、プル・プッシュロジックの実装を行うクラス

// JSDoc で定義された型を参照
// @ts-check

/**
 * @typedef {import('./interfaces.js').ClaspSettings} ClaspSettings
 * @typedef {import('./interfaces.js').ClaspCredentials} ClaspCredentials
 * @typedef {import('./interfaces.js').GasFile} GasFile
 */


class Clasp {
  /**
   * Clasp クラスのコンストラクタ
   * @param {chrome.storage.StorageArea} storage - 使用するChromeストレージ領域 (例: chrome.storage.local, chrome.storage.sync)
   */
  constructor(storage) {
    if (!storage) {
      throw new Error('Storage area is required for Clasp class.');
    }
    this.storage = storage;
    this.credentials = null; // 認証情報は初期化時に取得する
  }

  /**
   * 認証情報 (.clasprc相当) を保存
   * @param {ClaspCredentials} credentials - 保存する認証情報
   * @returns {Promise<void>}
   */
  async saveCredentials(credentials) {
    await this.storage.set({ 'clasprc': credentials });
    this.credentials = credentials;
  }

  /**
   * 認証情報 (.clasprc相当) を読み込む
   * @returns {Promise<ClaspCredentials | null>}
   */
  async loadCredentials() {
    const items = await this.storage.get('clasprc');
    this.credentials = items['clasprc'] || null;
    return this.credentials;
  }

  /**
   * プロジェクト設定 (.clasp.json相当) を保存
   * @param {ClaspSettings} settings - 保存するプロジェクト設定
   * @returns {Promise<void>}
   */
  async saveProjectSettings(settings) {
    await this.storage.set({ 'claspSettings': settings });
  }

  /**
   * プロジェクト設定 (.clasp.json相当) を読み込む
   * @returns {Promise<ClaspSettings | null>}
   */
  async loadProjectSettings() {
    const items = await this.storage.get('claspSettings');
    return items['claspSettings'] || null;
  }

  /**
   * GAS APIにリクエストを送信する共通メソッド
   * @param {string} scriptId - 対象のGASプロジェクトID
   * @param {'GET'|'POST'|'PUT'|'DELETE'} method - HTTPメソッド
   * @param {string} [endpointSuffix] - APIエンドポイントのサフィックス (例: ':getContent', ':updateContent')
   * @param {Object} [body] - リクエストボディ (PUT/POST用)
   * @returns {Promise<any>} APIレスポンスのJSON
   */
  async callGASAPI(scriptId, method, endpointSuffix = '', body) {
    if (!this.credentials || !this.credentials.accessToken) {
      throw new Error('Authentication required. Please log in using clasp.');
    }

    // 有効期限チェック（簡易）
    if (this.credentials.expiryDate && Date.now() > this.credentials.expiryDate) {
      throw new Error('Access token has expired. Please re-authenticate.');
    }

    const url = `https://script.googleapis.com/v1/scripts/${scriptId}${endpointSuffix}`;
    const response = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      ...(body && { body: JSON.stringify(body) })
    });

    if (!response.ok) {
      const errorData = await response.text(); // エラー詳細を取得
      console.error(`GAS API request failed: ${response.status} ${response.statusText}`, errorData);
      throw new Error(`API request failed: ${response.status} ${response.statusText}. Details: ${errorData}`);
    }

    return response.json();
  }

  /**
   * GASプロジェクトのファイル内容をプル (取得) する
   * @param {string} scriptId - プロジェクトID
   * @returns {Promise<GasFile[]>} プロジェクト内のファイル配列
   */
  async pullProject(scriptId) {
    if (!scriptId) {
      throw new Error('Script ID is required for pullProject.');
    }

    console.log(`Clasp: Pulling project ${scriptId}`);
    const response = await this.callGASAPI(scriptId, 'GET', ':getContent');
    console.log('Clasp: Pull response received:', response);

    // APIレスポンスから files 配列を抽出
    const gasFiles = response.files || [];

    // @ts-ignore - GAS APIのレスポンス形式に基づく暫定的な処理
    const result = gasFiles.map(file => ({
      name: file.name,
      type: file.type, // 'server_js' または 'html' など
      source: file.source || '' // source がない場合のためのデフォルト値
    }));

    console.log('Clasp: Pulled files:', result);
    return result;
  }

  /**
   * GASプロジェクトにファイルをプッシュ (アップロード) する
   * @param {string} scriptId - プロジェクトID
   * @param {GasFile[]} files - プッシュするファイルの配列
   * @returns {Promise<void>}
   */
  async pushProject(scriptId, files) {
    if (!scriptId) {
      throw new Error('Script ID is required for pushProject.');
    }
    if (!files || !Array.isArray(files)) {
      throw new Error('Files array is required for pushProject.');
    }

    console.log(`Clasp: Pushing to project ${scriptId}`, files);

    // GAS API に渡す形式 {files: [...]} を作成
    const requestBody = {
      files: files.map(file => ({
        name: file.name,
        type: file.type,
        source: file.source
      }))
    };

    await this.callGASAPI(scriptId, 'PUT', ':updateContent', requestBody);
    console.log(`Clasp: Successfully pushed to project ${scriptId}`);
  }
}

// ES Moduleとしてエクスポート
export default Clasp;