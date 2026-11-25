// 1.6 checks in headless Zen, with window.editor hidden like on signed-in boards.
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
  const keys = async (s, delay = 45) => { for (const ch of s) { await driver.actions({ async: true }).sendKeys(ch).perform(); if (delay) await sleep(delay); } };
  const press = (k) => driver.actions({ async: true }).sendKeys(k).perform();
  const E = 'window.__testEditor';
  const texts = () => js(`const p = (rt) => (rt?.content||[]).map(q => (q.content||[]).map(n => n.text||'').join('')).join('/'); return ${E}.getCurrentPageShapes().filter(s => s.type === 'text').map(s => p(s.props.richText).replace(/\\u200B/g, ''))`);
  const newText = async () => {
    await press(Key.ESCAPE);
    await js(`const e = ${E}; e.selectNone(); e.setEditingShape(null); e.deleteShapes([...e.getCurrentPageShapeIds()]);`);
    await sleep(100);
    await press('t');
    await sleep(120);
    await driver.actions({ async: true }).move({ x: 200, y: 200 }).click().perform();
    await sleep(250);
  };
  const hintText = () => js("const h = document.querySelector('[data-mathtyping-ui=hints]'); const c = h && h.shadowRoot.querySelector('.card'); return c && c.style.display !== 'none' ? c.textContent : ''");
  const results = [];
  const check = (name, ok, info) => results.push({ name, ok: !!ok, info });
  try {
    await driver.installAddon(xpi, true);
    await driver.get('https://www.tldraw.com/');
    for (let i = 0; i < 60; i++) { if (await js('return !!window.editor')) break; await sleep(1000); }
    await sleep(2500);
    await js("window.__testEditor = window.editor; Object.defineProperty(window, 'editor', { get() { return undefined; }, set() {}, configurable: true });");

    const toastText = () => js("const t = document.querySelector('[data-mathtyping-ui=toast]'); return t && t.style.display !== 'none' ? t.textContent : ''");
    await newText();
    await keys('/expand (x+y+z+w+1)^25');
    await press(Key.ENTER);
    let seen = '';
    for (let i = 0; i < 20 && !/too long/.test(seen); i++) { await sleep(500); seen = await toastText(); }
    check('a command that runs too long is stopped with a message', /too long/.test(seen), seen);
    check('the line is kept', (await js('return document.activeElement.innerText')).includes('/expand'));
    await newText();
    await keys('/calc 2^10/3');
    await press(Key.ENTER);
    await sleep(1500);
    const c = (await js('return document.activeElement.innerText')).trim();
    check('the calculator works again right after', c.startsWith('2¹⁰/3 = 1024/3'), c);
    for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : '  ' + r.info}`);
    console.log(`${results.filter((r) => r.ok).length}/${results.length} ok`);
  } finally { await driver.quit(); }
})().catch((e) => { console.error(e); process.exit(1); });
