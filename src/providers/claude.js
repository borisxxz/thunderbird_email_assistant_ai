import { buildPrompt } from '../core/analysis.js';
import { providerSettings, SYSTEM_PROMPT, DEFAULTS, SYSTEM_PROMPT_SUMMARY } from '../core/config.js';
import { genParams, isAbortError, parseJsonResponse, postJson, trimBaseUrl } from './utils.js';

const CLAUDE_API_VERSION = '2023-06-01';

function config(settings) {
  const { apiKey: apiKeyField, baseUrl: baseUrlField, model: modelField } = providerSettings('claude');
  return {
    apiKey: settings[apiKeyField],
    baseUrl: trimBaseUrl(settings[baseUrlField]) || DEFAULTS.claudeBaseUrl,
    model: settings[modelField]
  };
}

function headers(apiKey) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-dangerous-direct-browser-access': true,
    'anthropic-version': CLAUDE_API_VERSION
  };
}

function contentText(result) {
  const blocks = (result && result.content) || [];
  const block = blocks.find(b => b && b.type === 'text' && typeof b.text === 'string' && b.text);
  if (!block) throw new Error('Claude returned no text content');
  return block.text;
}

async function analyze(settings, structuredData, customTags) {
  const cfg = config(settings);
  if (!cfg.apiKey) {
    console.error("Claude Error: API key is not set.");
    return null;
  }

  const prompt = buildPrompt(structuredData, customTags, settings.provider);
  const gen = genParams(settings);

  try {
    const result = await postJson('Claude', `${cfg.baseUrl}/v1/messages`, headers(cfg.apiKey), {
      model: cfg.model,
      max_tokens: gen.maxTokens !== undefined ? gen.maxTokens : 4096,
      ...(gen.temperature !== undefined && { temperature: gen.temperature }),
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }]
    });
    return parseJsonResponse('Claude', contentText(result));
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error(`Claude Error (URL: ${cfg.baseUrl}, model: ${cfg.model}):`, error);
    return null;
  }
}

async function summarize(settings, prompt) {
  const cfg = config(settings);
  if (!cfg.apiKey) {
    console.error("Claude Error: API key is not set.");
    return null;
  }
  const gen = genParams(settings);

  try {
    const result = await postJson('Claude', `${cfg.baseUrl}/v1/messages`, headers(cfg.apiKey), {
      model: cfg.model,
      max_tokens: gen.maxTokens !== undefined ? gen.maxTokens : 2048,
      ...(gen.temperature !== undefined && { temperature: gen.temperature }),
      system: SYSTEM_PROMPT_SUMMARY,
      messages: [{ role: "user", content: prompt }]
    });
    return contentText(result);
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error(`Claude summarize error (URL: ${cfg.baseUrl}, model: ${cfg.model}):`, error);
    return null;
  }
}

export const claudeAdapter = { analyze, summarize };
