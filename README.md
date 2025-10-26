# Claude Search Parser Chrome Extension

A comprehensive Chrome extension for extracting and analyzing Claude's search behavior for LLM research purposes. This tool provides deep insights into how Claude discovers, evaluates, and cites sources during web searches.

## 🚀 Features

- **🔍 Automatic Detection**: Monitors Claude conversations and detects search activities
- **📊 Advanced Analytics**: Extracts 20+ detailed metrics about search behavior
- **🎯 High Priority Metrics**: Domain inclusion rates, search refinement patterns, citation density
- **⏱️ Timeline Analysis**: Search timing patterns and decision-making speed
- **🏆 Domain Authority Scoring**: Weighted scoring based on source credibility
- **💾 Smart Storage**: Automatic organization ID detection and localStorage caching
- **📈 Visual Preview**: Rich data preview with categorized metrics
- **📤 Export Functionality**: Export data to CSV format for analysis
- **🤝 Team Collaboration**: Send data to remote database for team research
- **🛡️ Privacy First**: No sensitive data collection, works offline

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension will appear in your Chrome toolbar

## 🎯 Usage

### Quick Start
1. **Open Claude.ai** and start a conversation that involves web search
2. **Look for the extension buttons** in the top-right corner of the page
3. **Click "📊 Extract Search Data"** to analyze the current conversation
4. **Review the comprehensive metrics** in the preview modal
5. **Click "💾 Save to Database"** to store the data

### Advanced Features
- **🔍 Manual Extract**: Use when automatic detection fails
- **📋 View Collected Data**: See all collected data in a formatted view
- **💾 Export to CSV**: Download data for external analysis
- **⚙️ Settings**: Configure auto-extract and notifications

### First-Time Setup
The extension automatically detects your organization ID from network requests. If prompted:
1. Open Chrome DevTools (F12) → Network tab
2. Refresh the page (F5)
3. Look for requests to `claude.ai/api/organizations/[ID]/chat_conversations/...`
4. Copy the organization ID and paste it in the modal

## 📊 Extracted Metrics

The extension extracts **20+ comprehensive metrics** across multiple categories:

### 🔍 Basic Metrics
- **Search Count**: Number of web searches performed
- **URLs Discovered**: Total unique URLs found
- **Unique Domains**: Number of different domains accessed
- **Citations Used**: Number of citations in final response
- **Citation Ratio**: Citations/URLs discovered ratio
- **Response Length**: Character count of final response

### 🎯 High Priority Metrics (NEW!)
- **Search Refinement Rate**: How often queries are modified between searches
- **Citation Density**: Citations per 100 words in response
- **Average Domain Authority**: Weighted scoring based on source credibility (1-10 scale)
- **Domain Inclusion Rate**: Percentage of discovered URLs that get cited per domain
- **Query Similarity**: How similar search queries are to each other

### ⏱️ Timeline Analysis
- **Average Time Between Searches**: Mean time between search iterations
- **Min/Max Time Between Searches**: Fastest and slowest search intervals
- **Search Acceleration**: Whether search speed increases over time

### 🏆 Domain Performance
- **Most Cited Domain**: Domain with highest citation count
- **Least Cited Domain**: Domain with lowest inclusion rate
- **Domain Authority Scores**: Wikipedia (10), Academic (8-9), News (7), Blogs (3-4)

### 📈 Advanced Analytics
- **Search Timeline**: Detailed timing patterns
- **Domain Diversity**: Variety of domain types accessed
- **Response Construction Time**: Time to build final response
- **Search Queries**: Array of search queries used
- **Citation Sources**: Detailed citation information with metadata

## 🗄️ Database Setup

### Option 1: Simple JSON Server (Quick Start)

```bash
# Install json-server globally
npm install -g json-server

# Create a db.json file
echo '{"claudeSearchData": []}' > db.json

# Start the server
json-server --watch db.json --port 3000
```

### Option 2: Firebase (Recommended for Teams)

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore Database
3. Update the API endpoint in `background.js`:

```javascript
this.apiEndpoint = 'https://your-firebase-project.firebaseio.com';
```

### Option 3: Custom API (Production)

Create a REST API with the following endpoint:

```javascript
POST /api/claude-search-data
Content-Type: application/json

{
  "conversationId": "string",
  "timestamp": "ISO string",
  "metrics": {
    "searchCount": "number",
    "totalUrlsDiscovered": "number",
    "searchRefinementRate": "number",
    "citationDensity": "number",
    "averageDomainAuthority": "number",
    "domainInclusionRate": "object",
    "timelineMetrics": "object",
    // ... 15+ other metrics
  }
}
```

## 📈 Team Dashboard Setup

### Option 1: Streamlit Dashboard (Recommended)

