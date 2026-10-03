const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const MAILS = [{ id: 1, subject: 'M1', tags: [] }];
const store = { language: 'zh-CN', customTags: [{ name: '广告', key: 'ads', color: '#FFC107', prompt: 'p', folder: 'none' }], tagKeys: {}, batchAction: 'tag', maxAttempts: 3 };
let messageHandler = null; let failed = 0;
const check = (n, c) => { console.log(c ? 'PASS' : 'FAIL', n); if (!c) failed++; };
// fetch 挂起 30 秒模拟慢 AI；abort signal 触发时立即抛 AbortError
globalThis.fetch = (url, opts) => new Promise((_, reject) => {
  opts.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
});
globalThis.messenger = {
  storage: { local: { async get(d) { return { ...d, ...store }; }, async set(o) { Object.assign(store, o); } } },
  messages: {
    async getFull() { return { headers: {}, parts: [{ contentType: 'text/plain', body: 'MAIL-1' }] }; },
    async get(id) { return MAILS[0]; }, async update() {}, async move() {},
    tags: { list: async () => [], create: async () => {}, update: async () => {}, delete: async () => {} },
    continueList: async () => { throw new Error('x'); }
  },
  folders: { async get() { return null; } }, accounts: { async get() { return { rootFolder: { id: 'a' } }; } },
  mailTabs: { async query() { return [{ id: 7 }]; }, getSelectedMessages: async () => ({ id: null, messages: MAILS }) },
  notifications: { create: async () => {} },
  runtime: { onMessage: { addListener(h) { messageHandler = h; } }, getURL: p => p, sendMessage: async () => {} },
  windows: { create: async () => ({}) }, messageDisplay: { getDisplayedMessage: async () => null }, messageDisplayAction: { onClicked: { addListener() {} } }
};
await import('./src/background.js');
await sleep(60);
await messageHandler({ type: 'ea.batch.start' });
let st = await messageHandler({ type: 'ea.batch.status' });
check('分析中', st.phase === 'analyzing');
const t0 = Date.now();
await messageHandler({ type: 'ea.batch.cancel' });
const wait = async (ms) => { const e = Date.now() + ms; while (Date.now() < e) { st = await messageHandler({ type: 'ea.batch.status' }); if (st.phase === 'cancelled') return true; await sleep(30); } return false; };
check('取消在 3 秒内生效（而非等 30s 超时）', await wait(3000), `phase=${st.phase} elapsed=${Date.now()-t0}ms`);
check('未把 abort 记为失败', st.fail === 0, st.fail);
process.exit(failed ? 1 : 0);
