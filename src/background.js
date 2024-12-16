import Client from './client.js';

const rateLimiter = {
  lastRequest: 0,
  minDelay: 1000, // 1 second between requests
};

async function sendToAPI(content) {
  try {
    const settings = await chrome.storage.sync.get(['apiUrl', 'apiToken', 'modelName', 'maxTokens']);
    
    if (!settings.apiUrl) {
      throw new Error('API URL is not configured. Please open settings and configure the API URL.');
    }

    if (!content.trim()) {
      throw new Error('Please enter some text to process.');
    }

    const client = new Client({
      apiKey: settings.apiToken,
      baseURL: settings.apiUrl
    });

    const chatCompletion = await client.chat.completions.create({
      model: settings.modelName || 'meta-llama/Llama-2-7b-chat',
      messages: [{ role: "user", content: content }],
      max_tokens: parseInt(settings.maxTokens) || 500
    });

    if (!chatCompletion.choices?.[0]?.message) {
      throw new Error('Invalid response from API. Please check your settings and try again.');
    }

    return { success: true, message: chatCompletion.choices[0].message.content.trim() };
  } catch (error) {
    return { 
      success: false, 
      error: error.message
    };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendToAPI') {
    // Handle the API request
    sendToAPI(request.content)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ 
          success: false, 
          error: error.message || 'API request failed'
        });
      });
    return true; // Required for async response
  }
});

// Handle extension icon click to open sidebar
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url.startsWith('chrome://')) {
    return; // Can't open on chrome:// URLs
  }
  
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('Failed to open side panel:', error);
    // Fallback to opening as a popup if side panel fails
    chrome.windows.create({
      url: 'popup.html',
      type: 'popup',
      width: 400,
      height: 600
    });
  }
});

// Optional: Set default state to open for all tabs
// chrome.tabs.onCreated.addListener((tab) => {
//   if (!tab.url?.startsWith('chrome://')) {
//     chrome.sidePanel.open({ tabId: tab.id });
//   }
// });