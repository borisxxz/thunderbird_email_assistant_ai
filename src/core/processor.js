import { DEFAULTS, HARDCODED_TAGS, TAG_KEY_PREFIX } from './config.js';
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

  if (analysis.is_scam || analysis.spf_pass === false || analysis.dkim_pass === false) {
    tagKeys.add(TAG_KEY_PREFIX + HARDCODED_TAGS.is_scam.key);
  }
  if (analysis.spf_pass === false) tagKeys.add(TAG_KEY_PREFIX + HARDCODED_TAGS.spf_fail.key);
  if (analysis.dkim_pass === false) tagKeys.add(TAG_KEY_PREFIX + HARDCODED_TAGS.dkim_fail.key);

  for (const tag of customTags) {
    if (analysis[tag.key] === true) {
      tagKeys.add(TAG_KEY_PREFIX + tag.key);
    }
  }

  return tagKeys;
}

// Analyze a message without touching its tags; returns { analysis, tagKeys } or null.
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

  const { customTags } = await messenger.storage.local.get({ customTags: DEFAULTS.customTags });
  return { analysis, tagKeys: tagsFromAnalysis(analysis, customTags) };
}

export async function processMessage(message) {
  const result = await analyzeMessage(message);
  if (!result) return false;

  const messageDetails = await messenger.messages.get(message.id);
  const existingTags = new Set(messageDetails.tags || []);

  await messenger.messages.update(message.id, { tags: Array.from(new Set([...existingTags, ...result.tagKeys])) });
  return true;
}
