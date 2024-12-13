import hljs from 'highlight.js';
import { marked } from 'marked';
import 'highlight.js/styles/github.css';
import 'remixicon/fonts/remixicon.css';
import '../input.css';

// Configure marked with highlight.js
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true,
  headerIds: false,
  mangle: false
});

// Initialize highlight.js
hljs.configure({
  ignoreUnescapedHTML: true,
  throwUnescapedHTML: false
});

let lastContent = '';
let pollInterval = null;

async function pollForContentChanges() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'getContent'
    }).catch(() => null);

    if (response) {
      const newContent = response.content;
      if (newContent && newContent !== lastContent) {
        lastContent = newContent;
        document.getElementById('content').value = newContent;
      }
    }
  } catch (error) {
    console.error('Polling error:', error);
  }
}

async function loadTabContent() {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  
  loading.classList.remove('hidden');
  content.value = '';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
      content.value = "Cannot access this page's content.";
      return;
    }

    // Always inject the content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    // Short delay to ensure content script is ready
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'getContent'
    }).catch(err => {
      console.error('Message error:', err);
      return { content: 'Could not get page content. Please try refreshing the page.' };
    });

    content.value = response.content;
    lastContent = response.content;
    
    // Clear existing poll interval if any
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    
    // Start polling every 1 second
    pollInterval = setInterval(pollForContentChanges, 1000);
    
  } catch (error) {
    console.error('Error:', error);
    content.value = 'Could not get page content. Please try refreshing the page.';
  } finally {
    loading.classList.add('hidden');
  }
}

// Add missing handlers
async function handleQuickAction() {
  const loading = document.getElementById('loading');
  const responseArea = document.getElementById('response');
  const content = document.getElementById('content').value;
  
  if (!loading || !responseArea || !content) {
    console.error('Required elements not found');
    return;
  }

  loading.classList.remove('hidden');
  responseArea.textContent = '';
  
  try {
    const prompts = {
      proofread: "Please proofread this text:",
      summarize: "Please summarize this text:",
      rewrite: "Please rewrite this text:",
      makeList: "Please convert this text into a bullet point list:"
    };
    
    const result = await chrome.runtime.sendMessage({
      action: 'sendToAPI',
      content: `${prompts[this.dataset.action]} ${content}`
    });
    
    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message);
    }
    
    displayResponse(result);
  } catch (error) {
    console.error('Communication error:', error);
    displayResponse({ 
      success: false, 
      error: error.message || 'Failed to communicate with extension. Please try reloading.'
    });
  } finally {
    loading.classList.add('hidden');
  }
}

async function handleSendToChat() {
  const loading = document.getElementById('loading');
  const responseArea = document.getElementById('response');
  const content = document.getElementById('content');
  
  if (!loading || !responseArea || !content) {
    console.error('Required elements not found');
    return;
  }

  loading.classList.remove('hidden');
  responseArea.textContent = '';
  
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'sendToAPI',
      content: content.value
    });
    
    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message);
    }
    
    displayResponse(result);
  } catch (error) {
    console.error('Communication error:', error);
    displayResponse({ 
      success: false, 
      error: error.message || 'Failed to communicate with extension. Please try reloading.'
    });
  } finally {
    loading.classList.add('hidden');
  }
}

