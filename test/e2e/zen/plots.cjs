// Simulates a tldraw page that does not expose window.editor (like signed-in files).
const fs = require('fs');
const path = require('path');
const { Builder, Key } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const [xpi, gd, out] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const opts = new firefox.Options().setBinary(process.env.ZEN_PATH || 'C:\\Program Files\\Zen Browser\\zen.exe').addArguments(...(process.env.HEADED ? [] : ['-headless'])).windowSize({ width: 1200, height: 800 });
  const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(opts).setFirefoxService(new firefox.ServiceBuilder(gd)).build();
  const js = (c, ...a) => driver.executeScript(c, ...a);
  const keys = async (s) => { for (const ch of s) { await driver.actions({ async: true }).sendKeys(ch).perform(); await sleep(40); } };
  try {
    await driver.installAddon(xpi, true);
    await driver.get('https://www.tldraw.com/');
    for (let i = 0; i < 60; i++) { if (await js('return !!window.editor')) break; await sleep(1000); }
    await sleep(3000);
    // keep a private handle for the test, then hide the global from the page
    await js("window.__testEditor = window.editor; Object.defineProperty(window, 'editor', { get() { return undefined; }, set() {}, configurable: true });");
    console.log('window.editor hidden:', await js('return window.editor === undefined'));
    let n = 0;
    for (const line of ['/plot f(x)=x^2, g(x)=2x', '/plot y=x^2 and y=2x', '/plot x^2; 2x', 'f(x) = x^2, g(x) = 2x+3 /draw', '/plot sin(x), cos(x)']) {
      await driver.actions({ async: true }).sendKeys(Key.ESCAPE).perform();
      await js('const e = window.__testEditor; e.selectNone(); e.deleteShapes([...e.getCurrentPageShapeIds()]);');
      await driver.actions({ async: true }).sendKeys('t').perform();
      await sleep(150);
      await driver.actions({ async: true }).move({ x: 200, y: 150 }).click().perform();
      await sleep(300);
      await keys(line);
      await driver.actions({ async: true }).sendKeys(Key.ENTER).perform();
      await sleep(1200);
      const s = await js("return window.__testEditor.getCurrentPageShapes().map(s => s.type)");
      const tx = await js("const p = (rt) => (rt?.content||[]).map(q => (q.content||[]).map(n => n.text||'').join('')).join('/'); return window.__testEditor.getCurrentPageShapes().filter(s => s.type === 'text').map(s => p(s.props.richText))");
      console.log('   texts:', JSON.stringify(tx));
      const toast = await js("const t = document.querySelector('[data-mathtyping-ui=toast]'); return t && t.style.display !== 'none' ? t.textContent : ''");
      const lines = s.filter((t) => t === 'line').length;
      console.log(JSON.stringify(line), '| shapes:', s.length, 'lines:', lines, 'group:', s.includes('group'), '| toast:', toast || '-');
      fs.writeFileSync(path.join(out, `noed${n++}.png`), await driver.takeScreenshot(), 'base64');
    }
  } finally { await driver.quit(); }
})().catch((e) => { console.error(e); process.exit(1); });
