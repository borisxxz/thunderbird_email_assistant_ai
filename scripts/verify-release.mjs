#!/usr/bin/env node
// Release verifier: confirms both update channels actually serve a version.
// Usage: node scripts/verify-release.mjs [version] [--wait]
//   version   defaults to manifest.json's version
//   --wait    poll up to 20 minutes until both channels are live
import fs from 'fs';
import { execFile } from 'child_process';

const version = process.argv.find(a => /^\d+\.\d+\.\d+$/.test(a))
  || JSON.parse(fs.readFileSync('manifest.json', 'utf8')).version;
const wait = process.argv.includes('--wait');

const GH = 'https://github.com/borisxxz/thunderbird_email_assistant_ai';
const CNB = 'https://cnb.cool/boris007/thunderbird_email_assistant_ai';

const checks = [
  { name: 'GitHub updates.json', kind: 'json', url: `${GH}/releases/latest/download/updates.json` },
  { name: 'GitHub -github.xpi', kind: 'head', url: `${GH}/releases/download/v${version}/email_assistant-${version}-github.xpi` },
  { name: 'GitHub -cnb.xpi', kind: 'head', url: `${GH}/releases/download/v${version}/email_assistant-${version}-cnb.xpi` },
  { name: 'CNB updates-cnb.json', kind: 'json', url: `${CNB}/-/git/raw/main/updates-cnb.json` },
  { name: 'CNB -cnb.xpi', kind: 'head', url: `${CNB}/-/releases/download/v${version}/email_assistant-${version}-cnb.xpi` },
];

// Node fetch to github.com is unreliable behind some networks; curl follows
// the same redirects and usually gets through — use it as a fallback.
function curlJson(url) {
  return new Promise((resolve, reject) => {
    execFile('curl', ['-sSL', '--max-time', '25', url], (err, stdout) => {
      if (err) return reject(err);
      try { resolve(JSON.parse(stdout)); } catch (e) { reject(e); }
    });
  });
}
function curlHead(url) {
  return new Promise((resolve, reject) => {
    execFile('curl', ['-sIL', '--max-time', '25', url], (err, stdout) => {
      if (err) return reject(err);
      const codes = [...stdout.matchAll(/^HTTP\/[\d.]+ (\d+)/gim)].map(m => Number(m[1]));
      const size = (stdout.match(/^content-length: *(\d+)/im) || [])[1];
      if (!codes.length) return reject(new Error('no status line'));
      resolve({ ok: codes[codes.length - 1] === 200, status: codes[codes.length - 1], size });
    });
  });
}

async function check(c) {
  const signal = AbortSignal.timeout(25000);
  try {
    if (c.kind === 'json') {
      let data;
      try {
        const resp = await fetch(c.url, { signal, redirect: 'follow' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        data = await resp.json();
      } catch (fetchErr) {
        data = await curlJson(c.url); // network fallback
        void fetchErr;
      }
      const addons = data.addons || {};
      const entry = Object.values(addons)[0];
      const seen = entry && entry.updates && entry.updates[0] && entry.updates[0].version;
      return seen === version
        ? { ok: true, detail: `version ${seen}` }
        : { ok: false, detail: `serves ${seen || 'nothing'}, expected ${version}` };
    }
    try {
      const resp = await fetch(c.url, { method: 'HEAD', signal, redirect: 'follow' });
      const size = resp.headers.get('content-length');
      return resp.ok
        ? { ok: true, detail: `HTTP ${resp.status}${size ? `, ${size} bytes` : ''}` }
        : { ok: false, detail: `HTTP ${resp.status}` };
    } catch (fetchErr) {
      const r = await curlHead(c.url); // network fallback
      void fetchErr;
      return r.ok
        ? { ok: true, detail: `HTTP ${r.status}${r.size ? `, ${r.size} bytes` : ''}` }
        : { ok: false, detail: `HTTP ${r.status}` };
    }
  } catch (err) {
    return { ok: false, detail: String(err.message || err) };
  }
}

async function runOnce() {
  const results = await Promise.all(checks.map(async c => ({ c, r: await check(c) })));
  for (const { c, r } of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${c.name}${r.detail ? `  (${r.detail})` : ''}`);
  }
  return results.every(x => x.r.ok);
}

(async () => {
  console.log(`Verifying release v${version} on both channels...`);
  if (!wait) {
    process.exit((await runOnce()) ? 0 : 1);
  }
  const deadline = Date.now() + 20 * 60 * 1000;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    console.log(`\n--- attempt ${attempt} (${new Date().toISOString()}) ---`);
    if (await runOnce()) {
      console.log(`\nRelease v${version} is live on both channels.`);
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, 30000));
  }
  console.error(`\nTimed out waiting for v${version} to go live.`);
  process.exit(1);
})();
