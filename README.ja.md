# GCA4G (Gemini Code Assist for GAS)

## 概要

GCA4G (Gemini Code Assist for GAS) は、Google Apps Script (GAS) エディタを拡張し、Gemini が生成・修正したコードをプル・プッシュする機能を提供する Chrome 拡張機能です。

このプロジェクトでは、GAS エディタとの連携方法を、DOM ツリーからの情報取得から、`clasp` CLI ツールの API 仕様に基づいた `Clasp` クラスによるものに変更しました。これにより、より安定した連携と GAS エディタ UI の変更への耐性を向上させます。

## 要件概要 (`my/docs/requirements.md` より)

- **Clasp認証**: Google アカウントで GAS プロジェクトにアクセスし、認証情報を安全に管理する。
- **Claspプロジェクト情報管理**: 現在作業中の GAS プロジェクトを識別・管理する。複数プロジェクトの切り替えも可能。
- **GASコードプル**: GAS プロジェクトの最新コードを取得し、コード差分を確認・編集できる。
- **GASコードプッシュ**: GCA4G 内で編集したコードを GAS プロジェクトにアップロードし、GAS エディタで確認できる。
- **Claspクラスの堅牢性**: API 呼び出し、ネットワークエラー、GAS API 変変への耐性を持つ設計。
- **ユニットテスト**: `Clasp` クラスの変更が他の機能に影響を与えないことを保証するためのテスト。

## 設計概要 (`my/docs/design.md` より)

- **構成**: `Clasp` クラス、`Service Worker`、`Popup UI` が中心。
- **Clasp クラス**: GAS API との通信、プロジェクト/認証情報の管理、プル・プッシュロジックを実装。Chrome Storage API を使用。
- **Service Worker**: `Popup` と `Clasp` クラスの中継。メッセージング、API キャッシュ管理。
- **Popup UI**: ユーザー操作（プル、プッシュ、認証）を受け付け、Service Worker にメッセージ送信。
- **データモデル**: `ClaspSettings`, `ClaspCredentials`, `GasFile` のようなインターフェースで型定義。
- **メッセージングフロー**: `Popup` -> `Service Worker` -> `Clasp` クラス -> GAS API の流れ。
- **テスト戦略**: `Clasp` クラスの各メソッドに対するユニットテスト (UT) をモック API を使用して実施。

## タスク概要 (`my/docs/tasks.md` より)

- **完了済みタスク**:
  - Clasp関連型定義の作成 (interfaces.js)
  - Claspクラスの基本構造作成 (Clasp.js) と Service Worker への組み込み
  - Popup UI へのプル・プッシュ・GAS認証ボタン追加と連携
  - GASエディタとの本格的な連携 (content.js でのスクリプトID取得とService Workerへの送信)
  - APIキーの暗号化 (マスターパスワード設定UI含む)
  - Claspクラスのユニットテスト作成
  - GAS APIの認証 (`chrome.identity`) の実装
  - 統合テストの実施
- **今後のタスク (一部)**:
  - UI/UXの改善 (プル・プッシュ操作関連)
  - 最終確認とドキュメント更新
  - `chrome.debugger` 権限の追加とその利用
  - `service-worker.js` への `chrome.runtime.lastError` チックの追加