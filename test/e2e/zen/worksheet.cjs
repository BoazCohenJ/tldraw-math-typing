// Part of the Zen end-to-end suite (test/e2e/zen.cjs): type whole exam questions like a
// student would, Enter between lines, and check the result. Saves one screenshot per question
// (also used for the store listings).
const fs = require('fs');
const path = require('path');
const { Builder, Key } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const [xpi, gd, out] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUESTIONS = [
  { name: 'q1-calculus', at: [80, 90], lines: [
    'Q1. f(x) = x^2 e^{2x}',
    "a) f'(x) = ?",
    '/diff x^2 e^(2x)',
    'b) area under f from 0 to 1:',
    'A = int_{0}^{1} x^2 e^{2x} dx ',
    '/integrate x^2 e^(2x) from 0 to 1',
  ] },
  { name: 'q2-quadratic', at: [80, 90], lines: [
    'Q2. solve x^2 - 5x + 6 = 0',
    'x = {-b +- sqrt{b^2 - 4ac}}//{2a} /draw',
    '/solve x^2 - 5x + 6 = 0',
    'so x_1 = 2, x_2 = 3',
  ] },
  { name: 'q3-circle', at: [80, 90], lines: [
    'Q3. circle: x^2 + y^2 - 6x = 7, line y = x - 3',
    'center (3, 0), r = 4 since (x-3)^2 + y^2 = 16',
    '/plot x^2 + y^2 - 6x = 7, y = x - 3',
  ] },
  { name: 'q4-triangle', at: [80, 90], lines: [
    'Q4. triangle ABC with AB = 3, BC = 4, AC = 5',
    '/draw triangle 3 4 5',
    'angle B = 90deg because 3^2 + 4^2 = 5^2',
  ] },
  { name: 'q5-limits', at: [80, 90], lines: [
    'Q5. lim_{x->0} sin(x)//x = 1',
    'd/dx sin(x) = cos(x) for all x in RR',
    '//{1//{1 + 1//x}} = x//{x+1}',
  ] },
];

