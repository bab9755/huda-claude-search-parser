// Background service worker for Claude Search Parser
console.log('Claude Search Parser: Background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Claude Search Parser installed');
  }
});

// Handle extension updates
chrome.runtime.onUpdateAvailable.addListener(() => {
  console.log('Claude Search Parser update available');
});
