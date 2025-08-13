document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup loaded');
    
    try {
        const scrapeBtn = document.getElementById('scrapeBtn');
        const status = document.getElementById('status');
        const downloadLink = document.getElementById('downloadLink');
        const scrapeMode = document.getElementById('scrapeMode');
        const modeDescription = document.getElementById('modeDescription');
        
        // Debug: Check if elements exist
        console.log('Elements found:', {
            scrapeBtn: !!scrapeBtn,
            status: !!status,
            downloadLink: !!downloadLink,
            scrapeMode: !!scrapeMode
        });
        
        if (!scrapeBtn) {
            console.error('Scrape button not found!');
            return;
        }
        
        if (!status) {
            console.error('Status element not found!');
            return;
        }
        
        // Update description based on mode selection
        if (scrapeMode && modeDescription) {
            scrapeMode.addEventListener('change', function() {
                if (this.value === 'personal') {
                    modeDescription.textContent = 'Extracts emails, phone numbers, names, passwords, SSNs, and other personal data';
                } else {
                    modeDescription.textContent = 'Scrapes all content organized by sections (text, links, images, etc.)';
                }
            });
        }
    
        scrapeBtn.addEventListener('click', async function() {
            console.log('Scrape button clicked');
            
            try {
                status.textContent = 'Scraping...';
                status.className = 'status';
                scrapeBtn.disabled = true;
                if (downloadLink) {
                    downloadLink.classList.add('hidden');
                }
                
                // Get the active tab
                const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
                console.log('Active tab:', tab.url);
                
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
                    console.log(`Scraped ${results.data.length} items`);
                    
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
                        console.error('Download API error:', error);
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
            try {
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
            } catch (error) {
                console.error('Error showing download link:', error);
                status.textContent = 'Scraping completed but download link failed';
                status.className = 'status error';
            }
        }
        
    } catch (error) {
        console.error('Popup initialization error:', error);
        // Show error in the popup if possible
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = 'Extension error: ' + error.message;
            statusEl.className = 'status error';
        }
    }
});

function convertToCSV(data) {
    if (!data || data.length === 0) {
        return 'No data scraped';
    }
    
    // Separate data by type for better organization
    const pageInfo = data.filter(item => item.type === 'page_info');
    const textContent = data.filter(item => item.type === 'text');
    const links = data.filter(item => item.type === 'link');
    const images = data.filter(item => item.type === 'image');
    const formElements = data.filter(item => item.type === 'form_element');
    const metaTags = data.filter(item => item.type === 'meta');
    const tableData = data.filter(item => item.type === 'table_cell');
    
    let csv = '';
    
    // Page Information Section
    if (pageInfo.length > 0) {
        csv += '=== PAGE INFORMATION ===\n';
        csv += 'Type,URL,Title,Domain,Timestamp\n';
        pageInfo.forEach(item => {
            csv += `"${item.type}","${item.url || ''}","${item.title || ''}","${item.domain || ''}","${item.timestamp || ''}"\n`;
        });
        csv += '\n';
    }
    
    // Text Content Section
    if (textContent.length > 0) {
        csv += '=== TEXT CONTENT ===\n';
        csv += 'Element,Content,Index,XPath\n';
        textContent.forEach(item => {
            const content = (item.content || '').replace(/"/g, '""');
            csv += `"${item.element || ''}","${content}","${item.index || ''}","${item.xpath || ''}"\n`;
        });
        csv += '\n';
    }
    
    // Links Section
    if (links.length > 0) {
        csv += '=== LINKS ===\n';
        csv += 'URL,Link Text,Title,Index,XPath\n';
        links.forEach(item => {
            const text = (item.text || '').replace(/"/g, '""');
            const title = (item.title || '').replace(/"/g, '""');
            csv += `"${item.href || ''}","${text}","${title}","${item.index || ''}","${item.xpath || ''}"\n`;
        });
        csv += '\n';
    }
    
    // Images Section
    if (images.length > 0) {
        csv += '=== IMAGES ===\n';
        csv += 'Image URL,Alt Text,Title,Width,Height,Index,XPath\n';
        images.forEach(item => {
            const alt = (item.alt || '').replace(/"/g, '""');
            const title = (item.title || '').replace(/"/g, '""');
            csv += `"${item.src || ''}","${alt}","${title}","${item.width || ''}","${item.height || ''}","${item.index || ''}","${item.xpath || ''}"\n`;
        });
        csv += '\n';
    }
    
    // Form Elements Section
    if (formElements.length > 0) {
        csv += '=== FORM ELEMENTS ===\n';
        csv += 'Element,Type,Name,ID,Placeholder,Value,Index,XPath\n';
        formElements.forEach(item => {
            const placeholder = (item.placeholder || '').replace(/"/g, '""');
            const value = (item.value || '').replace(/"/g, '""');
            csv += `"${item.element || ''}","${item.input_type || ''}","${item.name || ''}","${item.id || ''}","${placeholder}","${value}","${item.index || ''}","${item.xpath || ''}"\n`;
        });
        csv += '\n';
    }
    
    // Meta Tags Section
    if (metaTags.length > 0) {
        csv += '=== META TAGS ===\n';
        csv += 'Name/Property,Content,Index\n';
        metaTags.forEach(item => {
            const content = (item.content || '').replace(/"/g, '""');
            csv += `"${item.name || ''}","${content}","${item.index || ''}"\n`;
        });
        csv += '\n';
    }
    
    // Table Data Section
    if (tableData.length > 0) {
        csv += '=== TABLE DATA ===\n';
        csv += 'Table Index,Row,Column,Content,Is Header,XPath\n';
        tableData.forEach(item => {
            const content = (item.content || '').replace(/"/g, '""');
            csv += `"${item.table_index || ''}","${item.row_index || ''}","${item.cell_index || ''}","${content}","${item.is_header || false}","${item.xpath || ''}"\n`;
        });
        csv += '\n';
    }
    
    // Summary Section
    csv += '=== SUMMARY ===\n';
    csv += 'Data Type,Count\n';
    csv += `"Page Information","${pageInfo.length}"\n`;
    csv += `"Text Elements","${textContent.length}"\n`;
    csv += `"Links","${links.length}"\n`;
    csv += `"Images","${images.length}"\n`;
    csv += `"Form Elements","${formElements.length}"\n`;
    csv += `"Meta Tags","${metaTags.length}"\n`;
    csv += `"Table Cells","${tableData.length}"\n`;
    csv += `"Total Items","${data.length}"\n`;
    
    return csv;
}