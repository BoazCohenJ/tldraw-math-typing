// tldraw Math Typing: put the add-on into tldraw tabs that are already open, so they work
// without a reload: after an install or update, and when you allow it on tldraw.com.
// content.js makes sure only the newest copy runs in a tab.
const ext = globalThis.browser ?? globalThis.chrome;

const ORIGINS = ['https://tldraw.com/*', 'https://*.tldraw.com/*'];
const CONTENT = [
  'rules.js', 'fonts.js',
  'vendor/nerdamer/nerdamer.core.js', 'vendor/nerdamer/Algebra.js',
  'vendor/nerdamer/Calculus.js', 'vendor/nerdamer/Solve.js',
  'mathtools.js', 'content.js',
];

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
// The popup's "Start in this tab" button.
ext.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'mathtyping:attach') return attachOpenTabs().then(() => ({ ok: true }));
  return undefined;
});
