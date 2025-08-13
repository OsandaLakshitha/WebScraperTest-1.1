chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'downloadFile') {
        downloadFile(request.downloadUrl, request.filename, sendResponse);
        return true; // Keep message channel open
    }
});

function downloadFile(downloadUrl, filename, sendResponse) {
    try {
        chrome.downloads.download({
            url: downloadUrl,
            filename: filename,
            saveAs: true // This will show the "Save As" dialog like normal downloads
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error('Download error:', chrome.runtime.lastError);
                if (sendResponse) sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                console.log('CSV download initiated successfully:', filename);
                console.log('Download ID:', downloadId);
                if (sendResponse) sendResponse({ success: true, downloadId: downloadId });
            }
        });
        
    } catch (error) {
        console.error('Error initiating download:', error);
        if (sendResponse) sendResponse({ success: false, error: error.message });
    }
}