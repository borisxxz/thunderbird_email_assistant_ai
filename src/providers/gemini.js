import { buildPrompt } from '../core/analysis.js';
import { providerSettings, SYSTEM_PROMPT, SYSTEM_PROMPT_SUMMARY } from '../core/config.js';
import { genParams, isAbortError, parseJsonResponse, postJson, trimBaseUrl } from './utils.js';

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

function apiUrl({ baseUrl, model }) {
  return `${baseUrl}/models/${model}:generateContent`;
}

function headers(apiKey) {
  // Header auth keeps the key out of URLs (and therefore server logs).
  return { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
}

async function analyze(settings, structuredData, customTags) {
  const cfg = config(settings);
  if (!checkConfig(cfg)) return null;

  const prompt = buildPrompt(structuredData, customTags, settings.provider);
  const gen = genParams(settings);
  const generation = { responseMimeType: "application/json" };
  if (gen.temperature !== undefined) generation.temperature = gen.temperature;
  if (gen.maxTokens !== undefined) generation.maxOutputTokens = gen.maxTokens;

  try {
    const result = await postJson('Gemini', apiUrl(cfg), headers(cfg.apiKey), {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: generation
    });
    return parseJsonResponse('Gemini', result && result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0] && result.candidates[0].content.parts[0].text);
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error(`Gemini Error (URL: ${cfg.baseUrl}, model: ${cfg.model}):`, error);
    return null;
  }
}

async function summarize(settings, prompt) {
  const cfg = config(settings);
  if (!checkConfig(cfg)) return null;
  const gen = genParams(settings);
  const generation = {};
  if (gen.temperature !== undefined) generation.temperature = gen.temperature;
  if (gen.maxTokens !== undefined) generation.maxOutputTokens = gen.maxTokens;

  try {
    const result = await postJson('Gemini', apiUrl(cfg), headers(cfg.apiKey), {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT_SUMMARY }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: generation
    });
    return result && result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0] && result.candidates[0].content.parts[0].text;
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.error(`Gemini summarize error (URL: ${cfg.baseUrl}, model: ${cfg.model}):`, error);
    throw error;
  }
}

export const geminiAdapter = { analyze, summarize };
