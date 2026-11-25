// tldraw Math Typing background script:
// - puts the add-on into tldraw tabs that are already open, so they work without a reload
//   (after an install or update, and when you allow it on tldraw.com);
// - runs calculator commands in a worker with a time limit (cas-worker.js).
const ext = globalThis.browser ?? globalThis.chrome;

const ORIGINS = ['https://tldraw.com/*', 'https://*.tldraw.com/*'];
const CONTENT = ['rules.js', 'fonts.js', 'mathtools.js', 'content.js'];

const attachOpenTabs = async () => {
  let tabs = [];
  try {
    tabs = await ext.tabs.query({ url: ORIGINS });
  } catch (_) { return; }
  for (const tab of tabs) {
    const target = { tabId: tab.id, allFrames: false };
    try {
      await ext.scripting.insertCSS({ target, files: ['content.css'] });
      await ext.scripting.executeScript({ target, files: ['page.js'], world: 'MAIN' });
      await ext.scripting.executeScript({ target, files: CONTENT });
    } catch (err) {
      console.warn('[math typing] could not attach to an open tab', tab.url, err);
    }
  }
};

ext.runtime.onInstalled.addListener(attachOpenTabs);
// Firefox asks before an add-on may run on a site: once you allow tldraw.com, start right away.
if (ext.permissions && ext.permissions.onAdded) {
  ext.permissions.onAdded.addListener((perms) => {
    if ((perms.origins || []).some((o) => o.includes('tldraw.com'))) attachOpenTabs();
  });
}

// ---------------------------------------------------------------- calculator
// Chrome's background is a service worker without Worker; it may only load scripts at startup.
if (typeof Worker === 'undefined' && typeof importScripts === 'function') {
  try {
    importScripts('vendor/nerdamer/nerdamer.core.js', 'vendor/nerdamer/Algebra.js',
      'vendor/nerdamer/Calculus.js', 'vendor/nerdamer/Solve.js', 'mathtools.js');
  } catch (_) { /* the calculator then reports an error */ }
}
const LIMIT_MS = 6000;
let worker = null;
let nextId = 1;
const waiting = new Map();

const startWorker = () => {
  if (worker) return worker;
  worker = new Worker('cas-worker.js');
  worker.onmessage = (e) => {
    const { id } = e.data || {};
    const done = waiting.get(id);
    if (!done) return;
    waiting.delete(id);
    done(e.data);
  };
  worker.onerror = () => stopWorker('the calculator failed to start');
  return worker;
};
const stopWorker = (reason) => {
  if (worker) worker.terminate();
  worker = null;
  for (const done of waiting.values()) done({ error: reason });
  waiting.clear();
};

const runCas = (line, enabled) => {
  // Chrome's service worker has no Worker: there the commands run directly (no time limit).
  if (typeof Worker === 'undefined') {
    try {
      if (!globalThis.MathTools) throw new Error('the calculator is not available here');
      const res = globalThis.MathTools.runCommand(line, enabled);
      return Promise.resolve({ res: res && res.text != null ? { text: res.text } : null });
    } catch (err) {
      return Promise.resolve({ error: String((err && err.message) || err) });
    }
  }
  return new Promise((resolve) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      if (!waiting.has(id)) return;
      // A command that runs too long would never end on its own: stop the worker.
      stopWorker('that took too long to work out');
    }, LIMIT_MS);
    waiting.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
    startWorker().postMessage({ id, line, enabled });
  });
};

// sendResponse + `return true` (not a returned Promise) works in both Firefox and Chrome.
ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return false;
  let job = null;
  // The popup's "Start" button.
  if (msg.type === 'mathtyping:attach') job = attachOpenTabs().then(() => ({ ok: true }));
  if (msg.type === 'mathtyping:cas') job = runCas(String(msg.line || ''), msg.enabled || {});
  if (!job) return false;
  job.then(sendResponse, (err) => sendResponse({ error: String((err && err.message) || err) }));
  return true;
});
