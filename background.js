chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'createCSV') {
        createAndDownloadCSV(request.data, request.url, request.title);
    }
});

function createAndDownloadCSV(data, url, title) {
    try {
        // Convert data to CSV format
        const csvContent = convertToCSV(data);
        
        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const domain = new URL(url).hostname;
        const filename = `scraped-${domain}-${timestamp}.csv`;
        
        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url_blob = URL.createObjectURL(blob);
        
        chrome.downloads.download({
            url: url_blob,
            filename: filename,
            saveAs: true
        });
        
        console.log('CSV created and downloaded:', filename);
    } catch (error) {
        console.error('Error creating CSV:', error);
    }
}

function convertToCSV(data) {
    if (!data || data.length === 0) {
        return 'No data scraped';
    }
    
    // Get all unique keys from all objects
    const allKeys = new Set();
    data.forEach(item => {
        Object.keys(item).forEach(key => allKeys.add(key));
    });
    
    const headers = Array.from(allKeys);
    
    // Create CSV header
    let csv = headers.map(header => `"${header}"`).join(',') + '\n';
    
    // Add data rows
    data.forEach(item => {
        const row = headers.map(header => {
            const value = item[header] || '';
            // Escape quotes and wrap in quotes
            const escapedValue = String(value).replace(/"/g, '""');
            return `"${escapedValue}"`;
        });
        csv += row.join(',') + '\n';
    });
    
    return csv;
}