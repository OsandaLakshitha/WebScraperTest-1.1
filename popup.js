document.addEventListener('DOMContentLoaded', function() {
    const scrapeBtn = document.getElementById('scrapeBtn');
    const status = document.getElementById('status');
    
    scrapeBtn.addEventListener('click', async function() {
        try {
            status.textContent = 'Scraping...';
            status.className = 'status';
            scrapeBtn.disabled = true;
            
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
                // Send data to background script to create CSV
                chrome.runtime.sendMessage({
                    action: 'createCSV',
                    data: results.data,
                    url: tab.url,
                    title: tab.title
                });
                
                status.textContent = `Successfully scraped ${results.data.length} items!`;
                status.className = 'status success';
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
});