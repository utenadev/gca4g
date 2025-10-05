// JSDoc を使用した型定義 (ES Module対応)

/**
 * @typedef {Object} ClaspSettings
 * @property {string} scriptId - GASプロジェクトのスクリプトID
 * @property {string} [rootDir] - ローカルのプロジェクトルートディレクトリ (任意)
 * @property {string} [projectId] - 関連付けられたGoogle Cloud Platform (GCP) プロジェクトID (任意)
 */

/**
 * @typedef {Object} ClaspCredentials
 * @property {string} accessToken - OAuth2.0 アクセストークン
 * @property {number} [expiryDate] - トークンの有効期限 (Unix timestamp in milliseconds) (任意)
 */

/**
 * @typedef {Object} GasFile
 * @property {string} name - ファイル名 (例: 'appsscript', 'Code', 'Index.html')
 * @property {'server_js'|'html'} type - ファイルタイプ ('server_js' または 'html')
 * @property {string} source - ファイルのソースコード
 */

// ES Moduleとして扱うために必要 (空のexport)
export {}