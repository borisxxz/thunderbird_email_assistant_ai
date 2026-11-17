// Extract a JSON object by scanning for balanced braces while respecting
// strings and escapes. Greedy first-{/last-} slicing breaks when the model
// appends commentary containing "}" after the JSON.
export function extractJson(text) {
  const start = text.indexOf('{');
  if (start === -1) throw new Error("Could not find a valid JSON object in the response.");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.substring(start, i + 1);
    }
  }
  throw new Error("Could not find a valid JSON object in the response.");
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
  if (!rawText) return null;
  try {
    return JSON.parse(extractJson(rawText));
  } catch (error) {
    console.error(`${label} Error: could not parse JSON from response:`, rawText);
    return null;
  }
}

export function isAbortError(error) {
  return error && (error.name === 'AbortError' || /aborted|cancelled/i.test(String(error.message || error)));
}

// A hanging LLM request must not wedge a batch worker forever. Callers that
// want cancellation without a timeout can pass Infinity.
export const LLM_TIMEOUT_MS = 120000;

export async function postJson(label, url, headers, body, timeoutMs = LLM_TIMEOUT_MS) {
  const controller = new AbortController();
  // Capture the controller that this request registered on. armAbort() may
  // replace the module-level one while the request is in flight; the listener
  // must still be attached to (and removed from) the original signal.
  const sourceAbort = currentAbort;
  // Forward the source signal's reason (an AbortError DOMException), not the
  // Event object: fetch rejects with signal.reason, and providers detect
  // cancellation via error.name === 'AbortError'.
  const relay = () => {
    const reason = sourceAbort && sourceAbort.signal.reason;
    controller.abort(reason);
  };
  if (sourceAbort && sourceAbort.signal.aborted) relay();
  else if (sourceAbort) sourceAbort.signal.addEventListener('abort', relay, { once: true });
  let timer = null;
  if (Number.isFinite(timeoutMs)) {
    timer = setTimeout(() => controller.abort(new Error(`${label} request timed out (${timeoutMs / 1000}s)`)), timeoutMs);
  }
  let response;
  try {
    response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
  } catch (error) {
    // Batch cancel must stay distinguishable from a provider failure.
    if (isAbortError(error) && !(sourceAbort && sourceAbort.signal.aborted)) {
      throw new Error(`${label} request timed out`);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    if (sourceAbort) sourceAbort.signal.removeEventListener('abort', relay);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`API request failed: ${response.status} ${response.statusText} ${detail}`.trim());
  }
  return response.json();
}

// Abort plumbing: lets the batch cancel button kill in-flight LLM requests
// immediately instead of waiting them to time out. A per-request timeout
// controller is always created inside postJson, so cancelling one request
// never disables timeouts on later ones.
let currentAbort = null;

export function armAbort() {
  currentAbort = new AbortController();
  return currentAbort;
}

export function triggerAbort() {
  if (currentAbort) currentAbort.abort();
}
