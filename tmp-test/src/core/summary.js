import { DEFAULTS } from './config.js';
import { findEmailParts } from './analysis.js';
import { PROVIDER_ENGINES } from '../providers/index.js';

const SUMMARY_BODY_CHAR_LIMIT = 24000;

export function buildSummaryPrompt(headers, body, attachments, languageName) {
  const subject = (headers.subject && headers.subject[0]) || '';
  const from = (headers.from && headers.from[0]) || '';
  const trimmedBody = body.length > SUMMARY_BODY_CHAR_LIMIT
    ? body.substring(0, SUMMARY_BODY_CHAR_LIMIT) + '\n…[truncated]'
    : body;

  return [
    `Please summarize the following email in ${languageName}.`,
    '',
    'Subject: ' + subject,
    'From: ' + from,
    'Attachments: ' + (attachments.length ? attachments.map(a => a.name).join(', ') : 'none'),
    '',
    '--- Email body ---',
    trimmedBody
  ].join('\n');
}

export async function summarizeMessage(messageId, languageName) {
  const fullMessage = await messenger.messages.getFull(messageId);
  const { body, attachments } = findEmailParts(fullMessage.parts);

  const settings = await messenger.storage.local.get(DEFAULTS);
  const engine = PROVIDER_ENGINES[settings.provider];
  if (!engine) {
    console.error(`Email Assistant: No engine for provider: ${settings.provider}`);
    return null;
  }

  const prompt = buildSummaryPrompt(fullMessage.headers, body, attachments, languageName);
  const summary = await engine.summarize(settings, prompt);
  if (!summary) return null;

  return {
    summary,
    subject: (fullMessage.headers.subject && fullMessage.headers.subject[0]) || '',
    from: (fullMessage.headers.from && fullMessage.headers.from[0]) || ''
  };
}
