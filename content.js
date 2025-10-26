// Content script for Claude Search Parser
console.log('Claude Search Parser: Content script loaded');

class ClaudeDataExtractor {
  constructor() {
    this.conversationData = null;
    this.isExtracting = false;
    this.init();
  }

  init() {
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupExtraction());
    } else {
      this.setupExtraction();
    }
  }

  setupExtraction() {
    // Extract conversation ID and organization ID from current URL
    this.extractIdsFromUrl();
    
    // Set up automatic organization ID capture from network requests
    this.setupOrgIdCapture();
    
    // Add extraction button to Claude interface
    this.addExtractionButton();
    
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'extractData') {
        this.extractConversationData().then(data => {
          sendResponse({ success: true, data });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true; // Keep message channel open for async response
      }
    });
  }

  setupOrgIdCapture() {
    // Override fetch to capture organization ID from API requests
    const originalFetch = window.fetch;
    const self = this;
    
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      // Check if this request contains organization ID
      if (args[0] && typeof args[0] === 'string' && args[0].includes('/organizations/')) {
        const orgMatch = args[0].match(/\/organizations\/([a-f0-9-]{36})\//);
        if (orgMatch && !self.organizationId) {
          self.organizationId = orgMatch[1];
          localStorage.setItem('claude_organization_id', orgMatch[1]);
          console.log('Claude Search Parser: Auto-captured organization ID from fetch:', orgMatch[1]);
          self.updateExtractionButton(true);
        }
      }
      
      return response;
    };
    
    // Also override XMLHttpRequest
    const originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
      const xhr = new originalXHR();
      const originalOpen = xhr.open;
      
      xhr.open = function(method, url, ...args) {
        if (url && url.includes('/organizations/')) {
          const orgMatch = url.match(/\/organizations\/([a-f0-9-]{36})\//);
          if (orgMatch && !self.organizationId) {
            self.organizationId = orgMatch[1];
            localStorage.setItem('claude_organization_id', orgMatch[1]);
            console.log('Claude Search Parser: Auto-captured organization ID from XHR:', orgMatch[1]);
            self.updateExtractionButton(true);
          }
        }
        return originalOpen.apply(this, [method, url, ...args]);
      };
      
      return xhr;
    };
  }

  extractIdsFromUrl() {
    // Extract conversation ID and organization ID from the current URL
    const currentUrl = window.location.href;
    console.log('Claude Search Parser: Current URL:', currentUrl);
    
    // Look for conversation ID in URL patterns like:
    // https://claude.ai/chat/f58f12ab-6116-4e9f-a58b-42fea6784839
    const chatMatch = currentUrl.match(/\/chat\/([a-f0-9-]+)/);
    if (chatMatch) {
      this.conversationId = chatMatch[1];
      console.log('Claude Search Parser: Found conversation ID:', this.conversationId);
    }
    
    // Try to get organization ID from localStorage or other sources
    this.organizationId = this.getOrganizationId();
    
    console.log('Claude Search Parser: Organization ID:', this.organizationId);
  }

  getOrganizationId() {
    // Try to extract organization ID from various sources
    try {
      // Check if it's stored in localStorage
      const orgId = localStorage.getItem('claude_organization_id');
      if (orgId) {
        console.log('Claude Search Parser: Found organization ID in localStorage:', orgId);
        return orgId;
      }
      
      // Check if it's in sessionStorage
      const sessionOrgId = sessionStorage.getItem('claude_organization_id');
      if (sessionOrgId) {
        console.log('Claude Search Parser: Found organization ID in sessionStorage:', sessionOrgId);
        return sessionOrgId;
      }
      
      // Try to extract from page source or global variables
      const extractedOrgId = this.extractOrgIdFromPage();
      if (extractedOrgId) {
        console.log('Claude Search Parser: Extracted organization ID from page:', extractedOrgId);
        // Save it for future use
        localStorage.setItem('claude_organization_id', extractedOrgId);
        return extractedOrgId;
      }
      
      console.log('Claude Search Parser: No organization ID found');
      return null;
    } catch (error) {
      console.log('Claude Search Parser: Error getting organization ID:', error);
      return null;
    }
  }

  extractOrgIdFromPage() {
    // Method 1: Look in window object for Claude's global state
    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.organization) {
      return window.__INITIAL_STATE__.organization.id;
    }
    
    // Method 2: Look for organization ID in common global variable patterns
    const possibleGlobals = [
      'window.claude?.organizationId',
      'window.organizationId',
      'window.user?.organizationId',
      'window.app?.organizationId',
      'window.__CLAUDE_ORG_ID__'
    ];
    
    for (const globalPath of possibleGlobals) {
      try {
        const value = eval(globalPath);
        if (value && typeof value === 'string' && value.match(/^[a-f0-9-]{36}$/)) {
          return value;
        }
      } catch (e) {
        // Continue to next option
      }
    }
    
    // Method 3: Parse from script tags that might contain the organization ID
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent || script.innerHTML;
      if (content) {
        // Look for organization ID patterns in the script content
        const orgMatches = [
          content.match(/organization[_-]?id["\s]*[:=]["\s]*["']([a-f0-9-]{36})["']/i),
          content.match(/\/organizations\/([a-f0-9-]{36})\//),
          content.match(/org[_-]?id["\s]*[:=]["\s]*["']([a-f0-9-]{36})["']/i)
        ];
        
        for (const match of orgMatches) {
          if (match && match[1]) {
            return match[1];
          }
        }
      }
    }
    
    return null;
  }

  async fetchConversationData() {
    if (!this.conversationId) {
      throw new Error('No conversation ID found in URL');
    }
    
    if (!this.organizationId) {
      throw new Error('Organization ID not found. Please set it manually.');
    }
    
    const apiUrl = `https://claude.ai/api/organizations/${this.organizationId}/chat_conversations/${this.conversationId}?tree=True&rendering_mode=messages&render_all_tools=true`;
    
    console.log('Claude Search Parser: Fetching data from:', apiUrl);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Include cookies for authentication
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Claude Search Parser: Successfully fetched conversation data:', data);
      
      this.conversationData = data;
      this.updateExtractionButton(true);
      
      return data;
    } catch (error) {
      console.error('Claude Search Parser: Error fetching conversation data:', error);
      throw error;
    }
  }

  handleJsonResponse(data, url) {
    try {
      console.log('Claude Search Parser: Received data from URL:', url);
      console.log('Claude Search Parser: Data structure:', data);
      
      // Handle different data structures
      if (Array.isArray(data)) {
        // This is likely the search results array we see in the Network tab
        this.conversationData = {
          searchResults: data,
          url: url,
          timestamp: new Date().toISOString()
        };
        console.log('Claude Search Parser: Search results captured', data);
        this.updateExtractionButton(true);
      } else if (data.chat_messages && data.uuid) {
        // This is the full conversation structure
        this.conversationData = data;
        console.log('Claude Search Parser: Full conversation data captured', data);
        this.updateExtractionButton(true);
      } else if (data.type && data.text) {
        // This might be a single message or search result
        this.conversationData = {
          messages: [data],
          url: url,
          timestamp: new Date().toISOString()
        };
        console.log('Claude Search Parser: Single message captured', data);
        this.updateExtractionButton(true);
      }
    } catch (error) {
      console.log('Claude Search Parser: Error processing data', error);
    }
  }

  addExtractionButton() {
    // Find a good place to add the button in Claude's interface
    const targetElement = document.querySelector('[data-testid="conversation-header"]') || 
                         document.querySelector('main') || 
                         document.body;
    
    if (targetElement && !document.getElementById('claude-parser-button')) {
      const buttonContainer = document.createElement('div');
      buttonContainer.id = 'claude-parser-container';
      buttonContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
      `;
      
      const extractButton = document.createElement('button');
      extractButton.id = 'claude-parser-button';
      extractButton.innerHTML = '📊 Extract Search Data';
      extractButton.style.cssText = `
        background: #007bff;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      
      const manualButton = document.createElement('button');
      manualButton.id = 'claude-parser-manual';
      manualButton.innerHTML = '🔍 Manual Extract';
      manualButton.style.cssText = `
        background: #28a745;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 12px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      
      extractButton.addEventListener('click', () => this.extractAndShowData());
      manualButton.addEventListener('click', () => this.manualExtractFromNetwork());
      
      buttonContainer.appendChild(extractButton);
      buttonContainer.appendChild(manualButton);
      targetElement.appendChild(buttonContainer);
    }
  }

  showOrganizationIdModal() {
    const modal = document.createElement('div');
    modal.id = 'claude-parser-org-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 10001;
      display: flex;
      justify-content: center;
      align-items: center;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      color: black;
      padding: 20px;
      border-radius: 10px;
      max-width: 500px;
      max-height: 80%;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    content.innerHTML = `
      <h2 style="color: black; margin-top: 0;">🔑 Organization ID Required</h2>
      <p style="color: black;">To fetch conversation data, we need your organization ID.</p>
      <p style="color: black;"><strong>How to find it:</strong></p>
      <ol style="color: black;">
        <li>Open Chrome DevTools (F12)</li>
        <li>Go to the Network tab</li>
        <li>Refresh the page (F5)</li>
        <li>Look for a request to: <code style="background: #f5f5f5; padding: 2px 4px; border-radius: 3px; color: #333;">claude.ai/api/organizations/[ID]/chat_conversations/...</code></li>
        <li>Copy the organization ID (the UUID after "organizations/")</li>
      </ol>
      
      <div style="margin: 20px 0;">
        <label for="org-id-input" style="display: block; margin-bottom: 5px; font-weight: bold; color: black;">Organization ID:</label>
        <input type="text" id="org-id-input" placeholder="e127858f-fc0e-4af8-82a4-92373f5c3333" style="
          width: 100%;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 5px;
          font-family: monospace;
          font-size: 12px;
          color: black;
          background: white;
        ">
      </div>
      
      <div style="text-align: center; margin-top: 20px;">
        <button id="save-org-id" style="
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          margin-right: 10px;
        ">Save & Extract</button>
        
        <button id="close-org-modal" style="
          background: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
        ">Close</button>
      </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Add event listeners
    document.getElementById('save-org-id').addEventListener('click', async () => {
      const orgId = document.getElementById('org-id-input').value.trim();
      if (!orgId) {
        alert('Please enter an organization ID');
        return;
      }
      
      // Save organization ID
      this.organizationId = orgId;
      localStorage.setItem('claude_organization_id', orgId);
      
      document.body.removeChild(modal);
      
      // Now try to extract data
      try {
        await this.fetchConversationData();
        const extractedData = await this.extractConversationData();
        this.showDataPreview(extractedData);
      } catch (error) {
        alert('Error fetching data: ' + error.message);
      }
    });

    document.getElementById('close-org-modal').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  manualExtractFromNetwork() {
    // Show the organization ID modal first
    this.showOrganizationIdModal();
  }

  updateExtractionButton(hasData) {
    const button = document.getElementById('claude-parser-button');
    if (button) {
      button.style.background = hasData ? '#28a745' : '#007bff';
      button.innerHTML = hasData ? '✅ Data Ready' : '📊 Extract Search Data';
    }
  }

  async extractAndShowData() {
    try {
      // First try to fetch fresh data from the API
      if (!this.conversationData || !this.organizationId) {
        // Try to get organization ID again in case it was captured since last check
        if (!this.organizationId) {
          this.organizationId = this.getOrganizationId();
        }
        
        if (!this.organizationId) {
          throw new Error('Organization ID not found. Please use the Manual Extract button to set it up.');
        }
        
        await this.fetchConversationData();
      }
      
      const extractedData = await this.extractConversationData();
      this.showDataPreview(extractedData);
    } catch (error) {
      console.error('Error extracting data:', error);
      
      if (error.message.includes('Organization ID not found')) {
        // Only show modal if we really can't find the organization ID
        this.showOrganizationIdModal();
      } else {
        alert('Error extracting data: ' + error.message);
      }
    }
  }

  async extractConversationData() {
    if (!this.conversationData) {
      throw new Error('No conversation data available');
    }

    const data = this.conversationData;
    
    // Handle different data structures
    if (data.searchResults && Array.isArray(data.searchResults)) {
      // This is the search results array from the Network tab
      return this.extractFromSearchResults(data);
    } else if (data.chat_messages) {
      // This is the full conversation structure from the API
      return this.extractFromFullConversation(data);
    } else if (data.messages) {
      // This is a single message or partial data
      return this.extractFromMessages(data);
    } else if (data.name || data.uuid) {
      // This is the API response structure
      return this.extractFromApiResponse(data);
    } else {
      throw new Error('Unknown data structure');
    }
  }

  extractFromApiResponse(data) {
    // Extract from the API response structure
    const messages = data.chat_messages || [];
    
    // Find messages with search activities
    const searchMessages = messages.filter(msg => 
      msg.content && msg.content.some(item => 
        (item.type === 'tool_use' && item.name === 'web_search') ||
        (item.type === 'tool_result' && item.name === 'web_search')
      )
    );

    if (searchMessages.length === 0) {
      throw new Error('No search activities found in this conversation');
    }

    // Extract all search activities and results
    const allSearchActivities = [];
    const allSearchResults = [];
    const allCitations = [];

    searchMessages.forEach(msg => {
      if (msg.content) {
        msg.content.forEach(item => {
          if (item.type === 'tool_use' && item.name === 'web_search') {
            allSearchActivities.push(item);
          } else if (item.type === 'tool_result' && item.name === 'web_search') {
            allSearchResults.push(item);
          } else if (item.type === 'text' && item.citations) {
            allCitations.push(...item.citations);
          }
        });
      }
    });

    // Extract URLs and domains from search results
    const allUrls = [];
    const domains = new Set();
    
    allSearchResults.forEach(result => {
      if (result.content) {
        result.content.forEach(item => {
          if (item.url) {
            allUrls.push(item.url);
            try {
              const domain = new URL(item.url).hostname;
              domains.add(domain);
            } catch (e) {
              // Invalid URL, skip
            }
          }
          
          if (item.metadata && item.metadata.site_domain) {
            domains.add(item.metadata.site_domain);
          }
        });
      }
    });

    // Calculate search timeline
    const searchTimeline = allSearchActivities.map((search, index) => {
      if (index === 0) return 0;
      const prevSearch = allSearchActivities[index - 1];
      const timeDiff = new Date(search.start_timestamp) - new Date(prevSearch.start_timestamp);
      return timeDiff / 1000; // Convert to seconds
    });

    // Get user query
    const userMessage = messages.find(msg => msg.sender === 'human');
    const queryText = userMessage?.content?.[0]?.text || '';

    // Calculate high priority metrics
    const highPriorityMetrics = this.calculateHighPriorityMetrics(
      allUrls, domains, allCitations, allSearchActivities, searchMessages
    );

    const metrics = {
      queryText: queryText.substring(0, 500), // Truncate for storage
      searchCount: allSearchActivities.length,
      totalUrlsDiscovered: allUrls.length,
      uniqueDomains: domains.size,
      citationsUsed: allCitations.length,
      citationRatio: allUrls.length > 0 ? allCitations.length / allUrls.length : 0,
      searchQueries: allSearchActivities.map(s => s.input?.query || ''),
      finalResponseLength: searchMessages.reduce((sum, msg) => {
        return sum + (msg.content?.filter(item => item.type === 'text')
          .map(item => item.text || '')
          .join('').length || 0);
      }, 0),
      searchTimeline: searchTimeline,
      domainDiversity: domains.size,
      responseConstructionTime: 0, // Can't calculate from API response
      timestamp: data.created_at || data.timestamp,
      uniqueUrls: [...new Set(allUrls)],
      domainList: Array.from(domains),
      citationSources: allCitations.map(c => ({
        title: c.title,
        url: c.url,
        domain: c.metadata?.site_domain
      })),
      // High priority metrics
      ...highPriorityMetrics
    };

    return {
      conversationId: data.uuid || this.conversationId,
      timestamp: data.created_at || data.timestamp,
      metrics: metrics,
      rawData: data
    };
  }

  calculateHighPriorityMetrics(allUrls, domains, allCitations, allSearchActivities, searchMessages) {
    // Ensure we have valid arrays
    const urls = Array.isArray(allUrls) ? allUrls : [];
    const citations = Array.isArray(allCitations) ? allCitations : [];
    const searchActivities = Array.isArray(allSearchActivities) ? allSearchActivities : [];
    const messages = Array.isArray(searchMessages) ? searchMessages : [];
    
    // 1. Domain Inclusion Rate - Percentage of discovered URLs that get cited per domain
    const domainInclusionRate = {};
    const domainUrlCounts = {};
    const domainCitationCounts = {};
    
    // Count URLs per domain
    urls.forEach(url => {
      try {
        if (url && typeof url === 'string') {
          const domain = new URL(url).hostname;
          domainUrlCounts[domain] = (domainUrlCounts[domain] || 0) + 1;
        }
      } catch (e) {
        // Invalid URL, skip
      }
    });
    
    // Count citations per domain
    citations.forEach(citation => {
      if (citation && citation.metadata?.site_domain) {
        domainCitationCounts[citation.metadata.site_domain] = 
          (domainCitationCounts[citation.metadata.site_domain] || 0) + 1;
      }
    });
    
    // Calculate inclusion rate per domain
    Object.keys(domainUrlCounts).forEach(domain => {
      const urlCount = domainUrlCounts[domain];
      const citationCount = domainCitationCounts[domain] || 0;
      domainInclusionRate[domain] = urlCount > 0 ? citationCount / urlCount : 0;
    });
    
    // 2. Search Refinement Rate - How often queries are modified between searches
    const searchQueries = searchActivities.map(s => s?.input?.query || '');
    let refinementCount = 0;
    for (let i = 1; i < searchQueries.length; i++) {
      if (searchQueries[i] !== searchQueries[i - 1]) {
        refinementCount++;
      }
    }
    const searchRefinementRate = searchQueries.length > 1 ? 
      refinementCount / (searchQueries.length - 1) : 0;
    
    // 3. Citation Density - Citations per 100 words in response
    const responseText = messages.reduce((sum, msg) => {
      if (msg && msg.content) {
        return sum + (msg.content.filter(item => item.type === 'text')
          .map(item => item.text || '')
          .join('') || '');
      }
      return sum;
    }, '');
    const wordCount = responseText.split(/\s+/).filter(word => word.length > 0).length;
    const citationDensity = wordCount > 0 ? (citations.length / wordCount) * 100 : 0;
    
    // 4. Domain Authority Score - Weighted scoring based on domain types
    const domainAuthorityScores = {
      'wikipedia.org': 10,
      'en.wikipedia.org': 10,
      'britannica.com': 9,
      'nature.com': 9,
      'scholar.google.com': 8,
      'pubmed.ncbi.nlm.nih.gov': 8,
      'arxiv.org': 8,
      'news.ycombinator.com': 7,
      'reddit.com': 5,
      'medium.com': 4,
      'blogspot.com': 3,
      'wordpress.com': 3,
      'github.com': 6,
      'stackoverflow.com': 7,
      'stackexchange.com': 7
    };
    
    const domainAuthorityData = {};
    let totalAuthorityScore = 0;
    let authorityWeightedDomains = 0;
    
    Array.from(domains).forEach(domain => {
      const authorityScore = domainAuthorityScores[domain] || 3; // Default score for unknown domains
      const urlCount = domainUrlCounts[domain] || 0;
      const citationCount = domainCitationCounts[domain] || 0;
      
      domainAuthorityData[domain] = {
        authorityScore,
        urlCount,
        citationCount,
        inclusionRate: domainInclusionRate[domain] || 0
      };
      
      totalAuthorityScore += authorityScore * urlCount;
      authorityWeightedDomains += urlCount;
    });
    
    const averageDomainAuthority = authorityWeightedDomains > 0 ? 
      totalAuthorityScore / authorityWeightedDomains : 0;
    
    // 5. Search Timeline Analysis - Advanced timing metrics
    const searchTimeline = searchActivities.map((search, index) => {
      if (index === 0) return 0;
      const prevSearch = searchActivities[index - 1];
      if (search?.start_timestamp && prevSearch?.start_timestamp) {
        const timeDiff = new Date(search.start_timestamp) - new Date(prevSearch.start_timestamp);
        return timeDiff / 1000; // Convert to seconds
      }
      return 0;
    });
    
    const timelineMetrics = {
      averageTimeBetweenSearches: searchTimeline.length > 1 ? 
        searchTimeline.slice(1).reduce((sum, time) => sum + time, 0) / (searchTimeline.length - 1) : 0,
      minTimeBetweenSearches: searchTimeline.length > 1 ? Math.min(...searchTimeline.slice(1)) : 0,
      maxTimeBetweenSearches: searchTimeline.length > 1 ? Math.max(...searchTimeline.slice(1)) : 0,
      searchAcceleration: searchTimeline.length > 2 ? 
        (searchTimeline[searchTimeline.length - 1] - searchTimeline[1]) / (searchTimeline.length - 2) : 0
    };
    
    return {
      // High priority metrics
      domainInclusionRate: domainInclusionRate || {},
      searchRefinementRate: searchRefinementRate || 0,
      citationDensity: citationDensity || 0,
      averageDomainAuthority: averageDomainAuthority || 0,
      domainAuthorityData: domainAuthorityData || {},
      timelineMetrics: timelineMetrics || {
        averageTimeBetweenSearches: 0,
        minTimeBetweenSearches: 0,
        maxTimeBetweenSearches: 0,
        searchAcceleration: 0
      },
      
      // Additional useful metrics
      totalDomainsWithCitations: Object.keys(domainCitationCounts).length || 0,
      mostCitedDomain: Object.keys(domainCitationCounts).length > 0 ? 
        Object.keys(domainCitationCounts).reduce((a, b) => 
          domainCitationCounts[a] > domainCitationCounts[b] ? a : b, '') : '',
      leastCitedDomain: Object.keys(domainUrlCounts).length > 0 ? 
        Object.keys(domainUrlCounts).reduce((a, b) => 
          (domainInclusionRate[a] || 0) < (domainInclusionRate[b] || 0) ? a : b, '') : '',
      searchQuerySimilarity: this.calculateQuerySimilarity(searchQueries) || 0
    };
  }

  calculateQuerySimilarity(queries) {
    if (!queries || queries.length < 2) return 0;
    
    // Simple similarity based on common words
    const queryWords = queries.map(query => {
      if (!query || typeof query !== 'string') return new Set();
      return new Set(query.toLowerCase().split(/\s+/).filter(word => word.length > 2));
    });
    
    let totalSimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < queryWords.length - 1; i++) {
      for (let j = i + 1; j < queryWords.length; j++) {
        if (queryWords[i].size === 0 && queryWords[j].size === 0) {
          totalSimilarity += 1; // Both empty = 100% similar
        } else if (queryWords[i].size === 0 || queryWords[j].size === 0) {
          totalSimilarity += 0; // One empty = 0% similar
        } else {
          const intersection = new Set([...queryWords[i]].filter(x => queryWords[j].has(x)));
          const union = new Set([...queryWords[i], ...queryWords[j]]);
          const similarity = union.size > 0 ? intersection.size / union.size : 0;
          totalSimilarity += similarity;
        }
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  extractFromSearchResults(data) {
    const searchResults = data.searchResults;
    
    // Extract URLs and domains
    const allUrls = [];
    const domains = new Set();
    const citations = [];
    
    searchResults.forEach(item => {
      if (item.url) {
        allUrls.push(item.url);
        try {
          const domain = new URL(item.url).hostname;
          domains.add(domain);
        } catch (e) {
          // Invalid URL, skip
        }
      }
      
      if (item.metadata && item.metadata.site_domain) {
        domains.add(item.metadata.site_domain);
      }
      
      if (item.is_citable && item.text) {
        citations.push({
          text: item.text,
          url: item.url,
          title: item.title
        });
      }
    });

    // Calculate high priority metrics for search results
    const highPriorityMetrics = this.calculateHighPriorityMetrics(
      allUrls, domains, citations, [], [] // Empty arrays for search activities and messages
    );

    const metrics = {
      queryText: 'Search results from Claude conversation',
      searchCount: 1, // We can't determine this from search results alone
      totalUrlsDiscovered: allUrls.length,
      uniqueDomains: domains.size,
      citationsUsed: citations.length,
      citationRatio: allUrls.length > 0 ? citations.length / allUrls.length : 0,
      searchQueries: ['Extracted from search results'],
      finalResponseLength: searchResults.reduce((sum, item) => sum + (item.text ? item.text.length : 0), 0),
      searchTimeline: [0],
      domainDiversity: domains.size,
      responseConstructionTime: 0,
      timestamp: data.timestamp,
      uniqueUrls: [...new Set(allUrls)],
      domainList: Array.from(domains),
      citationSources: citations.map(c => ({
        title: c.title,
        url: c.url,
        text: c.text
      })),
      // High priority metrics
      ...highPriorityMetrics
    };

    return {
      conversationId: data.url || 'unknown',
      timestamp: data.timestamp,
      metrics: metrics,
      rawData: data
    };
  }

  extractFromFullConversation(data) {
    const messages = data.chat_messages || [];
    
    // Find the assistant's response with search activities
    const assistantMessage = messages.find(msg => 
      msg.sender === 'assistant' && 
      msg.content && 
      msg.content.some(item => item.type === 'tool_use' && item.name === 'web_search')
    );

    if (!assistantMessage) {
      throw new Error('No search activities found in this conversation');
    }

    // Extract search activities
    const searchActivities = assistantMessage.content.filter(item => 
      item.type === 'tool_use' && item.name === 'web_search'
    );

    const searchResults = assistantMessage.content.filter(item => 
      item.type === 'tool_result' && item.name === 'web_search'
    );

    // Calculate metrics
    const metrics = this.calculateMetrics(data, searchActivities, searchResults, assistantMessage);
    
    return {
      conversationId: data.uuid,
      timestamp: data.created_at,
      metrics: metrics,
      rawData: data
    };
  }

  extractFromMessages(data) {
    // Handle single message or partial data
    const messages = data.messages || [];
    
    const metrics = {
      queryText: 'Partial conversation data',
      searchCount: 0,
      totalUrlsDiscovered: 0,
      uniqueDomains: 0,
      citationsUsed: 0,
      citationRatio: 0,
      searchQueries: [],
      finalResponseLength: 0,
      searchTimeline: [],
      domainDiversity: 0,
      responseConstructionTime: 0,
      timestamp: data.timestamp,
      uniqueUrls: [],
      domainList: [],
      citationSources: []
    };

    return {
      conversationId: data.url || 'unknown',
      timestamp: data.timestamp,
      metrics: metrics,
      rawData: data
    };
  }

  calculateMetrics(conversationData, searchActivities, searchResults, assistantMessage) {
    const userMessage = conversationData.chat_messages.find(msg => msg.sender === 'human');
    const queryText = userMessage?.content?.[0]?.text || '';

    // Extract all URLs from search results
    const allUrls = [];
    const domains = new Set();
    
    searchResults.forEach(result => {
      if (result.content) {
        result.content.forEach(item => {
          if (item.url) {
            allUrls.push(item.url);
            try {
              const domain = new URL(item.url).hostname;
              domains.add(domain);
            } catch (e) {
              // Invalid URL, skip
            }
          }
        });
      }
    });

    // Extract citations
    const citations = assistantMessage.content
      .filter(item => item.type === 'text' && item.citations)
      .flatMap(item => item.citations || []);

    // Calculate search timeline
    const searchTimeline = searchActivities.map((search, index) => {
      if (index === 0) return 0;
      const prevSearch = searchActivities[index - 1];
      const timeDiff = new Date(search.start_timestamp) - new Date(prevSearch.start_timestamp);
      return timeDiff / 1000; // Convert to seconds
    });

    // Calculate response construction time
    const responseStart = assistantMessage.content.find(item => item.type === 'text')?.start_timestamp;
    const responseEnd = assistantMessage.content[assistantMessage.content.length - 1]?.stop_timestamp;
    const responseTime = responseStart && responseEnd ? 
      (new Date(responseEnd) - new Date(responseStart)) / 1000 : 0;

    return {
      queryText: queryText.substring(0, 500), // Truncate for storage
      searchCount: searchActivities.length,
      totalUrlsDiscovered: allUrls.length,
      uniqueDomains: domains.size,
      citationsUsed: citations.length,
      citationRatio: allUrls.length > 0 ? citations.length / allUrls.length : 0,
      searchQueries: searchActivities.map(s => s.input?.query || ''),
      finalResponseLength: assistantMessage.content
        .filter(item => item.type === 'text')
        .map(item => item.text || '')
        .join('').length,
      searchTimeline: searchTimeline,
      domainDiversity: domains.size,
      responseConstructionTime: responseTime,
      timestamp: conversationData.created_at,
      uniqueUrls: [...new Set(allUrls)],
      domainList: Array.from(domains),
      citationSources: citations.map(c => ({
        title: c.title,
        url: c.url,
        domain: c.metadata?.site_domain
      }))
    };
  }

  showDataPreview(data) {
    // Create a modal to show the extracted data
    const modal = document.createElement('div');
    modal.id = 'claude-parser-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 10001;
      display: flex;
      justify-content: center;
      align-items: center;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      color: black;
      padding: 20px;
      border-radius: 10px;
      max-width: 80%;
      max-height: 80%;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    content.innerHTML = `
      <h2 style="color: black; margin-top: 0;">📊 Extracted Search Data</h2>
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: black;">Basic Metrics:</h3>
        <ul style="color: black;">
          <li><strong>Search Count:</strong> ${data.metrics.searchCount}</li>
          <li><strong>URLs Discovered:</strong> ${data.metrics.totalUrlsDiscovered}</li>
          <li><strong>Unique Domains:</strong> ${data.metrics.uniqueDomains}</li>
          <li><strong>Citations Used:</strong> ${data.metrics.citationsUsed}</li>
          <li><strong>Citation Ratio:</strong> ${data.metrics.citationRatio.toFixed(3)}</li>
          <li><strong>Response Length:</strong> ${data.metrics.finalResponseLength} characters</li>
        </ul>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: black;">🔍 High Priority Metrics:</h3>
        <ul style="color: black;">
          <li><strong>Search Refinement Rate:</strong> ${((data.metrics.searchRefinementRate || 0) * 100).toFixed(1)}%</li>
          <li><strong>Citation Density:</strong> ${(data.metrics.citationDensity || 0).toFixed(2)} citations per 100 words</li>
          <li><strong>Average Domain Authority:</strong> ${(data.metrics.averageDomainAuthority || 0).toFixed(1)}/10</li>
          <li><strong>Domains with Citations:</strong> ${data.metrics.totalDomainsWithCitations || 0}/${data.metrics.uniqueDomains || 0}</li>
          <li><strong>Query Similarity:</strong> ${((data.metrics.searchQuerySimilarity || 0) * 100).toFixed(1)}%</li>
        </ul>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: black;">⏱️ Search Timeline:</h3>
        <ul style="color: black;">
          <li><strong>Avg Time Between Searches:</strong> ${(data.metrics.timelineMetrics?.averageTimeBetweenSearches || 0).toFixed(1)}s</li>
          <li><strong>Min Time Between Searches:</strong> ${(data.metrics.timelineMetrics?.minTimeBetweenSearches || 0).toFixed(1)}s</li>
          <li><strong>Max Time Between Searches:</strong> ${(data.metrics.timelineMetrics?.maxTimeBetweenSearches || 0).toFixed(1)}s</li>
        </ul>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: black;">🏆 Domain Performance:</h3>
        <ul style="color: black;">
          <li><strong>Most Cited Domain:</strong> ${data.metrics.mostCitedDomain || 'N/A'}</li>
          <li><strong>Least Cited Domain:</strong> ${data.metrics.leastCitedDomain || 'N/A'}</li>
        </ul>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: black;">Search Queries:</h3>
        <ol style="color: black;">
          ${data.metrics.searchQueries.map(q => `<li>${q}</li>`).join('')}
        </ol>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: black;">Domains Accessed:</h3>
        <ul style="color: black;">
          ${data.metrics.domainList.map(d => `<li>${d}</li>`).join('')}
        </ul>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: black;">📈 Domain Inclusion Rates:</h3>
        <ul style="color: black;">
          ${Object.entries(data.metrics.domainInclusionRate || {})
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([domain, rate]) => `<li><strong>${domain}:</strong> ${(rate * 100).toFixed(1)}%</li>`)
            .join('')}
        </ul>
      </div>
      
      <div style="text-align: center; margin-top: 20px;">
        <button id="save-to-db" style="
          background: #28a745;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          margin-right: 10px;
        ">💾 Save to Database</button>
        
        <button id="close-modal" style="
          background: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
        ">❌ Close</button>
      </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Add event listeners
    document.getElementById('save-to-db').addEventListener('click', () => {
      this.saveToDatabase(data);
    });

    document.getElementById('close-modal').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  async saveToDatabase(data) {
    try {
      // Load Supabase config
      const configResponse = await fetch(chrome.runtime.getURL('config.js'));
      const configText = await configResponse.text();
      
      // Parse config without using eval() to avoid CSP issues
      const urlMatch = configText.match(/url:\s*['"`]([^'"`]+)['"`]/);
      const keyMatch = configText.match(/anonKey:\s*['"`]([^'"`]+)['"`]/);
      
      if (!urlMatch || !keyMatch) {
        throw new Error('Could not parse Supabase config');
      }
      
      const config = {
        url: urlMatch[1],
        anonKey: keyMatch[1]
      };
      
      // Transform data to match Supabase table schema
      const supabaseData = this.transformDataForSupabase(data);
      
      // Save directly to Supabase
      const response = await fetch(`${config.url}/rest/v1/claude_search_data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(supabaseData)
      });

      if (response.ok) {
        alert('✅ Data saved to Supabase successfully!');
        document.body.removeChild(document.getElementById('claude-parser-modal'));
      } else {
        const errorText = await response.text();
        throw new Error(`Supabase error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Error saving data:', error);
      alert('❌ Error saving data: ' + error.message);
    }
  }

  transformDataForSupabase(data) {
    const metrics = data.metrics || {};
    
    return {
      conversation_id: data.conversationId,
      timestamp: data.timestamp,
      
      // Basic metrics
      search_count: metrics.searchCount || 0,
      total_urls_discovered: metrics.totalUrlsDiscovered || 0,
      unique_domains: metrics.uniqueDomains || 0,
      citations_used: metrics.citationsUsed || 0,
      citation_ratio: metrics.citationRatio || 0,
      final_response_length: metrics.finalResponseLength || 0,
      
      // High priority metrics
      search_refinement_rate: metrics.searchRefinementRate || 0,
      citation_density: metrics.citationDensity || 0,
      average_domain_authority: metrics.averageDomainAuthority || 0,
      total_domains_with_citations: metrics.totalDomainsWithCitations || 0,
      search_query_similarity: metrics.searchQuerySimilarity || 0,
      
      // Timeline metrics
      avg_time_between_searches: metrics.timelineMetrics?.averageTimeBetweenSearches || 0,
      min_time_between_searches: metrics.timelineMetrics?.minTimeBetweenSearches || 0,
      max_time_between_searches: metrics.timelineMetrics?.maxTimeBetweenSearches || 0,
      search_acceleration: metrics.timelineMetrics?.searchAcceleration || 0,
      
      // Domain performance
      most_cited_domain: metrics.mostCitedDomain || null,
      least_cited_domain: metrics.leastCitedDomain || null,
      
      // JSON fields
      search_queries: metrics.searchQueries || [],
      domain_list: metrics.domainList || [],
      domain_inclusion_rate: metrics.domainInclusionRate || {},
      domain_authority_data: metrics.domainAuthorityData || {},
      citation_sources: metrics.citationSources || [],
      unique_urls: metrics.uniqueUrls || [],
      
      // Metadata
      query_text: metrics.queryText || null
    };
  }
}

// Initialize the extractor
new ClaudeDataExtractor();
