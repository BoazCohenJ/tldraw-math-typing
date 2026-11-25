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

    await newText();
    await keys('alp');
    await sleep(250);
    const h1 = await hintText();
    check('suggestions for "alp"', h1.includes('alpha'), h1);
    fs.writeFileSync(path.join(out, 'hints16.png'), await driver.takeScreenshot(), 'base64');
    await press(Key.TAB);
    await sleep(200);
    check('Tab takes it', (await js('return document.activeElement.innerText')).trim() === 'α');

    await newText();
    await keys('the theorem to be in ');
    await sleep(250);
    check('no suggestions for ordinary words', !(await hintText()), await hintText());
    await keys('the');
    await sleep(200);
    check('"the" (3 letters) still suggests nothing English-like', !(await hintText()).includes('therefore'), await hintText());

    await newText();
    await keys('alp');
    await sleep(200);
    await press(Key.ESCAPE);
    await sleep(300);
    check('Esc with the card open still leaves the text box', !(await js(`return ${E}.getEditingShapeId()`)));

    await newText();
    await keys('d/dx x+1', 0); // as fast as possible: keys arrive during the hand-off
    await sleep(900);
    const t1 = await texts();
    check('fast typing after d/dx lands after it, in order', t1.includes('d') && t1.includes('dx') && t1.some((v) => v.includes('x+1')), JSON.stringify(t1));

    await newText();
    await keys('lim_{x->inf} sin(x)');
    await sleep(800);
    const t2 = await texts();
    check('lim_{x->inf} + space is drawn, typing continues', t2.includes('lim') && t2.includes('x→∞') && t2.some((v) => v.includes('sin(x)')), JSON.stringify(t2));
    fs.writeFileSync(path.join(out, 'lim16.png'), await driver.takeScreenshot(), 'base64');

    await newText();
    await keys('/diff e^x//(2-e^x)');
    await press(Key.ENTER);
    await sleep(400);
    const d = (await js('return document.activeElement.innerText')).trim();
    check('/diff e^x//(2-e^x)', d.startsWith('d/dx (eˣ/(2 − eˣ)) ='), d);

    await newText();
    await keys('y = x//{x+3} + 4 /draw');
    await press(Key.ENTER);
    await sleep(700);
    const t3 = await texts();
    check('a line with // is laid out, not graphed', t3.includes('x+3'), JSON.stringify(t3));

    await newText();
    await keys('* item **bold** my_name x_max');
    await sleep(200);
    const plain = (await js('return document.activeElement.innerText')).trim();
    // tldraw itself turns "* " into a list item and **bold** into bold; the add-on leaves both alone
    check('notes stay as typed', plain === 'item bold my_name xₘₐₓ', plain);

    for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : '  ' + r.info}`);
    console.log(`${results.filter((r) => r.ok).length}/${results.length} ok`);
  } finally { await driver.quit(); }
})().catch((e) => { console.error(e); process.exit(1); });
