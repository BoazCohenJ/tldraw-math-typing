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
    await driver.get('https://www.tldraw.com/');
    for (let i = 0; i < 60; i++) { if (await js('return !!window.editor')) break; await sleep(1000); }
    await sleep(2000);
    if (process.env.LATE) { await driver.installAddon(xpi, true); console.log('installed after the tab was open'); } else { await driver.installAddon(xpi, true); await driver.navigate().refresh(); for (let i = 0; i < 60; i++) { if (await js('return !!window.editor')) break; await sleep(1000); } }
    await sleep(3000);
    // keep a private handle for the test, then hide the global from the page
    await js("window.__testEditor = window.editor; Object.defineProperty(window, 'editor', { get() { return undefined; }, set() {}, configurable: true });");
    console.log('window.editor hidden:', await js('return window.editor === undefined'));
    let n = 0;
    for (const line of ['sqrt{(3-k)^2+(4-t)}']) {
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
      const toast = await js("return [...document.body.children].filter(d => d.style.display !== 'none').map(d => d.textContent).filter(t => t && t.startsWith('Math typing')).join(' | ')");
      const lines = s.filter((t) => t === 'line').length;
      console.log(JSON.stringify(line), '| shapes:', s.length, 'lines:', lines, 'group:', s.includes('group'), '| toast:', toast || '-');
      fs.writeFileSync(path.join(out, `noed${n++}.png`), await driver.takeScreenshot(), 'base64');
    }
  } finally { await driver.quit(); }
})().catch((e) => { console.error(e); process.exit(1); });
