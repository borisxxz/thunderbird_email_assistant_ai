import { buildPrompt } from '../core/analysis.js';
import { providerSettings, SYSTEM_PROMPT, SYSTEM_PROMPT_SUMMARY } from '../core/config.js';
import { genParams, parseJsonResponse, postJson, trimBaseUrl } from './utils.js';

// OpenAI's current recommended API: POST {base}/responses with top-level
// instructions + input, structured output via text.format, text extracted
// from output[].content[].text. store:false keeps email content out of
// OpenAI's response storage.
function credentials(settings) {
  const { apiKey: apiKeyField, baseUrl: baseUrlField, model: modelField } = providerSettings('openai');
  return {
    apiKey: settings[apiKeyField],
    baseUrl: trimBaseUrl(settings[baseUrlField]),
    model: settings[modelField]
  };
}

function headers(apiKey) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
}

function checkConfig({ apiKey, baseUrl }) {
  if (!apiKey) {
    console.error('OpenAI Error: API key is not set.');
    return false;
  }
  if (!baseUrl) {
    console.error('OpenAI Error: Base URL is not set.');
    return false;
  }
  return true;
}

function extractResponseText(result) {
  for (const item of result.output || []) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (part.type === 'output_text' && part.text) return part.text;
      }
    }
  }
  return null;
}

async function analyze(settings, structuredData, customTags) {
  const cred = credentials(settings);
  if (!checkConfig(cred)) return null;

  const prompt = buildPrompt(structuredData, customTags);
  const gen = genParams(settings);

  try {
    const result = await postJson('OpenAI', `${cred.baseUrl}/responses`, headers(cred.apiKey), {
      model: cred.model,
      instructions: SYSTEM_PROMPT,
      input: prompt,
      text: { format: { type: 'json_object' } },
      store: false,
      ...(gen.temperature !== undefined && { temperature: gen.temperature }),
      ...(gen.maxTokens !== undefined && { max_output_tokens: gen.maxTokens })
    });
    const rawText = extractResponseText(result);
    return rawText ? parseJsonResponse('OpenAI', rawText) : null;
  } catch (error) {
    console.error(`OpenAI Error (URL: ${cred.baseUrl}, model: ${cred.model}):`, error);
    return null;
  }
}

async function summarize(settings, prompt) {
  const cred = credentials(settings);
  if (!checkConfig(cred)) return null;
  const gen = genParams(settings);

  try {
    const result = await postJson('OpenAI', `${cred.baseUrl}/responses`, headers(cred.apiKey), {
      model: cred.model,
      instructions: SYSTEM_PROMPT_SUMMARY,
      input: prompt,
      store: false,
      ...(gen.temperature !== undefined && { temperature: gen.temperature }),
      ...(gen.maxTokens !== undefined && { max_output_tokens: gen.maxTokens })
    });
    return extractResponseText(result);
  } catch (error) {
    console.error(`OpenAI summarize error (URL: ${cred.baseUrl}, model: ${cred.model}):`, error);
    return null;
  }
}

export const openaiResponsesAdapter = { analyze, summarize };
