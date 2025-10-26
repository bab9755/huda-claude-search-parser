// Background service worker for Claude Search Parser
console.log('Claude Search Parser: Background script loaded');

class DatabaseManager {
  constructor() {
    this.apiEndpoint = 'https://your-api-endpoint.com/api'; // Replace with your actual API
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'saveData') {
        this.saveData(request.data)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
      }
    });
  }

  async saveData(data) {
    try {
      // Validate data structure
      if (!this.validateData(data)) {
        throw new Error('Invalid data structure');
      }

      // Process and format data for database
      const processedData = this.processData(data);
      
      // Save to local storage as backup
      await this.saveToLocalStorage(processedData);
      
      // Send to remote database
      const result = await this.sendToRemoteDatabase(processedData);
      
      return { success: true, data: result };
    } catch (error) {
      console.error('Error saving data:', error);
      return { success: false, error: error.message };
    }
  }

  validateData(data) {
    return data && 
           data.conversationId && 
           data.metrics && 
           typeof data.metrics.searchCount === 'number';
  }

  processData(data) {
    // Add processing timestamp and additional metadata
    return {
      ...data,
      processedAt: new Date().toISOString(),
      version: '1.0.0',
      browserInfo: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform
      }
    };
  }

  async saveToLocalStorage(data) {
    try {
      const existingData = await chrome.storage.local.get(['claudeSearchData']);
      const allData = existingData.claudeSearchData || [];
      allData.push(data);
      
      // Keep only last 100 entries to prevent storage overflow
      const trimmedData = allData.slice(-100);
      
      await chrome.storage.local.set({ claudeSearchData: trimmedData });
      console.log('Data saved to local storage');
    } catch (error) {
      console.error('Error saving to local storage:', error);
    }
  }

  async sendToRemoteDatabase(data) {
    try {
      const response = await fetch(this.apiEndpoint + '/claude-search-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + await this.getAuthToken()
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Data sent to remote database:', result);
      return result;
    } catch (error) {
      console.error('Error sending to remote database:', error);
      // Don't throw error - local storage backup is sufficient
      return { success: false, error: error.message };
    }
  }

  async getAuthToken() {
    // Get authentication token from storage
    const auth = await chrome.storage.local.get(['authToken']);
    return auth.authToken || null;
  }

  async setAuthToken(token) {
    await chrome.storage.local.set({ authToken: token });
  }
}

// Initialize database manager
const dbManager = new DatabaseManager();

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Claude Search Parser installed');
    // Set up default settings
    chrome.storage.local.set({
      claudeSearchData: [],
      settings: {
        autoExtract: true,
        showNotifications: true,
        apiEndpoint: 'https://your-api-endpoint.com/api'
      }
    });
  }
});

// Handle extension updates
chrome.runtime.onUpdateAvailable.addListener(() => {
  console.log('Claude Search Parser update available');
});
