import hljs from 'highlight.js';
import { marked } from 'marked';
import 'highlight.js/styles/github.css';
import 'remixicon/fonts/remixicon.css';
import './input.css';

// Add at the beginning after imports
async function initializeTheme() {
  const { theme } = await chrome.storage.sync.get(['theme']);
  applyTheme(theme || 'light');
}

function applyTheme(theme) {
  if (theme === 'system') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } else if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Add settings panel handling
function toggleSettingsPanel() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.toggle('hidden');
}

async function loadSettings() {
  const settings = await chrome.storage.sync.get({
    apiUrl: 'http://localhost:8000',
    apiToken: '',
    modelName: 'meta-llama/Llama-2-7b-chat',
    maxTokens: 500,
    theme: 'light'
  });
  
  // Populate form fields
  document.getElementById('apiUrl').value = settings.apiUrl;
  document.getElementById('apiToken').value = settings.apiToken;
  document.getElementById('modelName').value = settings.modelName;
  document.getElementById('maxTokens').value = settings.maxTokens;
  document.getElementById('theme').value = settings.theme;

  applyTheme(settings.theme);
}

async function handleSaveSettings() {
  const saveButton = document.getElementById('saveSettings');
  const saveMessage = document.getElementById('saveMessage');
  
  saveButton.disabled = true;
  saveMessage.classList.remove('hidden');
  
  try {
    const apiUrl = document.getElementById('apiUrl').value.trim();
    const apiToken = document.getElementById('apiToken').value.trim();
    const modelName = document.getElementById('modelName').value.trim();
    const maxTokens = parseInt(document.getElementById('maxTokens').value);
    const theme = document.getElementById('theme').value;

    // Validate
    if (!apiUrl) throw new Error('API URL is required');
    if (!maxTokens || maxTokens < 1 || maxTokens > 2048) {
      throw new Error('Max tokens must be between 1 and 2048');
    }

    // Save settings
    await chrome.storage.sync.set({
      apiUrl,
      apiToken,
      modelName,
      maxTokens,
      theme
    });

    saveMessage.textContent = '✓ Settings saved!';
    saveMessage.classList.remove('text-red-600');
    saveMessage.classList.add('text-green-600');

    // Close settings panel after brief delay
    setTimeout(() => {
      toggleSettingsPanel();
      saveButton.disabled = false;
      saveMessage.classList.add('hidden');
    }, 750);

    // Notify about settings update
    updateFooterInfo();
    applyTheme(theme);

  } catch (error) {
    console.error('Save error:', error);
    saveMessage.textContent = `✗ ${error.message}`;
    saveMessage.classList.remove('text-green-600');
    saveMessage.classList.add('text-red-600');
    saveButton.disabled = false;
  }
}

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
  const question = document.getElementById('question');
  
  if (!loading || !responseArea || !content || !question) {
    console.error('Required elements not found');
    return;
  }

  loading.classList.remove('hidden');
  responseArea.textContent = '';
  
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'sendToAPI',
      content: `Context: ${content.value}\n\nQuestion: ${question.value}`
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

function handleCopyToClipboard() {
  const responseContent = document.getElementById('responseContent');
  if (responseContent && responseContent.textContent.trim()) {
    navigator.clipboard.writeText(responseContent.textContent.trim()).then(() => {
      console.log('Content copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy content:', err);
    });
  }
}

// Add to DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
  initializeTheme();
  // Initialize response area first
  initializeResponseArea();
  updateFooterInfo(); // Add this line
  
  // Initialize settings link and handler
  const settingsLink = document.getElementById('settingsLink');
  if (settingsLink) {
    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      // Open settings.html in the extension popup instead of new tab
      window.location.href = 'settings.html';
    });
  }
  
  // Initialize quick action buttons
  document.querySelectorAll('.quick').forEach(button => {
    if (button) {
      button.addEventListener('click', handleQuickAction);
    }
  });
  
  // Add question input validation
  const questionInput = document.getElementById('question');
  const sendToChat = document.getElementById('sendToChat');
  
  questionInput.addEventListener('input', () => {
    sendToChat.disabled = !questionInput.value.trim();
  });
  
  // Initialize send to chat button
  if (sendToChat) {
    sendToChat.addEventListener('click', handleSendToChat);
  }
  
  // Initialize question input and clear button
  const clearQuestion = document.getElementById('clearQuestion');
  
  // Check initial state
  clearQuestion.classList.toggle('hidden', !questionInput.value.trim());
  sendToChat.disabled = !questionInput.value.trim();
  
  questionInput.addEventListener('input', () => {
    sendToChat.disabled = !questionInput.value.trim();
    clearQuestion.classList.toggle('hidden', !questionInput.value.trim());
  });
  
  clearQuestion.addEventListener('click', () => {
    questionInput.value = '';
    sendToChat.disabled = true;
    clearQuestion.classList.add('hidden');
  });

  const copyButton = document.getElementById('copyToClipboard');
  if (copyButton) {
    copyButton.addEventListener('click', handleCopyToClipboard);
  }
  
  // Start content loading
  loadTabContent();

  // Initialize settings
  loadSettings();
  
  // Add settings toggle handler
  document.getElementById('toggleSettings').addEventListener('click', toggleSettingsPanel);
  
  // Add save settings handler
  document.getElementById('saveSettings').addEventListener('click', handleSaveSettings);
});

