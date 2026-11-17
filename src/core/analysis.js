import { htmlToText } from "html-to-text";
import { PROMPT_BASE, contextCharLimit } from './config.js';

export function findEmailParts(parts) {
  let textBody = '';
  let htmlBody = '';
  const attachments = [];

  function recurse(part) {
    if (part.parts) {
      part.parts.forEach(recurse);
      return;
    }
    if (part.contentType === 'text/plain' && !part.isAttachment) {
      textBody = part.body;
    } else if (part.contentType === 'text/html' && !part.isAttachment) {
      htmlBody = part.body;
    } else if (part.isAttachment || part.name) {
      attachments.push({
        name: part.name,
        mimeType: part.contentType,
        size: part.size
      });
    }
  }

  parts.forEach(recurse);

  let finalBody = textBody;
  if (htmlBody) {
    finalBody = htmlToText(htmlBody, { wordwrap: 130 });
  }

  return { body: finalBody, attachments };
}

export function buildPrompt(structuredData, customTags, provider) {
  const customInstructions = customTags.map(tag => `- ${tag.key}: (boolean) ${tag.prompt}`).join('\n');
  const charLimit = contextCharLimit(provider);

  // Substitute only the template. Custom tag prompts are user text and may
  // legitimately contain "{body}" or "{attachments}" — they must never be
  // expanded (which would duplicate the body and blow the budget).
  const assemble = (headers, attachments, body) => `${PROMPT_BASE
    .replace(/\{(headers|body|attachments)\}/g, (m, key) => (
      key === 'headers' ? headers : key === 'body' ? body : attachments
    ))}
${customInstructions}`;

  const originalBody = structuredData.body;
  let headers = JSON.stringify(structuredData.headers, null, 2);
  let attachments = JSON.stringify(structuredData.attachments, null, 2);
  // Refill the body against the CURRENT frame after every shrink: dropping the
  // attachment list or reducing headers frees space that the message body
  // should get back.
  const fitBody = () => {
    const room = Math.max(0, charLimit - assemble(headers, attachments, '').length);
    return originalBody.substring(0, room);
  };

  let emailBody = originalBody;
  let prompt = assemble(headers, attachments, emailBody);
  if (prompt.length > charLimit) {
    emailBody = fitBody();
    console.warn(`Email Assistant: Prompt exceeds ${charLimit} chars — truncating body to ${emailBody.length}.`);
    prompt = assemble(headers, attachments, emailBody);
  }
  if (prompt.length > charLimit) {
    console.warn('Email Assistant: Prompt too long — dropping attachment list.');
    attachments = '[]';
    emailBody = fitBody();
    prompt = assemble(headers, attachments, emailBody);
  }
  if (prompt.length > charLimit) {
    console.warn('Email Assistant: Prompt too long — reducing headers to the essentials.');
    const essential = {};
    for (const key of ['subject', 'from', 'to', 'date']) {
      if (structuredData.headers[key]) essential[key] = structuredData.headers[key];
    }
    headers = JSON.stringify(essential, null, 2);
    emailBody = fitBody();
    prompt = assemble(headers, attachments, emailBody);
  }
  if (prompt.length > charLimit) {
    // Last resort: trim the headers JSON too, but reserve part of the budget
    // for the message body — a prompt without any email text is useless.
    const bodyReserve = Math.min(4000, Math.floor(charLimit * 0.25));
    const room = Math.max(0, charLimit - assemble('', attachments, '').length - bodyReserve);
    headers = headers.substring(0, room);
    emailBody = fitBody();
    prompt = assemble(headers, attachments, emailBody);
  }
  if (prompt.length > charLimit) {
    console.error('Email Assistant: Instructions alone exceed the context budget; sending over-limit prompt.');
  }

  return prompt;
}
