import { buildPrompt } from '../core/analysis.js';
import { providerSettings, DEFAULTS, SYSTEM_PROMPT_SUMMARY } from '../core/config.js';
import { genParams, parseJsonResponse, postJson, trimBaseUrl } from './utils.js';

function config(settings) {
  const { baseUrl: baseUrlField, model: modelField } = providerSettings('ollama');
  return {
    baseUrl: trimBaseUrl(settings[baseUrlField]) || DEFAULTS.ollamaBaseUrl,
    model: settings[modelField]
  };
}

function endpoint(baseUrl) {
  // Older versions stored the full endpoint; accept both base URL and endpoint.
  return baseUrl.endsWith('/api/generate') ? baseUrl : `${baseUrl}/api/generate`;
}

async function analyze(settings, structuredData, customTags) {
  const { baseUrl, model } = config(settings);
  const prompt = buildPrompt(structuredData, customTags);
  const gen = genParams(settings);
  const options = {};
  if (gen.temperature !== undefined) options.temperature = gen.temperature;
  if (gen.maxTokens !== undefined) options.num_predict = gen.maxTokens;

  try {
    const result = await postJson('Ollama', endpoint(baseUrl), { 'Content-Type': 'application/json' }, {
      model,
      prompt,
      format: "json",
      stream: false,
      ...(Object.keys(options).length ? { options } : {})
    });
    return parseJsonResponse('Ollama', result.response);
  } catch (error) {
    console.error(`Ollama Error (URL: ${baseUrl}, model: ${model}):`, error);
    return null;
  }
}

async function summarize(settings, prompt) {
  const { baseUrl, model } = config(settings);
  const gen = genParams(settings);
  const options = {};
  if (gen.temperature !== undefined) options.temperature = gen.temperature;
  if (gen.maxTokens !== undefined) options.num_predict = gen.maxTokens;

  try {
    const result = await postJson('Ollama', endpoint(baseUrl), { 'Content-Type': 'application/json' }, {
      model,
      prompt: `${SYSTEM_PROMPT_SUMMARY}\n\n${prompt}`,
      stream: false,
      ...(Object.keys(options).length ? { options } : {})
    });
    return result.response;
  } catch (error) {
    console.error(`Ollama summarize error (URL: ${baseUrl}, model: ${model}):`, error);
    return null;
  }
}

export const ollamaAdapter = { analyze, summarize };
