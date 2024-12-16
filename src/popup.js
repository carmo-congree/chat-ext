import hljs from 'highlight.js';
import { marked } from 'marked';
import 'highlight.js/styles/github.css';
import 'remixicon/fonts/remixicon.css';
import './input.css';

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

// Initialize content loading
document.addEventListener('DOMContentLoaded', () => {
  // Initialize response area first
  initializeResponseArea();
  
  // Initialize settings link and handler
  const settingsLink = document.getElementById('settingsLink');
  if (settingsLink) {
    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({
        url: 'settings.html'
      });
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