(async () => {
  const opts = new firefox.Options().setBinary(process.env.ZEN_PATH || 'C:\\Program Files\\Zen Browser\\zen.exe')
    .addArguments('-headless').windowSize({ width: 1280, height: 860 }).setPreference('ui.systemUsesDarkTheme', 0);
  const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(opts).setFirefoxService(new firefox.ServiceBuilder(gd)).build();
  const js = (c, ...a) => driver.executeScript(c, ...a);
  const press = (k) => driver.actions({ async: true }).sendKeys(k).perform();
  const type = async (s) => { for (const ch of s) { await driver.actions({ async: true }).sendKeys(ch).perform(); await sleep(35); } };
  const E = 'window.__testEditor';
  const shot = async (n) => fs.writeFileSync(path.join(out, `${n}.png`), await driver.takeScreenshot(), 'base64');
  const log = [];
  const finals = {};
  try {
    await driver.installAddon(xpi, true);
    await driver.get('https://www.tldraw.com/');
    for (let i = 0; i < 60; i++) { if (await js('return !!window.editor')) break; await sleep(1000); }
    await sleep(2500);
    await js("window.__testEditor = window.editor; Object.defineProperty(window, 'editor', { get() { return undefined; }, set() {}, configurable: true });");
    for (const q of QUESTIONS) {
      await press(Key.ESCAPE);
      await js(`const e = ${E}; e.selectNone(); e.setEditingShape(null); e.deleteShapes([...e.getCurrentPageShapeIds()]); e.resetZoom && e.resetZoom();`);
      await press('t');
      await sleep(150);
      await driver.actions({ async: true }).move({ x: q.at[0], y: q.at[1] }).click().perform();
      await sleep(300);
      for (let i = 0; i < q.lines.length; i++) {
        const line = q.lines[i];
        // after a drawing the caret may be in a new box or none; click back into the last text box
        const editing = await js(`return !!${E}.getEditingShapeId()`);
        if (!editing) {
          log.push(`${q.name} line ${i + 1}: NOT EDITING before typing "${line}" — had to click to continue`);
          const pos = await js(`const e = ${E}; const b = e.getCurrentPageBounds(); if (!b) return [80, 90]; const p = e.pageToScreen({ x: b.minX, y: b.maxY + 24 }); const r = document.querySelector('.tl-container').getBoundingClientRect(); return [Math.round(p.x - r.left), Math.round(p.y - r.top)]`);
          await press('t');
          await driver.actions({ async: true }).move({ x: Math.max(10, Math.min(1000, pos[0])), y: Math.max(10, Math.min(780, pos[1])) }).click().perform();
          await sleep(300);
        }
        await type(line);
        await sleep(300);
        const isCmd = line.startsWith('/') || / \/draw$/.test(line);
        if (i < q.lines.length - 1 || isCmd) await press(Key.ENTER);
        await sleep(isCmd ? 1800 : 300);
        const state = await js(`const p = (rt) => (rt?.content||[]).map(q => (q.content||[]).map(n => n.text||'').join('')).join(' ⏎ ').replace(/\\u200B/g, '·'); return ${E}.getCurrentPageShapes().filter(s => s.type === 'text').map(s => p(s.props.richText))`);
        const toast = await js("const t = document.querySelector('[data-mathtyping-ui=toast]'); return t && t.style.display !== 'none' ? t.textContent : ''");
        log.push(`${q.name} after "${line}": texts=${JSON.stringify(state)}${toast ? ` TOAST="${toast}"` : ''}`);
      }
      finals[q.name] = (await js(`const p = (rt) => (rt?.content||[]).map(q => (q.content||[]).map(n => n.text||'').join('')).join(' ⏎ ').replace(/\u200B/g, ''); return ${E}.getCurrentPageShapes().filter(s => s.type === 'text').map(s => p(s.props.richText))`)).join(' | ');
      await press(Key.ESCAPE);
      await sleep(500);
      await js(`${E}.selectNone(); ${E}.zoomToFit && ${E}.zoomToFit({ animation: { duration: 0 } })`);
      await sleep(400);
      await shot(q.name);
    }
    fs.writeFileSync(path.join(out, 'worksheet-log.txt'), log.join('\n'));
    const results = [];
    const check = (name, ok, info) => results.push({ name, ok: !!ok, info });
    check('writing never needs a click to continue', !log.some((l) => l.includes('NOT EDITING')), log.filter((l) => l.includes('NOT EDITING')).join('; '));
    check('no error messages', !log.some((l) => l.includes('TOAST')), log.filter((l) => l.includes('TOAST')).join('; '));
    check('Q1: derivative answered on its own line', /d\/dx \(x²e²ˣ\) = 2xe²ˣ \+ 2x²e²ˣ ⏎ b\)/.test(finals['q1-calculus']), finals['q1-calculus']);
    check('Q1: integral answered', finals['q1-calculus'].includes('= 1.59726'), finals['q1-calculus']);
    check('Q2: the quadratic formula is laid out in one piece', finals['q2-quadratic'].includes('b² - 4ac') && !finals['q2-quadratic'].includes('}'), finals['q2-quadratic']);
    check('Q2: answer, then the next line', /x = 2 or x = 3 ⏎ so x₁ = 2, x₂ = 3/.test(finals['q2-quadratic']), finals['q2-quadratic']);
    check('Q4: triangle sides as named in the question', finals['q4-triangle'].includes('angle B = 90° because 3² + 4² = 5²'), finals['q4-triangle']);
    check('Q5: sin(x)//x is one fraction and RR became ℝ', finals['q5-limits'].includes('sin(x)') && finals['q5-limits'].includes('ℝ') && !finals['q5-limits'].includes('//'), finals['q5-limits']);
    for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : '  ' + r.info}`);
    console.log(`${results.filter((r) => r.ok).length}/${results.length} ok`);
  } catch (e) { console.log(log.join('\n')); console.error(e); process.exitCode = 1; } finally { try { await driver.quit(); } catch (_) { /* already gone */ } }
})().catch((e) => { console.error(e); process.exit(1); });
