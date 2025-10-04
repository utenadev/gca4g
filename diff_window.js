document.addEventListener('DOMContentLoaded', async () => {
    const diffContainer = document.getElementById('diff-container');
    const loadingDiv = document.getElementById('loading');
    const closeButton = document.getElementById('close-btn');
    const applyButton = document.getElementById('apply-btn');

    let diffData = null;
    let originalFiles = [];

    let saveStateInterval = setInterval(async () => {
        try {
            const currentWindow = await chrome.windows.getCurrent();
            const { left, top, width, height } = currentWindow;
            await chrome.storage.local.set({ diffWindowState: { left, top, width, height } });
        } catch (error) {
            clearInterval(saveStateInterval);
        }
    }, 1000);

    window.addEventListener('beforeunload', () => {
        clearInterval(saveStateInterval);
    });

    const displayError = (message) => {
        diffContainer.innerHTML = `<div class="p-4 text-red-600">${message}</div>`;
    };

    try {
        const result = await chrome.storage.local.get(['tempDiffData', 'tempOriginalFiles']);
        if (!result.tempDiffData || !result.tempOriginalFiles) {
            throw new Error('表示する差分データが見つかりませんでした。');
        }
        diffData = result.tempDiffData;
        originalFiles = result.tempOriginalFiles;

        await chrome.storage.local.remove(['tempDiffData', 'tempOriginalFiles']);

        loadingDiv.classList.add('hidden');
        diffContainer.innerHTML = '';

        diffData.updates.forEach(update => {
            const originalFile = originalFiles.find(f => f.name === update.file);
            const originalContent = originalFile ? originalFile.content : '';
            const diffString = Diff.createTwoFilesPatch(update.file, update.file, originalContent, update.content, '', '');
            const diffHtml = Diff2Html.html(diffString, {
                drawFileList: true,
                matching: 'lines',
                outputFormat: 'side-by-side'
            });
            const fileDiffContainer = document.createElement('div');
            fileDiffContainer.innerHTML = diffHtml;
            diffContainer.appendChild(fileDiffContainer);
        });
    } catch (error) {
        console.error('差分表示エラー:', error);
        displayError(`エラー: ${error.message}`);
    }

    closeButton.addEventListener('click', () => window.close());
    applyButton.addEventListener('click', async () => {
        if (!diffData) return;
        try {
            const tabs = await chrome.tabs.query({ url: "https://script.google.com/home/projects/*" });
            if (tabs.length === 0) {
                 alert('GASエディタのタブが見つかりません。');
                 return;
            }
            const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'UPDATE_FILES', updates: diffData.updates });
            if (response?.success) {
                alert('コードがコンソールに出力されました（シミュレーション）。');
                window.close();
            } else {
                alert(`コードの適用に失敗しました: ${response?.error || '不明なエラー'}`);
            }
        } catch (e) {
            alert(`エラーが発生しました: ${e.message}`);
        }
    });
});