```python
# dashboard.py
import streamlit as st
import pandas as pd
import json
import plotly.express as px

st.title("🔍 Claude Search Analysis Dashboard")

# Load data from your database
data = load_claude_data()  # Your data loading function
df = pd.DataFrame(data)

# Key metrics
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Total Conversations", len(df))
with col2:
    st.metric("Avg Search Refinement Rate", f"{df['searchRefinementRate'].mean()*100:.1f}%")
with col3:
    st.metric("Avg Citation Density", f"{df['citationDensity'].mean():.2f}")
with col4:
    st.metric("Avg Domain Authority", f"{df['averageDomainAuthority'].mean():.1f}/10")

# Advanced visualizations
st.subheader("🎯 Search Behavior Analysis")
fig1 = px.scatter(df, x='searchRefinementRate', y='citationDensity', 
                  title='Search Refinement vs Citation Density')
st.plotly_chart(fig1)

st.subheader("🏆 Domain Authority Distribution")
fig2 = px.histogram(df, x='averageDomainAuthority', 
                    title='Distribution of Domain Authority Scores')
st.plotly_chart(fig2)

st.subheader("⏱️ Search Timeline Analysis")
fig3 = px.line(df, x='timestamp', y='timelineMetrics.averageTimeBetweenSearches',
               title='Search Speed Over Time')
st.plotly_chart(fig3)
```

### Option 2: Jupyter Notebook

```python
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Load and analyze data
df = pd.read_csv('claude-search-data.csv')

# Advanced analysis
fig, axes = plt.subplots(2, 2, figsize=(15, 12))

# Search refinement patterns
axes[0,0].scatter(df['searchRefinementRate'], df['citationDensity'], alpha=0.6)
axes[0,0].set_title('Search Refinement vs Citation Density')
axes[0,0].set_xlabel('Search Refinement Rate')
axes[0,0].set_ylabel('Citation Density')

# Domain authority distribution
axes[0,1].hist(df['averageDomainAuthority'], bins=20, alpha=0.7)
axes[0,1].set_title('Domain Authority Score Distribution')
axes[0,1].set_xlabel('Average Domain Authority')

# Timeline analysis
axes[1,0].plot(df['timestamp'], df['timelineMetrics.averageTimeBetweenSearches'])
axes[1,0].set_title('Search Speed Over Time')
axes[1,0].set_xlabel('Time')
axes[1,0].set_ylabel('Avg Time Between Searches (s)')

# Citation patterns
axes[1,1].scatter(df['totalUrlsDiscovered'], df['citationsUsed'], alpha=0.6)
axes[1,1].set_title('URLs Discovered vs Citations Used')
axes[1,1].set_xlabel('URLs Discovered')
axes[1,1].set_ylabel('Citations Used')

plt.tight_layout()
plt.show()
```

## ⚙️ Configuration

Update the API endpoint in `background.js`:

```javascript
this.apiEndpoint = 'https://your-api-endpoint.com/api';
```

## 🛡️ Privacy & Security

- **🔒 No sensitive data collection**: Only extracts search behavior metrics
- **💾 Local storage first**: Data is cached locally before sending to remote
- **🌐 Optional remote storage**: Can work entirely offline
- **👤 No user identification**: No personal information is collected
- **🔑 Automatic organization ID detection**: No manual data entry required
- **📊 Research-focused**: Designed specifically for LLM research purposes

## 🔧 Troubleshooting

### Extension not working
1. ✅ Check that you're on claude.ai
2. ✅ Ensure the conversation has search activities
3. ✅ Try refreshing the page and clicking the extension again
4. ✅ Check browser console for error messages

### Data not saving
1. ✅ Check your internet connection
2. ✅ Verify the API endpoint is correct
3. ✅ Check browser console for error messages
4. ✅ Ensure organization ID is properly set

### Export not working
1. ✅ Ensure you have collected some data first
2. ✅ Check browser permissions for downloads
3. ✅ Try using the "View Collected Data" option first

### Organization ID issues
1. ✅ Use the "🔍 Manual Extract" button
2. ✅ Follow the instructions in the modal
3. ✅ Check DevTools Network tab for the organization ID
4. ✅ The ID is automatically saved for future use

## 🚀 Development

To modify the extension:

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh button on the extension
4. Test your changes

### Key Files
- `content.js` - Main extraction logic and metrics calculation
- `background.js` - Data processing and storage
- `popup.html/js` - Extension interface
- `manifest.json` - Extension configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with various Claude conversations
5. Submit a pull request

### Research Contributions
We welcome contributions that help understand LLM search behavior:
- New metrics and analytics
- Improved data visualization
- Better error handling
- Performance optimizations

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

Built for the LLM research community to better understand how AI systems discover, evaluate, and cite information sources.
