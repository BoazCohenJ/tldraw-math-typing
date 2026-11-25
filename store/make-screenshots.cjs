// Store screenshots (1280×800) and the Chrome Web Store promo tile (440×280), made with the
// real extension (dist/chrome) on tldraw.com. Run: npm run screenshots
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const EXT = path.join(ROOT, 'dist', 'chrome');
const OUT = path.join(__dirname, 'screenshots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SCENES = [
  { file: '1-calculus.png', lines: [
    'Q1. f(x) = x^2 e^{2x}', "a) f'(x) = ?", '/diff x^2 e^(2x)', 'b) area under f from 0 to 1:',
    'A = int_{0}^{1} x^2 e^{2x} dx ', '/integrate x^2 e^(2x) from 0 to 1'] },
  { file: '2-graph.png', lines: [
    'Q3. circle x^2 + y^2 - 6x = 7 and line y = x - 3', '/plot x^2 + y^2 - 6x = 7, y = x - 3'] },
  { file: '3-equations.png', lines: [
    'Q2. solve x^2 - 5x + 6 = 0', 'x = {-b +- sqrt{b^2 - 4ac}}//{2a} /draw', '/solve x^2 - 5x + 6 = 0',
    'lim_{x->0} sin(x)//x = 1'] },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-shots-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    executablePath: process.env.CHROME_PATH || undefined,
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
    args: ['--headless=new', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  try {
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker');
    const extId = new URL(sw.url()).host;
    const page = await ctx.newPage();
    await page.goto('https://www.tldraw.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.tl-canvas', { timeout: 60000 });
    await sleep(3000);
    const type = async (s) => { for (const ch of s) { await page.keyboard.type(ch); await sleep(30); } };
    const clear = () => page.evaluate(() => {
      const e = window.editor;
      e.selectNone(); e.setEditingShape(null); e.deleteShapes([...e.getCurrentPageShapeIds()]);
    });
    const fit = () => page.evaluate(() => {
      const e = window.editor;
      e.selectNone();
      e.zoomToFit({ animation: { duration: 0 } });
      if (e.getZoomLevel() > 1.6) e.setCamera({ ...e.getCamera(), z: 1.6 }, { animation: { duration: 0 } });
      e.zoomToFit({ animation: { duration: 0 }, inset: 120 });
    });

    for (const scene of SCENES) {
      await page.keyboard.press('Escape');
      await clear();
      await page.keyboard.press('t');
      await page.mouse.click(120, 140);
      await sleep(300);
      for (let i = 0; i < scene.lines.length; i++) {
        await type(scene.lines[i]);
        const isCmd = scene.lines[i].startsWith('/') || / \/draw$/.test(scene.lines[i]) || scene.lines[i].includes('//');
        if (i < scene.lines.length - 1 || isCmd) await page.keyboard.press('Enter');
        await sleep(isCmd ? 1800 : 300);
      }
      await page.keyboard.press('Escape');
      await sleep(400);
      await fit();
      await sleep(600);
      await page.screenshot({ path: path.join(OUT, scene.file) });
    }

    // the suggestion card
    await page.keyboard.press('Escape');
    await clear();
    await page.evaluate(() => { window.editor.resetZoom(); window.editor.zoomIn(); window.editor.zoomIn(); });
    await page.keyboard.press('t');
    await page.mouse.click(360, 300);
    await sleep(300);
    await type('Let x ');
    await type('\\sub');
    await sleep(500);

    await page.screenshot({ path: path.join(OUT, '4-suggestions.png') });
    await page.keyboard.press('Escape');

    // the popup, shown next to a board
    const popup = await ctx.newPage();
    await popup.setViewportSize({ width: 400, height: 560 });
    await popup.goto(`chrome-extension://${extId}/popup.html`);
    await sleep(500);
    const popupPng = await popup.screenshot();
    await popup.close();
    await clear();
    await sleep(300);
    const board = await page.screenshot();
    const comp = await ctx.newPage();
    await comp.setViewportSize({ width: 1280, height: 800 });
    await comp.setContent(`<html><body style="margin:0;width:1280px;height:800px;position:relative;overflow:hidden;font-family:system-ui">
      <img src="data:image/png;base64,${board.toString('base64')}" style="position:absolute;inset:0;width:1280px;height:800px;filter:blur(2px) brightness(0.92)">
      <img src="data:image/png;base64,${popupPng.toString('base64')}" style="position:absolute;right:120px;top:120px;width:400px;height:560px;border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.35)">
      <div style="position:absolute;left:110px;top:300px;max-width:560px;color:#15171c">
        <div style="font-size:44px;font-weight:700;letter-spacing:-0.02em">Every shortcut, one click away</div>
        <div style="font-size:22px;margin-top:14px;color:#3d424d">Search the list, add your own shortcuts, and switch each feature on or off.</div>
      </div></body></html>`);
    await sleep(300);
    await comp.screenshot({ path: path.join(OUT, '5-popup.png') });

    // promo tile for the Chrome Web Store
    const iconB64 = fs.readFileSync(path.join(ROOT, 'src', 'icons', 'icon-128.png')).toString('base64');
    await comp.setViewportSize({ width: 440, height: 280 });
    await comp.setContent(`<html><body style="margin:0;width:440px;height:280px;background:linear-gradient(135deg,#2f6fde,#1d4fb8);color:#fff;font-family:system-ui;display:flex;align-items:center;gap:22px;padding:0 34px;box-sizing:border-box">
      <img src="data:image/png;base64,${iconB64}" style="width:96px;height:96px;border-radius:22px;box-shadow:0 8px 24px rgba(0,0,0,.25)">
      <div><div style="font-size:30px;font-weight:700;line-height:1.1">Math Typing</div>
      <div style="font-size:15px;opacity:.9;margin-top:6px">for tldraw</div>
      <div style="font-size:22px;margin-top:14px;letter-spacing:.04em">x² · √x · ∫ · ∑ · ⅟</div></div></body></html>`);
    await sleep(200);
    await comp.screenshot({ path: path.join(OUT, 'promo-440x280.png') });
    console.log(`screenshots in ${path.relative(ROOT, OUT)}`);
  } finally {
    await ctx.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
