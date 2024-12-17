class Client {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
    this.azureApiUrl = config.azureApiUrl;
    this.azureApiToken = config.azureApiToken;
    this.chat = {
      completions: {
        create: this.createChatCompletion.bind(this)
      }
    };
  }

  async createChatCompletion(params) {
    const url = this.azureApiUrl ? `${this.azureApiUrl}/openai/deployments/${params.model}/chat/completions?api-version=2021-06-01-preview` : `${this.baseURL}/v1/chat/completions`;
    const apiKey = this.azureApiToken || this.apiKey;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        max_tokens: params.max_tokens
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'API request failed' } }));
      throw new Error(error.error?.message || 'API request failed');
    }

    return response.json();
  }
}

export default Client;
