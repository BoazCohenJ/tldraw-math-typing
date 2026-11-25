// Edit a command line (delete, retype, move back) and then press Enter: it must still run.
const { Builder, Key } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const [xpi, gd] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const opts = new firefox.Options().setBinary(process.env.ZEN_PATH || 'C:\\Program Files\\Zen Browser\\zen.exe').addArguments(...(process.env.HEADED ? [] : ['-headless'])).windowSize({ width: 1200, height: 800 });
  const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(opts).setFirefoxService(new firefox.ServiceBuilder(gd)).build();
  const js = (c, ...a) => driver.executeScript(c, ...a);
  const keys = async (s) => { for (const ch of s) { await driver.actions({ async: true }).sendKeys(ch).perform(); await sleep(45); } };
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await driver.actions({ async: true }).sendKeys(k).perform(); await sleep(60); } };
  const E = 'window.__testEditor';
  const newText = async () => {
    await press(Key.ESCAPE);
    await js(`const e = ${E}; e.selectNone(); e.setEditingShape(null); e.deleteShapes([...e.getCurrentPageShapeIds()]);`);
    await sleep(100);
    await press('t');
    await sleep(120);
    await driver.actions({ async: true }).move({ x: 200, y: 200 }).click().perform();
    await sleep(250);
  };
  const results = [];
  const check = (name, ok, info) => results.push({ name, ok: !!ok, info });
  try {
    await driver.installAddon(xpi, true);
    await driver.get('https://www.tldraw.com/');
    for (let i = 0; i < 60; i++) { if (await js('return !!window.editor')) break; await sleep(1000); }
    await sleep(2500);
    await js("window.__testEditor = window.editor; Object.defineProperty(window, 'editor', { get() { return undefined; }, set() {}, configurable: true });");

    // 1: type, undo a conversion with Backspace, delete, retype, move back, Enter
    await newText();
    await keys('/plot x^2');
    await press(Key.BACK_SPACE); // undoes x² -> x^2
    await press(Key.BACK_SPACE, 2);
    await keys('^3, 2x');
    await press(Key.ARROW_LEFT, 4);
    const pieces = await js('const p = document.activeElement.querySelector("p"); return p ? p.childNodes.length : -1');
    await press(Key.ENTER);
    await sleep(900);
    let s = await js(`return ${E}.getCurrentPageShapes().map(s => s.type)`);
    check('edited /plot line, caret moved back, Enter: plots', s.filter((t) => t === 'line').length > 6, `pieces=${pieces} ${JSON.stringify(s)}`);

    // 2: /calc with a fix in the middle
    await newText();
    await keys('/calc 1+2*5');
    await press(Key.ARROW_LEFT, 1);
    await press(Key.BACK_SPACE);
    await keys('-');
    await press(Key.ENTER);
    await sleep(1500);
    const c = (await js('return document.activeElement.innerText')).trim();
    check('edited /calc mid-line, Enter: answers the whole line', c === '1 + 2 − 5 = −2', c);

    // 3: a conversion undone and redone, then /solve
    await newText();
    await keys('/solve x^2');
    await press(Key.BACK_SPACE); // undoes x² -> x^2
    await keys('-4=0');
    await press(Key.ENTER);
    await sleep(1500);
    const d = (await js('return document.activeElement.innerText')).trim();
    check('after Backspace-undo, /solve still runs', /x = −2 or x = 2|x = 2 or x = −2/.test(d), d);

    for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : '  ' + r.info}`);
    console.log(`${results.filter((r) => r.ok).length}/${results.length} ok`);
  } finally { await driver.quit(); }
})().catch((e) => { console.error(e); process.exit(1); });
