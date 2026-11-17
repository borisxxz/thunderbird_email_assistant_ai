// Version tracking: detect an upgrade at startup and show the release notes
// exactly once per new version. A fresh install stores the current version
// without showing anything; only a real version increase triggers the window.
function parts(version) {
  return String(version || '').split('.').map(n => parseInt(n, 10) || 0);
}

export function isNewerVersion(a, b) {
  const A = parts(a);
  const B = parts(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i] || 0;
    const y = B[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

export async function initVersionTracking() {
  const current = messenger.runtime.getManifest().version;
  const { lastSeenVersion } = await messenger.storage.local.get({ lastSeenVersion: null });
  // Persist first so a crash while the window opens cannot loop the popup.
  await messenger.storage.local.set({ lastSeenVersion: current });
  if (!lastSeenVersion) return null; // fresh install: nothing to announce
  return isNewerVersion(current, lastSeenVersion)
    ? { previous: lastSeenVersion, current }
    : null;
}