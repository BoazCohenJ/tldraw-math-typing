// End-to-end test in Chromium with the built Chrome package (dist/chrome) on tldraw.com.
// Run: npm run e2e:chrome   (CHROME_PATH=... to use a specific Chromium/Chrome build)
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require('playwright');

const EXT = path.join(__dirname, '..', '..', 'dist', 'chrome');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-chrome-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    executablePath: process.env.CHROME_PATH || undefined,
    viewport: { width: 1200, height: 800 },
    args: ['--headless=new', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  const results = [];
  const check = (name, ok, info) => results.push({ name, ok: !!ok, info });
  try {
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const extId = new URL(sw.url()).host;
    check('service worker started', !!extId, sw.url());

    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('https://www.tldraw.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.tl-canvas', { timeout: 60000 });
    await sleep(3000);
    const editorExpr = 'window.editor';
    const newText = async () => {
      await page.keyboard.press('Escape');
      await page.evaluate(`(() => { const e = ${editorExpr}; e.selectNone(); e.setEditingShape(null); e.deleteShapes([...e.getCurrentPageShapeIds()]); })()`);
      await page.keyboard.press('t');
      await page.mouse.click(250, 250);
      await sleep(250);
    };
    const type = async (s) => { for (const ch of s) { await page.keyboard.type(ch); await sleep(40); } };
    const editing = () => page.evaluate(() => (document.activeElement && document.activeElement.innerText || '').trim());
    const texts = () => page.evaluate(`${editorExpr}.getCurrentPageShapes().filter(s => s.type === 'text').map(s => (s.props.richText.content || []).map(p => (p.content || []).map(n => n.text || '').join('')).join('/').replace(/\\u200B/g, ''))`);
    const shapes = () => page.evaluate(`${editorExpr}.getCurrentPageShapes().map(s => s.type)`);

    check('page script loaded', await page.evaluate(() => document.documentElement.dataset.mathtypingPage === '1'));

    await newText();
    await type('x^2 + alpha <= pi ');
    check('typing: x^2 + alpha <= pi', (await editing()) === 'x² + α ≤ π', await editing());

    await newText();
    await type('sqrt{x+1}');
    await sleep(700);
    const t1 = await texts();
    check('sqrt{x+1} is drawn as a root', t1.includes('x+1') && (await shapes()).includes('line'), JSON.stringify(t1));

    await newText();
    await type('/calc 2^10/3');
    await page.keyboard.press('Enter');
    await sleep(2500);
    check('/calc runs in the service worker', (await editing()).startsWith('2¹⁰/3 = 1024/3'), await editing());

    await newText();
    await type('/diff x^3 sin(x)');
    await page.keyboard.press('Enter');
    await sleep(2500);
    check('/diff', (await editing()) === 'd/dx (x³·sin(x)) = 3x²·sin(x) + x³·cos(x)', await editing());

    await newText();
    await type('/plot f(x)=x^2, g(x)=2x');
    await page.keyboard.press('Enter');
    await sleep(1200);
    const s = await shapes();
    check('/plot with two functions draws a graph', s.filter((t) => t === 'line').length > 6 && s.includes('group'), JSON.stringify(s));
    await page.screenshot({ path: path.join(os.tmpdir(), 'mt-chrome-plot.png') });

    await newText();
    await type('y = x//{x+3} + 4 /draw');
    await page.keyboard.press('Enter');
    await sleep(900);
    check('/draw lays out a fraction', (await texts()).includes('x+3'), JSON.stringify(await texts()));

    const popup = await ctx.newPage();
    const popupErrors = [];
    popup.on('pageerror', (e) => popupErrors.push(String(e)));
    await popup.goto(`chrome-extension://${extId}/popup.html`);
    await sleep(800);
    const rows = await popup.evaluate(() => document.querySelectorAll('#sheet-list .item').length);
    const status = await popup.evaluate(() => document.getElementById('status-text').textContent);
    check('popup renders its shortcut list', rows > 50, rows);
    check('popup shows a status', status && status !== 'Checking this tab…', status);
    check('no page errors from the extension', !errors.concat(popupErrors).some((e) => /math|typing|mathtyping/i.test(e)), JSON.stringify(errors.concat(popupErrors)));

    for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : '  ' + r.info}`);
    const passed = results.filter((r) => r.ok).length;
    console.log(`${passed}/${results.length} ok`);
    process.exitCode = passed === results.length ? 0 : 1;
  } finally {
    await ctx.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
