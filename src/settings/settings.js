import 'highlight.js/styles/github.css';
import 'remixicon/fonts/remixicon.css';
import '../input.css';

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get(['apiUrl', 'apiToken', 'modelName', 'maxTokens']);
  
  document.getElementById('apiUrl').value = settings.apiUrl || 'http://localhost:8000';
  document.getElementById('apiToken').value = settings.apiToken || '';
  document.getElementById('modelName').value = settings.modelName || 'meta-llama/Llama-3.2-1B-Instruct';
  document.getElementById('maxTokens').value = settings.maxTokens || 500;
});

document.getElementById('saveSettings').addEventListener('click', async () => {
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
  
  const saveMessage = document.getElementById('saveMessage');
  saveMessage.style.display = 'block';
  setTimeout(() => {
    saveMessage.style.display = 'none';
  }, 2000);
});