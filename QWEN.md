### GCA4G (Gemini Code Assist for GAS) - タスクリスト

#### 完了済み
- [x] チャットUIへの変更
- [x] CSPポリシーへの対応 (外部CDNではなくローカルのCSS/JSファイルを参照)
- [x] APIキー入力UIのパスワード形式対応
- [x] 差分表示用の新規ウィンドウ機能 (diff_window.html, diff_window.js)
- [x] ローカルへのdiffライブラリ保存 (diff.min.js, diff2html.min.js, diff2html.min.css)
- [x] APIキャッシュ機能の追加 (service-worker.js)
- [x] メッセージング機能の非同期化 (popup.js, content.js, service-worker.js)
- [x] `Alt+Shift+R` でのGASエディタタブの再読み込み機能 (chrome.commands API)
- [x] `manifest.json` への `connect-src` と `commands` 権限の追加

#### 未対応・今後の課題
- [ ] GASエディタとの本格的な連携 (content.js の実装)
- [ ] APIキーの暗号化
- [ ] `chrome.debugger` 権限の追加とその利用
- [ ] `service-worker.js` への `chrome.runtime.lastError` チェックの追加
- [ ] UI/UXの改善 (エラーメッセージ、ローディング状態の表示強化)
- [ ] Gemini APIへの画像送信機能の追加 (html2canvasによるポップアップ画面スクリーンショット対応)
- [ ] (2025/10/07) Qwen Code による `popup.js` への `import` 文追加により、CSP違反 (`Refused to load the script ...`) が発生する可能性がある。`popup.html` の `<script src="popup.js"></script>` を `<script type="module" src="popup.js"></script>` に変更する必要がある。変更により、ESモジュールとして正しくロードされるようになる。 (関連: my\dbg003.png)