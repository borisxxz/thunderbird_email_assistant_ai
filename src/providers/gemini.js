import { buildPrompt } from '../core/analysis.js';
import { providerSettings, SYSTEM_PROMPT, SYSTEM_PROMPT_SUMMARY } from '../core/config.js';
import { genParams, parseJsonResponse, postJson, trimBaseUrl } from './utils.js';

function config(settings) {
  const { apiKey: apiKeyField, baseUrl: baseUrlField, model: modelField } = providerSettings('gemini');
  return {
    apiKey: settings[apiKeyField],
    baseUrl: trimBaseUrl(settings[baseUrlField]),
    model: settings[modelField]
  };
}

function checkConfig({ apiKey, baseUrl }) {
  if (!apiKey) {
    console.error("Gemini Error: API key is not set.");
    return false;
  }
  if (!baseUrl) {
    console.error("Gemini Error: Base URL is not set.");
    return false;
  }
  return true;
}

function apiUrl({ apiKey, baseUrl, model }) {
  return `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

async function analyze(settings, structuredData, customTags) {
  const cfg = config(settings);
  if (!checkConfig(cfg)) return null;

  const prompt = buildPrompt(structuredData, customTags);
  const gen = genParams(settings);
  const generation = { systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, response_mime_type: "application/json" };
  if (gen.temperature !== undefined) generation.temperature = gen.temperature;
  if (gen.maxTokens !== undefined) generation.maxOutputTokens = gen.maxTokens;

  try {
    const result = await postJson('Gemini', apiUrl(cfg), { 'Content-Type': 'application/json' }, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: generation
    });
    return parseJsonResponse('Gemini', result.candidates[0].content.parts[0].text);
  } catch (error) {
    console.error(`Gemini Error (URL: ${cfg.baseUrl}, model: ${cfg.model}):`, error);
    return null;
  }
}

async function summarize(settings, prompt) {
  const cfg = config(settings);
  if (!checkConfig(cfg)) return null;
  const gen = genParams(settings);
  const generation = { systemInstruction: { parts: [{ text: SYSTEM_PROMPT_SUMMARY }] } };
  if (gen.temperature !== undefined) generation.temperature = gen.temperature;
  if (gen.maxTokens !== undefined) generation.maxOutputTokens = gen.maxTokens;

  try {
    const result = await postJson('Gemini', apiUrl(cfg), { 'Content-Type': 'application/json' }, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: generation
    });
    return result.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error(`Gemini summarize error (URL: ${cfg.baseUrl}, model: ${cfg.model}):`, error);
    return null;
  }
}

export const geminiAdapter = { analyze, summarize };
