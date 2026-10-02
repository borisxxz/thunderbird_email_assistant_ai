import { ollamaAdapter } from './ollama.js';
import { geminiAdapter } from './gemini.js';
import { claudeAdapter } from './claude.js';
import { createOpenAICompatAdapter } from './openai-compat.js';
import { openaiResponsesAdapter } from './openai-responses.js';
import { PROVIDERS } from '../core/config.js';

const ADAPTERS_BY_KIND = {
  ollama: () => ollamaAdapter,
  gemini: () => geminiAdapter,
  claude: () => claudeAdapter,
  'openai-responses': () => openaiResponsesAdapter,
  'openai-compat': (providerKey) => createOpenAICompatAdapter(providerKey)
};

export const PROVIDER_ENGINES = Object.fromEntries(
  Object.entries(PROVIDERS).map(([key, meta]) => [key, ADAPTERS_BY_KIND[meta.kind](key)])
);