// Initialize content loading
document.addEventListener('DOMContentLoaded', () => {
  // Initialize response area first
  initializeResponseArea();
  
  // Initialize settings link and handler
  const settingsLink = document.getElementById('settingsLink');
  if (settingsLink) {
    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      
      const container = document.querySelector('.container');
      if (!container) {
        console.error('Container not found');
        return;
      }
      
      container.innerHTML = `
        <h1>Settings</h1>
        <div class="form-group">
          <label for="apiUrl">API URL</label>
          <input type="text" id="apiUrl" class="input" placeholder="http://localhost:8000">
        </div>
        <div class="form-group">
          <label for="apiToken">API Token (Optional)</label>
          <input type="text" id="apiToken" class="input" placeholder="Enter your API token">
        </div>
        <div class="form-group">
          <label for="modelName">Model Name</label>
          <input type="text" id="modelName" class="input" placeholder="meta-llama/Llama-2-7b-chat">
        </div>
        <div class="form-group">
          <label for="maxTokens">Max Tokens</label>
          <input type="number" id="maxTokens" class="input" value="500" min="1" max="2048">
        </div>
        <button id="saveSettings" class="button primary">Save Settings</button>
        <div id="saveMessage" class="save-message">Settings saved!</div>
      `;

      // Add save settings handler after content is inserted
      const saveSettings = document.getElementById('saveSettings');
      if (saveSettings) {
        saveSettings.addEventListener('click', async () => {
          const apiUrl = document.getElementById('apiUrl')?.value.trim();
          const apiToken = document.getElementById('apiToken')?.value.trim();
          const modelName = document.getElementById('modelName')?.value.trim();
          const maxTokens = parseInt(document.getElementById('maxTokens')?.value) || 500;
          
          await chrome.storage.sync.set({
            apiUrl,
            apiToken,
            modelName,
            maxTokens
          });
          
          const saveMessage = document.getElementById('saveMessage');
          if (saveMessage) {
            saveMessage.style.display = 'block';
            setTimeout(() => {
              saveMessage.style.display = 'none';
              location.reload();
            }, 1000);
          }
        });
      }

      // Load existing settings
      (async () => {
        const settings = await chrome.storage.sync.get(['apiUrl', 'apiToken', 'modelName', 'maxTokens']);
        if (document.getElementById('apiUrl')) {
          document.getElementById('apiUrl').value = settings.apiUrl || 'http://localhost:8000';
          document.getElementById('apiToken').value = settings.apiToken || '';
          document.getElementById('modelName').value = settings.modelName || 'meta-llama/Llama-2-7b-chat';
          document.getElementById('maxTokens').value = settings.maxTokens || 500;
        }
      })();
    });
  }
  
  // Initialize quick action buttons
  document.querySelectorAll('.quick').forEach(button => {
    if (button) {
      button.addEventListener('click', handleQuickAction);
    }
  });
  
  // Initialize send to chat button
  const sendToChat = document.getElementById('sendToChat');
  if (sendToChat) {
    sendToChat.addEventListener('click', handleSendToChat);
  }
  
  // Start content loading
  loadTabContent();
});

// Listen for tab changes
chrome.tabs.onActivated.addListener(loadTabContent);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    loadTabContent();
  }
});

function copyHandler() {
  const responseContent = document.getElementById('responseContent');
  if (!responseContent) return;
  
  try {
    navigator.clipboard.writeText(responseContent.textContent);
    this.classList.add('success');
    this.innerHTML = '<i class="ri-check-line"></i>';
    setTimeout(() => {
      this.classList.remove('success');
      this.innerHTML = '<i class="ri-clipboard-line"></i>';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

function displayResponse(response) {
  const responseArea = document.getElementById('response');
  const responseContent = document.getElementById('responseContent');
  const copyButton = document.getElementById('copyButton');
  
  if (!responseArea || !responseContent || !copyButton) {
    console.error('Response elements not found, reinitializing...');
    initializeResponseArea();
    // Try again after initialization
    setTimeout(() => displayResponse(response), 0);
    return;
  }

  if (!response.success) {
    responseContent.innerHTML = `<div class="error-message">❌ ${response.error}</div>`;
    copyButton.classList.add('hidden');
    return;
  }

  try {
    copyButton.classList.remove('hidden');
    
    // Check if marked is available
    if (typeof marked === 'undefined') {
      responseContent.innerHTML = `<div class="text-content">${response.message.replace(/\n/g, '<br>')}</div>`;
      console.warn('marked.js not available - displaying plain text');
      return;
    }

    // Convert markdown to HTML
    let htmlContent = marked.parse(response.message);
    responseContent.innerHTML = htmlContent;
    
    // Apply syntax highlighting if available
    if (typeof hljs !== 'undefined') {
      responseContent.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }

    // Remove any existing click handlers
    copyButton.removeEventListener('click', copyHandler);
    // Add copy functionality
    copyButton.addEventListener('click', copyHandler);

  } catch (error) {
    console.error('Response processing error:', error);
    responseContent.textContent = response.message;
  }
}

function initializeResponseArea() {
  const responseArea = document.getElementById('response');
  if (!responseArea) {
    console.error('Response area not found');
    return;
  }

  // Ensure the element is visible
  responseArea.classList.remove('hidden');
  
  // Create elements
  const header = document.createElement('div');
  header.className = 'response-header';
  
  const copyButton = document.createElement('button');
  copyButton.id = 'copyButton';
  copyButton.className = 'button copy hidden';
  copyButton.title = 'Copy to clipboard';
  copyButton.innerHTML = '<i class="ri-clipboard-line"></i>';
  
  const content = document.createElement('div');
  content.id = 'responseContent';
  
  // Clear and append new elements
  responseArea.innerHTML = '';
  header.appendChild(copyButton);
  responseArea.appendChild(header);
  responseArea.appendChild(content);
}

// Add cleanup when popup closes
window.addEventListener('unload', () => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});