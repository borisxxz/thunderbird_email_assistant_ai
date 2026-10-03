export function extractJson(text) {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("Could not find a valid JSON object in the response.");
  }
  return text.substring(firstBrace, lastBrace + 1);
}

export function trimBaseUrl(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

// Map the user's advanced settings onto the protocol-specific request fields.
// temperature/maxTokens are null when unset ("use provider default").
export function genParams(settings) {
  const out = {};
  const temp = Number(settings.temperature);
  if (settings.temperature !== null && settings.temperature !== '' && Number.isFinite(temp)) {
    out.temperature = temp;
  }
  const tokens = Number(settings.maxTokens);
  if (settings.maxTokens !== null && settings.maxTokens !== '' && Number.isInteger(tokens) && tokens > 0) {
    out.maxTokens = tokens;
  }
  return out;
}

export function parseJsonResponse(label, rawText) {
  try {
    return JSON.parse(extractJson(rawText));
  } catch (error) {
    console.error(`${label} Error: could not parse JSON from response:`, rawText);
    return null;
  }
}

export async function postJson(label, url, headers, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: currentAbort ? currentAbort.signal : undefined
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`API request failed: ${response.status} ${response.statusText} ${detail}`.trim());
  }
  return response.json();
}

// Abort plumbing: lets the batch cancel button kill in-flight LLM requests
// immediately instead of waiting for them to time out.
let currentAbort = null;

export function armAbort() {
  currentAbort = new AbortController();
  return currentAbort;
}

export function triggerAbort() {
  if (currentAbort) currentAbort.abort();
}
