// Popup script for Claude Search Parser
document.addEventListener('DOMContentLoaded', function() {
  const statusElement = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const loadingElement = document.getElementById('loading');
  const statsElement = document.getElementById('stats');
  const extractBtn = document.getElementById('extractBtn');
  const viewDataBtn = document.getElementById('viewDataBtn');
  const exportBtn = document.getElementById('exportBtn');
  const autoExtractToggle = document.getElementById('autoExtractToggle');
  const notificationsToggle = document.getElementById('notificationsToggle');

  // Initialize popup
  init();

  async function init() {
    await loadSettings();
    await updateStats();
    await checkClaudeTab();
  }

  async function loadSettings() {
    try {
      const settings = await chrome.storage.local.get(['settings']);
      const config = settings.settings || {};
      
      autoExtractToggle.classList.toggle('active', config.autoExtract !== false);
      notificationsToggle.classList.toggle('active', config.showNotifications !== false);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async function updateStats() {
    try {
      const data = await chrome.storage.local.get(['claudeSearchData']);
      const searchData = data.claudeSearchData || [];
      
      if (searchData.length > 0) {
        const totalSearches = searchData.reduce((sum, item) => sum + (item.metrics?.searchCount || 0), 0);
        const totalUrls = searchData.reduce((sum, item) => sum + (item.metrics?.totalUrlsDiscovered || 0), 0);
        const totalCitations = searchData.reduce((sum, item) => sum + (item.metrics?.citationsUsed || 0), 0);
        
        document.getElementById('conversationCount').textContent = searchData.length;
        document.getElementById('totalSearches').textContent = totalSearches;
        document.getElementById('totalUrls').textContent = totalUrls;
        document.getElementById('totalCitations').textContent = totalCitations;
        
        statsElement.style.display = 'block';
      }
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  async function checkClaudeTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.url && tab.url.includes('claude.ai')) {
        statusElement.className = 'status active';
        statusText.textContent = 'Monitoring Claude conversation';
        extractBtn.disabled = false;
      } else {
        statusElement.className = 'status inactive';
        statusText.textContent = 'Please open Claude.ai';
        extractBtn.disabled = true;
      }
    } catch (error) {
      console.error('Error checking tab:', error);
      statusElement.className = 'status inactive';
      statusText.textContent = 'Error checking tab';
    }
  }

  // Event listeners
  extractBtn.addEventListener('click', async function() {
    if (extractBtn.disabled) return;
    
    loadingElement.style.display = 'block';
    extractBtn.disabled = true;
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });
      
      if (response.success) {
        showNotification('Data extracted successfully!', 'success');
        await updateStats();
      } else {
        showNotification('No data found. Ensure you have a complete conversation.', 'error');
      }
    } catch (error) {
      console.error('Error extracting data:', error);
      showNotification('Error extracting data: ' + error.message, 'error');
    } finally {
      loadingElement.style.display = 'none';
      extractBtn.disabled = false;
    }
  });

  viewDataBtn.addEventListener('click', async function() {
    try {
      const data = await chrome.storage.local.get(['claudeSearchData']);
      const searchData = data.claudeSearchData || [];
      
      if (searchData.length === 0) {
        showNotification('No data collected yet.', 'info');
        return;
      }
      
      // Open data viewer in new tab
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(createDataViewerHTML(searchData));
      chrome.tabs.create({ url: dataUrl });
      
    } catch (error) {
      console.error('Error viewing data:', error);
      showNotification('Error viewing data: ' + error.message, 'error');
    }
  });

  exportBtn.addEventListener('click', async function() {
    try {
      const data = await chrome.storage.local.get(['claudeSearchData']);
      const searchData = data.claudeSearchData || [];
      
      if (searchData.length === 0) {
        showNotification('No data to export.', 'info');
        return;
      }
      
      const csv = convertToCSV(searchData);
      downloadCSV(csv, 'claude-search-data.csv');
      showNotification('Data exported successfully!', 'success');
      
    } catch (error) {
      console.error('Error exporting data:', error);
      showNotification('Error exporting data: ' + error.message, 'error');
    }
  });

  // Settings toggles
  autoExtractToggle.addEventListener('click', async function() {
    autoExtractToggle.classList.toggle('active');
    const isActive = autoExtractToggle.classList.contains('active');
    
    const settings = await chrome.storage.local.get(['settings']);
    const config = settings.settings || {};
    config.autoExtract = isActive;
    await chrome.storage.local.set({ settings: config });
  });

  notificationsToggle.addEventListener('click', async function() {
    notificationsToggle.classList.toggle('active');
    const isActive = notificationsToggle.classList.contains('active');
    
    const settings = await chrome.storage.local.get(['settings']);
    const config = settings.settings || {};
    config.showNotifications = isActive;
    await chrome.storage.local.set({ settings: config });
  });

  // Helper functions
  function showNotification(message, type) {
    // Create temporary notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
      color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
      padding: 10px 15px;
      border-radius: 5px;
      z-index: 1000;
      font-size: 12px;
      max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  function createDataViewerHTML(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Claude Search Data</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .metric { font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Claude Search Data Collection</h1>
        <p>Total conversations: ${data.length}</p>
        <table>
          <tr>
            <th>Conversation ID</th>
            <th>Timestamp</th>
            <th>Search Count</th>
            <th>URLs Found</th>
            <th>Citations</th>
            <th>Response Length</th>
          </tr>
          ${data.map(item => `
            <tr>
              <td>${item.conversationId}</td>
              <td>${new Date(item.timestamp).toLocaleString()}</td>
              <td>${item.metrics?.searchCount || 0}</td>
              <td>${item.metrics?.totalUrlsDiscovered || 0}</td>
              <td>${item.metrics?.citationsUsed || 0}</td>
              <td>${item.metrics?.finalResponseLength || 0}</td>
            </tr>
          `).join('')}
        </table>
      </body>
      </html>
    `;
  }

  function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = [
      'Conversation ID',
      'Timestamp',
      'Query Text',
      'Search Count',
      'Total URLs',
      'Unique Domains',
      'Citations Used',
      'Citation Ratio',
      'Response Length',
      'Search Timeline',
      'Domain List'
    ];
    
    const rows = data.map(item => [
      item.conversationId || '',
      item.timestamp || '',
      (item.metrics?.queryText || '').replace(/"/g, '""'),
      item.metrics?.searchCount || 0,
      item.metrics?.totalUrlsDiscovered || 0,
      item.metrics?.uniqueDomains || 0,
      item.metrics?.citationsUsed || 0,
      item.metrics?.citationRatio || 0,
      item.metrics?.finalResponseLength || 0,
      (item.metrics?.searchTimeline || []).join(';'),
      (item.metrics?.domainList || []).join(';')
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    return csvContent;
  }

  function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
});