// Clear UI state when changing tabs
function clearUIState() {
  const question = document.getElementById('question');
  const responseArea = document.getElementById('response');
  const clearQuestion = document.getElementById('clearQuestion');
  const sendToChat = document.getElementById('sendToChat');
  
  if (question) question.value = '';
  if (responseArea) responseArea.innerHTML = '<div id="responseContent"></div>';
  if (clearQuestion) clearQuestion.classList.add('hidden');
  if (sendToChat) sendToChat.disabled = true;
}

// Modify tab listeners to include clearing UI state
chrome.tabs.onActivated.addListener(() => {
  clearUIState();
  loadTabContent();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    clearUIState();
    loadTabContent();
  }
});

function displayResponse(response) {
  // First ensure response area exists, if not initialize it
  if (!document.getElementById('response')) {
    initializeResponseArea();
  }

  const responseArea = document.getElementById('response');
  if (!responseArea) {
    console.error('Failed to initialize response area');
    return;
  }

  // Ensure child elements exist
  if (!responseArea.querySelector('#responseContent')) {
    const content = document.createElement('div');
    content.id = 'responseContent';
    responseArea.appendChild(content);
  }

  const responseContent = document.getElementById('responseContent');
  const copyButton = document.getElementById('copyToClipboard');

  responseArea.classList.remove('hidden');

  if (!response.success) {
    responseContent.innerHTML = `<div class="error-message">❌ ${response.error.trim()}</div>`;
    return;
  }

  try {
    if (typeof marked === 'undefined') {
      responseContent.innerHTML = `<div class="text-content">${response.message.trim().replace(/\n/g, '<br>')}</div>`;
      return;
    }

    let htmlContent = marked.parse(response.message.trim());
    responseContent.innerHTML = htmlContent;
    
    if (typeof hljs !== 'undefined') {
      responseContent.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }

  } catch (error) {
    console.error('Response processing error:', error);
    responseContent.textContent = response.message;
  }

  if (responseContent.textContent.trim()) {
    copyButton.disabled = false;
  } else {
    copyButton.disabled = true;
  }
}

function initializeResponseArea() {
  let responseArea = document.getElementById('response');
  
  // If response area doesn't exist, create it
  if (!responseArea) {
    responseArea = document.createElement('div');
    responseArea.id = 'response';
    responseArea.className = 'bg-white/50 rounded-lg border border-surface-200/75 p-3 overflow-y-auto shadow-sm relative min-h-[100px]';
    document.querySelector('.container')?.appendChild(responseArea);
  }

  // Clear existing content and maintain structure
  responseArea.innerHTML = `<div id="responseContent"></div>`;

  return responseArea;
}

// Add cleanup when popup closes
window.addEventListener('unload', () => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});

// Add system theme change listener
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async (e) => {
  const { theme } = await chrome.storage.sync.get(['theme']);
  if (theme === 'system') {
    applyTheme('system');
  }
});

// Make updateFooterInfo more robust
async function updateFooterInfo() {
  try {
    const settings = await chrome.storage.sync.get(['apiUrl', 'modelName']);
    console.log('Footer info update:', settings); // Debug log
    
    const apiUrlDisplay = document.getElementById('apiUrlDisplay');
    const modelNameDisplay = document.getElementById('modelNameDisplay');
    
    if (apiUrlDisplay) {
      const displayUrl = settings.apiUrl || 'API URL not set';
      apiUrlDisplay.textContent = displayUrl;
      apiUrlDisplay.title = displayUrl;
    }
    
    if (modelNameDisplay) {
      const displayModel = settings.modelName || 'meta-llama/Llama-2-7b-chat';
      modelNameDisplay.textContent = displayModel;
      modelNameDisplay.title = displayModel;
    }
  } catch (error) {
    console.error('Failed to update footer info:', error);
  }
}

// Listen for settings changes from any source
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    // Update theme if it changed
    if (changes.theme) {
      applyTheme(changes.theme.newValue);
    }
    
    // Update footer info if relevant settings changed
    if (changes.apiUrl || changes.modelName) {
      updateFooterInfo();
    }
  }
});

// Also listen for direct messages from settings page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'settingsUpdated') {
    updateFooterInfo();
    if (message.settings.theme) {
      applyTheme(message.settings.theme);
    }
  }
});

// Update the settings change listener
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'settingsUpdated') {
    console.log('Settings updated:', message.settings); // Debug log
    updateFooterInfo();
    if (message.settings.theme) {
      applyTheme(message.settings.theme);
    }
    return true;
  }
});

// Modify quick action initialization to be more specific
document.addEventListener('DOMContentLoaded', () => {
  initializeTheme();
  initializeResponseArea();
  updateFooterInfo();
  
  // Initialize settings link with separate handler
  document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    // Prevent this event from being handled by quick action handlers
    e.stopPropagation();
    window.location.href = 'settings.html';
  });
  
  // Only attach quick action handlers to buttons with .quick AND data-action
  document.querySelectorAll('.quick[data-action]').forEach(button => {
    button.addEventListener('click', handleQuickAction);
  });

  // ...rest of your initialization code...
});