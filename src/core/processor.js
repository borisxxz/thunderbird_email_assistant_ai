import { DEFAULTS } from './config.js';
import { findEmailParts } from './analysis.js';
import { PROVIDER_ENGINES } from '../providers/index.js';

async function analyzeEmail(structuredData) {
  const settings = await messenger.storage.local.get(DEFAULTS);
  const engine = PROVIDER_ENGINES[settings.provider];

  if (!engine) {
    console.error(`Email Assistant: No analysis engine found for provider: ${settings.provider}`);
    return null;
  }
  return engine.analyze(settings, structuredData, settings.customTags);
}

export function tagsFromAnalysis(analysis, customTags) {
  const tagKeys = new Set();
  for (const tag of customTags) {
    if (analysis[tag.key] === true) {
      tagKeys.add(tag.key);
    }
  }
  return tagKeys;
}

// Analyze a message without touching its tags; returns { analysis, tagKeys } or null.
// tagKeys are the real Thunderbird tag keys (same-name manual tags are reused).
export async function analyzeMessage(message) {
  const fullMessage = await messenger.messages.getFull(message.id);
  const { body, attachments } = findEmailParts(fullMessage.parts);

  const analysis = await analyzeEmail({
    headers: fullMessage.headers,
    body,
    attachments
  });

  if (!analysis) {
    console.log("Email Assistant: Skipping tagging due to analysis failure for ID:", message.id);
    return null;
  }

  const { customTags, tagKeys: keyMap } = await messenger.storage.local.get({
    customTags: DEFAULTS.customTags,
    tagKeys: {}
  });
  const tagKeys = [...tagsFromAnalysis(analysis, customTags)].map(key => keyMap[key] || key);
  return { analysis, tagKeys };
}
