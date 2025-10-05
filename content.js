// content.js

console.log('GCA4G Content Script loaded.');

const getGASFiles = async () => {
  console.log('GCA4G: 実際のファイル取得ロジックは未実装です。シミュレーションデータを返します。');
  // NOTE: This is a simulation. Real implementation requires complex DOM parsing.
  return [
    { name: 'Code.gs', content: `function myFunction() {\n  // 実際のファイルが見つかりませんでした\n  Logger.log('Hello from Code.gs');\n}` },
    { name: 'Utils.js', content: `/**\n * 共通関数（シミュレーション）\n */\nfunction utilityFunction() {\n  return 'This is a utility.';\n}` }
  ];
};

// GASのスクリプトIDをURLから取得する関数 (例: https://script.google.com/d/{scriptId}/edit)
const getScriptIdFromUrl = () => {
  const path = window.location.pathname;
  // /d/<scriptId>/edit または /home/projects/<scriptId>/edit のパターンを確認
  const match = path.match(/\/(?:d|home\/projects)\/([a-zA-Z0-9_-]+)\/edit/);
  if (match && match[1]) {
    return match[1];
  }
  console.error('GCA4G: Could not find script ID in URL:', path);
  return null;
};

// URLからスクリプトIDを取得し、Service Workerに送信して保存
const sendScriptIdToSW = async () => {
  const scriptId = getScriptIdFromUrl();
  if (scriptId) {
    try {
      console.log(`GCA4G: Sending script ID ${scriptId} to Service Worker for storage.`);
      // Service WorkerにプロジェクトIDを保存するよう依頼
      await chrome.runtime.sendMessage({ type: 'SET_PROJECT_ID', projectId: scriptId });
      console.log(`GCA4G: Script ID ${scriptId} sent to Service Worker.`);
    } catch (error) {
      console.error('GCA4G: Error sending script ID to Service Worker:', error);
    }
  } else {
    console.warn('GCA4G: Script ID not found in URL, cannot send to Service Worker.');
  }
};

// GASのファイル内容を取得する関数 (clasp経由に置き換えるため、一旦空にするかエラーメッセージ)
const getGASFiles = async () => {
  // DOMからファイルを取得する代わりに、Clasp経由で取得するロジックに置き換える
  console.warn('GCA4G: getGASFiles is deprecated in favor of clasp-based pull. Using simulation.');
  // シミュレーションデータを返す代わりに、Service Worker経由でpullProjectを呼び出す処理をここに記述するか、
  // または、popup.js側が直接service-worker.jsのPULL_PROJECTメッセージを呼び出すようにする
  // ここでは、Service Worker経由でClaspから取得するための準備として、空の配列を返すかエラーを投げる
  // throw new Error('Use PULL_PROJECT message from popup/service-worker instead of DOM-based retrieval.');
  // または、Service Workerにリクエストを送信して、最新のプル結果を取得する
  // ここでは一旦エラーとして、popup.js側でPULL_PROJECTを呼ぶことを強制
  throw new Error('Use PULL_PROJECT message from popup to retrieve files via Clasp.');
};

// GASのファイルを更新する関数 (clasp経由に置き換えるため、一旦空にするかエラーメッセージ)
const applyChanges = (updates) => {
  // DOMを操作してGASエディタに変更を適用する代わりに、Clasp経由でプッシュするロジックに置き換える
  console.warn('GCA4G: applyChanges is deprecated in favor of clasp-based push. Using simulation.');
  // throw new Error('Use PUSH_PROJECT message from popup/service-worker instead of DOM-based update.');
  // ここでは一旦エラーとして、popup.js側でPUSH_PROJECTを呼ぶことを強制
  throw new Error('Use PUSH_PROJECT message from popup to update files via Clasp.');
};

// ページ読み込み時にスクリプトIDを取得してService Workerに送信
// 更に、GASエディタのUIが完全にロードされたことを検知する必要がある場合、
// 例えばDOMの特定要素の存在を確認したり、MutationObserverを使用する必要があるかもしれない
// ここでは、単純にDOM読み込み後に実行
document.addEventListener('DOMContentLoaded', sendScriptIdToSW);

// URLが変更された場合に備えて、History APIのイベントも監視 (例: GAS内でタブ移動など)
// ただし、GASエディタ内でスクリプトIDが変わるケースは稀
// window.addEventListener('popstate', sendScriptIdToSW); // 必要に応じて

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handleRequest = async () => {
    try {
      switch (message.type) {
        case 'REQUEST_FILES':
          return await getGASFiles();
        case 'UPDATE_FILES':
          return { success: applyChanges(message.updates) };
        default:
          return { success: false, error: '不明なメッセージタイプです。' };
      }
    } catch(error) {
      console.error(`GCA4G: Error handling message type ${message.type}:`, error);
      return { success: false, error: error.message };
    }
  };
  handleRequest().then(sendResponse);
  return true;
});