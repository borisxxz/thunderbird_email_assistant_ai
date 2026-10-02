export const TAG_KEY_PREFIX = "_ma_";

export const HARDCODED_TAGS = {
  is_scam: { key: "is_scam", name: "诈骗警报 Scam Alert", color: "#FF5722" },
  spf_fail: { key: "spf_fail", name: "SPF验证失败 SPF Fail", color: "#E91E63" },
  dkim_fail: { key: "dkim_fail", name: "DKIM验证失败 DKIM Fail", color: "#E91E63" },
  failed: { key: "failed", name: "处理失败 Processing Failed", color: "#B71C1C" }
};

// Legacy tag from earlier versions; no longer applied, removed if present.
export const RETIRED_TAG_KEYS = ["_ma_tagged"];

export const DEFAULT_CUSTOM_TAGS = [
  {
    key: "is_advertise",
    name: "Advertisement",
    color: "#FFC107",
    prompt: "check if email is advertising something and contains an offer or someone is asking for contact to show the offer"
  },
  {
    key: "is_business",
    name: "Business",
    color: "#af4c87",
    prompt: "check if this looks like work related email"
  },
  {
    key: "is_service_important",
    name: "Service Important",
    color: "#F44336",
    prompt: "check if email contains important information related to already subscribed service (if this is subscription offer - ignore it): bill, password reset, login link, 2fa code, expiration notice. Consider common services like electricity, bank account, netflix, or similar subscription service."
  }
];

// kind: which request adapter handles this provider's protocol.
// baseUrl is configurable in the options page — including scheme, host and port —
// so users can point any provider at a local instance or gateway on a custom port.
// endpointSuffix is appended to baseUrl for the actual request URL (shown as a live preview in options).
export const PROVIDERS = {
  ollama: {
    label: "Ollama",
    kind: "ollama",
    defaultBaseUrl: "http://localhost:11434",
    defaultModel: "gemma3:27b",
    endpointSuffix: "api/generate",
    needsApiKey: false,
    privacyNote: null,
    extraHelp: {
      title: "Ollama Setup",
      body: "Ollama runs open-source LLMs locally. Install it from ollama.com, then start the server so Thunderbird can reach it. To connect on a custom host/port, set the Base URL accordingly (e.g. http://192.168.1.10:11434)."
    }
  },
  openai: {
    label: "OpenAI",
    kind: "openai-responses",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-6-astra",
    endpointSuffix: "responses",
    needsApiKey: true,
    privacyNote: "By using OpenAI, the content of your emails will be sent to and processed by a third-party service (openai.com). This includes potentially sensitive data."
  },
  gemini: {
    label: "Google Gemini",
    kind: "gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-1.5-flash-latest",
    endpointSuffix: "models/{model}:generateContent",
    needsApiKey: true,
    privacyNote: "By using Google Gemini, the content of your emails will be sent to and processed by a third-party service (Google). This includes potentially sensitive data."
  },
  claude: {
    label: "Anthropic Claude",
    kind: "claude",
    defaultBaseUrl: "https://api.anthropic.com",
    defaultModel: "claude-sonnet-4-0",
    endpointSuffix: "v1/messages",
    needsApiKey: true,
    privacyNote: "By using Anthropic Claude, the content of your emails will be sent to and processed by a third-party service (anthropic.com). This includes potentially sensitive data."
  },
  mistral: {
    label: "Mistral",
    kind: "openai-compat",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    endpointSuffix: "chat/completions",
    needsApiKey: true,
    privacyNote: "By using Mistral, the content of your emails will be sent to and processed by a third-party service (Mistral AI). This includes potentially sensitive data. Mistral is EU-based, which may help with GDPR compliance."
  },
  deepseek: {
    label: "DeepSeek",
    kind: "openai-compat",
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    endpointSuffix: "chat/completions",
    needsApiKey: true,
    privacyNote: "By using DeepSeek, the content of your emails will be sent to and processed by a third-party service (deepseek.com). This includes potentially sensitive data."
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    kind: "openai-compat",
    defaultBaseUrl: "http://127.0.0.1:8080/v1",
    defaultModel: "",
    endpointSuffix: "chat/completions",
    needsApiKey: false,
    optionalApiKey: true,
    privacyNote: "Requests are sent to the address you configure — a local gateway keeps your email content on this machine; a remote one receives it. If the gateway requires an API key, fill it in (optional)."
  }
};

export function providerSettings(providerKey) {
  const meta = PROVIDERS[providerKey];
  return {
    apiKey: `${providerKey}ApiKey`,
    baseUrl: `${providerKey}BaseUrl`,
    model: `${providerKey}Model`,
    meta
  };
}

export const DEFAULTS = {
  provider: "ollama",
  customTags: DEFAULT_CUSTOM_TAGS,
  concurrency: 2,
  temperature: null,
  maxTokens: null,
  maxAttempts: 3,
  batchAction: "tag", // tag | tag_move | move
  ...Object.fromEntries(
    Object.entries(PROVIDERS).flatMap(([key, meta]) => [
      [`${key}ApiKey`, ""],
      [`${key}BaseUrl`, meta.defaultBaseUrl],
      [`${key}Model`, meta.defaultModel]
    ])
  )
};

export const PROMPT_BASE = [
  'Hi, I like you to check and score an email based on the following structured data. Please respond as a single, clean JSON object with the specified properties.',
  '',
  '### Email Headers',
  '```json',
  '{headers}',
  '```',
  '',
  '### Email Body (converted from HTML to plain text)',
  '```text',
  '{body}',
  '```',
  '',
  '### Attachments',
  '```json',
  '{attachments}',
  '```',
  '',
  '### INSTRUCTIONS',
  'Based on the data above, please populate the following JSON object:',
  '- sender: simply extract \'from\'',
  '- sender_consistent: check if from fields is consistent with headers and is not trying to spool identity',
  '- spf_pass: (boolean) check if there is positive verification in spf headers (leave null if no information is available or for spf-soft fail with ~all)',
  '- dkim_pass: (boolean) check if there is positive verification in dkim headers (leave null if no information is available)',
  '- is_scam: (boolean) check if the mail sounds like a scam'
].join('\n');

export const CONTEXT_TOKEN_LIMIT = 128000;
export const CHARS_PER_TOKEN_ESTIMATE = 4;
export const CONTEXT_CHAR_LIMIT = CONTEXT_TOKEN_LIMIT * CHARS_PER_TOKEN_ESTIMATE;

export const SYSTEM_PROMPT = "You are an email analysis expert. Your task is to analyze the provided email data and respond only with a single, clean JSON object that strictly follows the requested schema. Do not include any conversational text, markdown formatting, or explanations in your response.";

export const SYSTEM_PROMPT_SUMMARY = "You are an email assistant. Summarize the given email accurately and concisely for the user. Use the language explicitly requested in the user message. Structure the summary in 2-4 short paragraphs or bullet points, covering: what the email is about, any action required from the recipient, and key dates or deadlines if present. Do not add commentary of your own.";
