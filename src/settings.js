import 'highlight.js/styles/github.css';
import 'remixicon/fonts/remixicon.css';
import './input.css';

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get(['apiUrl', 'apiToken', 'modelName', 'maxTokens']);
  
  document.getElementById('apiUrl').value = settings.apiUrl || 'http://localhost:8000';
  document.getElementById('apiToken').value = settings.apiToken || '';
  document.getElementById('modelName').value = settings.modelName || 'meta-llama/Llama-2-7b-chat';
  document.getElementById('maxTokens').value = settings.maxTokens || 500;
});

document.getElementById('saveSettings').addEventListener('click', async () => {
  const saveButton = document.getElementById('saveSettings');
  const saveMessage = document.getElementById('saveMessage');
  const originalContent = saveButton.innerHTML;
  
  // Disable button and show loading state
  saveButton.disabled = true;
  saveButton.innerHTML = `
    <i class="ri-loader-4-line animate-spin"></i>
    <span>Saving...</span>
  `;
  
  try {
    const apiUrl = document.getElementById('apiUrl').value.trim();
    const apiToken = document.getElementById('apiToken').value.trim();
    const modelName = document.getElementById('modelName').value.trim();
    const maxTokens = parseInt(document.getElementById('maxTokens').value) || 500;
    
    await chrome.storage.sync.set({
      apiUrl,
      apiToken,
      modelName,
      maxTokens
    });
    
    // Show success message and close tab after delay
    saveMessage.classList.remove('hidden');
    setTimeout(() => {
      window.close();
    }, 1000);
  } catch (error) {
    console.error('Failed to save settings:', error);
  } finally {
    // Restore button state
    saveButton.disabled = false;
    saveButton.innerHTML = originalContent;
  }
});