document.addEventListener('DOMContentLoaded', function() {
    const scrapeBtn = document.getElementById('scrapeBtn');
    const status = document.getElementById('status');
    const downloadLink = document.getElementById('downloadLink');
    
    // Debug: Check if elements exist
    console.log('Elements found:', {
        scrapeBtn: !!scrapeBtn,
        status: !!status,
        downloadLink: !!downloadLink
    });
    
    scrapeBtn.addEventListener('click', async function() {
        try {
            status.textContent = 'Scraping...';
            status.className = 'status';
            scrapeBtn.disabled = true;
            if (downloadLink) {
                downloadLink.classList.add('hidden');
            }
            
            // Get the active tab
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            
            // Check if it's a valid URL for scraping
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
                throw new Error('Cannot scrape browser internal pages');
            }
            
            // Execute content script to scrape data with retry logic
            let results;
            let attempts = 0;
            const maxAttempts = 5;
            
            while (attempts < maxAttempts) {
                try {
                    results = await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('Message timeout'));
                        }, 5000);
                        
                        chrome.tabs.sendMessage(tab.id, {action: 'scrape'}, (response) => {
                            clearTimeout(timeout);
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve(response);
                            }
                        });
                    });
                    break;
                } catch (error) {
                    attempts++;
                    console.log(`Attempt ${attempts} failed:`, error.message);
                    if (attempts >= maxAttempts) {
                        throw new Error('Content script not responding. Please refresh the page and try again.');
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            if (results && results.success) {
                // Convert data to CSV in popup (where URL APIs are available)
                const csvContent = convertToCSV(results.data);
                
                // Create blob and download URL here
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const downloadUrl = URL.createObjectURL(blob);
                
                // Create filename
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const domain = new URL(tab.url).hostname;
                const filename = `scraped-${domain}-${timestamp}.csv`;
                
                // Try Chrome downloads API first
                try {
                    chrome.runtime.sendMessage({
                        action: 'downloadFile',
                        downloadUrl: downloadUrl,
                        filename: filename
                    }, (response) => {
                        if (response && response.success) {
                            status.textContent = `Successfully scraped ${results.data.length} items! Check your downloads.`;
                            status.className = 'status success';
                        } else {
                            // Fallback to direct download link
                            showDownloadLink(downloadUrl, filename, results.data.length);
                        }
                    });
                } catch (error) {
                    // Fallback to direct download link
                    showDownloadLink(downloadUrl, filename, results.data.length);
                }
            } else {
                throw new Error(results ? results.error : 'Unknown scraping error');
            }
        } catch (error) {
            console.error('Scraping error:', error);
            status.textContent = error.message;
            status.className = 'status error';
        } finally {
            scrapeBtn.disabled = false;
        }
    });
    
    function showDownloadLink(downloadUrl, filename, itemCount) {
        if (downloadLink) {
            downloadLink.href = downloadUrl;
            downloadLink.download = filename;
            downloadLink.classList.remove('hidden');
            status.textContent = `Successfully scraped ${itemCount} items! Click the download button below.`;
        } else {
            // Fallback: create download link dynamically
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            link.textContent = '📥 Download CSV';
            link.className = 'download-link';
            link.style.display = 'block';
            link.style.marginTop = '10px';
            
            const container = status.parentNode;
            container.appendChild(link);
            
            status.textContent = `Successfully scraped ${itemCount} items! Click the download link below.`;
        }
        status.className = 'status success';
    }
});

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