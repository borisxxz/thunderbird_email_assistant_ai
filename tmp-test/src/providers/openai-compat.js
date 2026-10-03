import { buildPrompt } from '../core/analysis.js';
import { PROVIDERS, providerSettings, SYSTEM_PROMPT, SYSTEM_PROMPT_SUMMARY } from '../core/config.js';
import { genParams, parseJsonResponse, postJson, trimBaseUrl } from './utils.js';

// Mistral and DeepSeek (and any OpenAI-compatible gateway the user points at)
// speak the /chat/completions protocol; OpenAI itself uses openai-responses.js.
export function createOpenAICompatAdapter(providerKey) {
  const label = providerKey;

  function credentials(settings) {
    const { apiKey: apiKeyField, baseUrl: baseUrlField, model: modelField } = providerSettings(providerKey);
    return {
      apiKey: settings[apiKeyField],
      baseUrl: trimBaseUrl(settings[baseUrlField]),
      model: settings[modelField],
      needsApiKey: PROVIDERS[providerKey].needsApiKey
    };
  }

  function checkConfig({ apiKey, baseUrl, needsApiKey }) {
    if (needsApiKey && !apiKey) {
      console.error(`${label} Error: API key is not set.`);
      return false;
    }
    if (!baseUrl) {
      console.error(`${label} Error: Base URL is not set.`);
      return false;
    }
    return true;
  }

  function headers(apiKey) {
    const base = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (apiKey) base['Authorization'] = `Bearer ${apiKey}`;
    return base;
  }

  async function analyze(settings, structuredData, customTags) {
    const cred = credentials(settings);
    if (!checkConfig(cred)) return null;

    const prompt = buildPrompt(structuredData, customTags);
    const gen = genParams(settings);

    try {
      const result = await postJson(label, `${cred.baseUrl}/chat/completions`, headers(cred.apiKey), {
        model: cred.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        ...(gen.temperature !== undefined && { temperature: gen.temperature }),
        ...(gen.maxTokens !== undefined && { max_tokens: gen.maxTokens })
      });
      return parseJsonResponse(label, result.choices[0].message.content);
    } catch (error) {
      console.error(`${label} Error (URL: ${cred.baseUrl}, model: ${cred.model}):`, error);
      return null;
    }
  }

  async function summarize(settings, prompt) {
    const cred = credentials(settings);
    if (!checkConfig(cred)) return null;
    const gen = genParams(settings);

    try {
      const result = await postJson(label, `${cred.baseUrl}/chat/completions`, headers(cred.apiKey), {
        model: cred.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT_SUMMARY },
          { role: "user", content: prompt }
        ],
        ...(gen.temperature !== undefined && { temperature: gen.temperature }),
        ...(gen.maxTokens !== undefined && { max_tokens: gen.maxTokens })
      });
      return result.choices[0].message.content;
    } catch (error) {
      console.error(`${label} summarize error (URL: ${cred.baseUrl}, model: ${cred.model}):`, error);
      return null;
    }
  }

  return { analyze, summarize };
}
