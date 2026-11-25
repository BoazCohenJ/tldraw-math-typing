// tldraw Math Typing: runs the calculator commands (/calc /diff /integrate /solve /simplify
// /factor /expand) away from the page, so the 1 MB algebra library only loads when you use one
// and a slow command can be stopped (background.js ends this worker after a few seconds).
/* global importScripts, MathTools */
importScripts(
  'vendor/nerdamer/nerdamer.core.js', 'vendor/nerdamer/Algebra.js',
  'vendor/nerdamer/Calculus.js', 'vendor/nerdamer/Solve.js',
  'mathtools.js',
);

self.onmessage = (e) => {
  const { id, line, enabled } = e.data || {};
  try {
    const res = MathTools.runCommand(line, enabled);
    self.postMessage({ id, res: res && res.text != null ? { text: res.text } : res ? { other: true } : null });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
