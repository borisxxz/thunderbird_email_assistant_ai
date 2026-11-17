import { PROVIDERS, providerSettings } from './config.js';
import { trimBaseUrl } from '../providers/utils.js';

async function getJson(url, headers) {
  const resp = await fetch(url, { method: 'GET', headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${resp.statusText}${text ? ' — ' + text.slice(0, 200) : ''}`);
  }
  return resp.json();
}

function ollamaEndpoint(baseUrl) {
  return baseUrl.endsWith('/api/generate') ? baseUrl : `${baseUrl}/api/generate`;
}

function ollamaTagsUrl(baseUrl) {
  return (baseUrl.endsWith('/api/generate') ? baseUrl.slice(0, -'/api/generate'.length) : baseUrl) + '/api/tags';
}

// A connection test only needs an HTTP success — custom gateways may return
// plain text or an empty body, which is still a working connection.
async function postOk(url, headers, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${resp.statusText}${text ? ' — ' + text.slice(0, 200) : ''}`);
  }
  return true;
}

function connectionConfig(settings) {
  const meta = PROVIDERS[settings.provider];
  const { apiKey: apiKeyField, baseUrl: baseUrlField, model: modelField } = providerSettings(settings.provider);
  return {
    meta,
    apiKey: settings[apiKeyField] || '',
    baseUrl: trimBaseUrl(settings[baseUrlField]),
    model: settings[modelField] || ''
  };
}

function checkConfig({ meta, apiKey, baseUrl }) {
  if (!baseUrl) throw new Error('Base URL is empty');
  if (meta.needsApiKey && !apiKey) throw new Error('API key is empty');
}

export async function listModels(settings) {
  const cfg = connectionConfig(settings);
  checkConfig(cfg);
  const { baseUrl, apiKey, meta } = cfg;

  switch (cfg.meta.kind) {
    case 'ollama': {
      const data = await getJson(ollamaTagsUrl(baseUrl));
      return (data.models || []).map(m => m.name);
    }
    case 'openai-compat':
    case 'openai-responses': {
      const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
      const data = await getJson(`${baseUrl}/models`, headers);
      return (data.data || []).map(m => m.id).sort();
    }
    case 'gemini': {
      const data = await getJson(`${baseUrl}/models?pageSize=100`, { 'x-goog-api-key': apiKey });
      return (data.models || []).map(m => String(m.name).replace(/^models\//, ''));
    }
    case 'claude': {
      const data = await getJson(`${baseUrl}/v1/models?limit=100`, {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': true
      });
      return (data.data || []).map(m => m.id);
    }
    default:
      throw new Error(`Unsupported provider: ${settings.provider}`);
  }
}

export async function testConnection(settings) {
  const cfg = connectionConfig(settings);
  checkConfig(cfg);
  const { baseUrl, apiKey, model, meta } = cfg;

  switch (meta.kind) {
    case 'ollama':
      await postOk(ollamaEndpoint(baseUrl), { 'Content-Type': 'application/json' }, {
        model,
        prompt: 'ping',
        stream: false,
        options: { num_predict: 1 }
      });
      break;
    case 'openai-responses':
      await postOk(`${baseUrl}/responses`, {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }, {
        model,
        input: 'ping',
        max_output_tokens: 64,
        store: false
      });
      break;
    case 'openai-compat': {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      await postOk(`${baseUrl}/chat/completions`, headers, {
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      });
      break;
    }
    case 'gemini':
      await postOk(`${baseUrl}/models/${model}:generateContent`,
        { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, {
          contents: [{ parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 1 }
        });
      break;
    case 'claude':
      await postOk(`${baseUrl}/v1/messages`, {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': true
      }, {
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }]
      });
      break;
    default:
      throw new Error(`Unsupported provider: ${settings.provider}`);
  }
}
