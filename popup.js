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
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                throw new Error('Cannot scrape Chrome internal pages');
            }
            
            // Inject content script first, then send message
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
            
            // Wait a bit for script to load
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Execute content script to scrape data with retry logic
            let results;
            let attempts = 0;
            const maxAttempts = 3;
            
            while (attempts < maxAttempts) {
                try {
                    results = await chrome.tabs.sendMessage(tab.id, {action: 'scrape'});
                    break;
                } catch (error) {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        throw error;
                    }
                    await new Promise(resolve => setTimeout(resolve, 200));
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
                
                status.textContent = 'Successfully scraped and downloaded!';
                status.className = 'status success';
            } else {
                throw new Error('Failed to scrape data');
            }
        } catch (error) {
            console.error('Scraping error:', error);
            if (error.message.includes('Could not establish connection')) {
                status.textContent = 'Error: Refresh the page and try again';
            } else {
                status.textContent = 'Error: ' + error.message;
            }
            status.className = 'status error';
        } finally {
            scrapeBtn.disabled = false;
        }
    });
});