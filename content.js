chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrape') {
        try {
            const scrapedData = scrapePageData();
            sendResponse({success: true, data: scrapedData});
        } catch (error) {
            console.error('Content script error:', error);
            sendResponse({success: false, error: error.message});
        }
    }
});

function scrapePageData() {
    const data = [];
    
    // Get page metadata
    const pageInfo = {
        type: 'page_info',
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        domain: window.location.hostname
    };
    data.push(pageInfo);
    
    // Get all text content with structure
    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, article, section');
    textElements.forEach((element, index) => {
        const text = element.textContent.trim();
        if (text && text.length > 10) { // Filter out very short text
            data.push({
                type: 'text',
                element: element.tagName.toLowerCase(),
                content: text.replace(/\s+/g, ' '), // Clean whitespace
                index: index,
                xpath: getXPath(element)
            });
        }
    });
    
    // Get all links
    const links = document.querySelectorAll('a[href]');
    links.forEach((link, index) => {
        data.push({
            type: 'link',
            href: link.href,
            text: link.textContent.trim(),
            title: link.title || '',
            index: index,
            xpath: getXPath(link)
        });
    });
    
    // Get all images
    const images = document.querySelectorAll('img[src]');
    images.forEach((img, index) => {
        data.push({
            type: 'image',
            src: img.src,
            alt: img.alt || '',
            title: img.title || '',
            width: img.width || '',
            height: img.height || '',
            index: index,
            xpath: getXPath(img)
        });
    });
    
    // Get form inputs
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach((input, index) => {
        data.push({
            type: 'form_element',
            element: input.tagName.toLowerCase(),
            input_type: input.type || '',
            name: input.name || '',
            id: input.id || '',
            placeholder: input.placeholder || '',
            value: input.value || '',
            index: index,
            xpath: getXPath(input)
        });
    });
    
    // Get meta tags
    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach((meta, index) => {
        data.push({
            type: 'meta',
            name: meta.name || meta.property || '',
            content: meta.content || '',
            index: index
        });
    });
    
    // Get table data
    const tables = document.querySelectorAll('table');
    tables.forEach((table, tableIndex) => {
        const rows = table.querySelectorAll('tr');
        rows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('td, th');
            cells.forEach((cell, cellIndex) => {
                data.push({
                    type: 'table_cell',
                    table_index: tableIndex,
                    row_index: rowIndex,
                    cell_index: cellIndex,
                    content: cell.textContent.trim(),
                    is_header: cell.tagName.toLowerCase() === 'th',
                    xpath: getXPath(cell)
                });
            });
        });
    });
    
    return data;
}

function getXPath(element) {
    if (element.id !== '') {
        return 'id("' + element.id + '")';
    }
    if (element === document.body) {
        return element.tagName;
    }
    
    var ix = 0;
    var siblings = element.parentNode.childNodes;
    for (var i = 0; i < siblings.length; i++) {
        var sibling = siblings[i];
        if (sibling === element) {
            return getXPath(element.parentNode) + '/' + element.tagName + '[' + (ix + 1) + ']';
        }
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
        }
    }
}