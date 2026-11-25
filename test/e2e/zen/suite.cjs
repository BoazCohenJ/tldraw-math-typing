// Headless Zen + the real extension on tldraw.com. Usage: node zen2.js <xpi> <geckodriver> <outdir>
const fs = require('fs');
const path = require('path');
const { Builder, Key } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');

const [xpi, gd, outDir] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.env.ONLY;

const INLINE = [
  ['sqrt', 'sqrt'], ['sqrt(2)', '√2'], ['4sqrt(10)', '4√10'], ['2*3', '2×3'], ['x^2', 'x²'], ['x^-12', 'x⁻¹²'], ['x_1', 'x₁'],
  ['2pi ', '2π'], ['90deg ', '90°'], ['x^(n+1)', 'xⁿ⁺¹'], ['e^{2x}', 'e²ˣ'], ['a_{n-1}', 'aₙ₋₁'],
  ['2**3', '2·3'], ['a===b', 'a≡b'], ['p<=>q', 'p⇔q'], ['a<->b', 'a↔b'], ['p=>q', 'p⇒q'],
  ['x~=3', 'x≈3'], ['+-', '±'], ['omega ', 'ω'], ['pi*2', 'π×2'], ['RR ', 'ℝ'],
  ['\\in ', '∈'], ['\\delta ', 'δ'], ['\\forall x', '∀ x'], ['\\sqrt(2)', '√2'],
];

(async () => {
  const opts = new firefox.Options()
    .setBinary(process.env.ZEN_PATH || 'C:\\Program Files\\Zen Browser\\zen.exe')
    .addArguments(...(process.env.HEADED ? [] : ['-headless']))
    .windowSize({ width: 1200, height: 800 });
  const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(opts)
    .setFirefoxService(new firefox.ServiceBuilder(gd)).build();
  const js = (code, ...args) => driver.executeScript(code, ...args);
  const keys = async (s) => {
    for (const ch of s) {
      await driver.actions({ async: true }).sendKeys(ch).perform();
      await sleep(45);
    }
  };
  const press = (k) => driver.actions({ async: true }).sendKeys(k).perform();
  const clearPage = () => js('editor.selectNone(); editor.setEditingShape(null); editor.deleteShapes(editor.getCurrentPageShapeIds ? [...editor.getCurrentPageShapeIds()] : editor.getCurrentPageShapes().map(s => s.id));');
  const newText = async () => {
    await press(Key.ESCAPE);
    await clearPage();
    await sleep(100);
    await press('t');
    await sleep(100);
    await driver.actions({ async: true }).move({ x: 200, y: 300 }).click().perform();
    await sleep(250);
  };
  const shapes = () => js(`
    const plain = (rt) => (rt?.content||[]).map(p => (p.content||[]).map(n => n.text||'').join('')).join('\\n');
    return editor.getCurrentPageShapes().map(s => {
      const b = editor.getShapePageBounds(s.id);
      return { type: s.type, text: s.props.richText ? plain(s.props.richText) : null, parent: s.parentId.startsWith('shape:') ? 'group' : 'page',
        x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) };
    });`);
  const editingText = () => js('const el=document.activeElement; return el ? (el.value ?? el.innerText) : "";');
  const results = [];
  const check = (name, ok, info) => results.push({ name, ok: !!ok, info });
  const shot = async (name) => {
    const png = await driver.takeScreenshot();
    fs.writeFileSync(path.join(outDir, name + '.png'), png, 'base64');
  };

  try {
    await driver.installAddon(xpi, true);
    await driver.get('https://www.tldraw.com/');
    for (let i = 0; i < 60; i++) {
      if (await js('return !!window.editor && !!document.querySelector(".tl-canvas")')) break;
      await sleep(1000);
    }
    await sleep(3000);
    const texts = async () => (await shapes()).filter((x) => x.type === 'text').map((x) => x.text);
    check('page script loaded', await js('return document.documentElement.dataset.mathtypingPage === "1"'));

    if (!only || only === 'inline') {
      for (const [input, want] of INLINE) {
        await newText();
        await keys(input);
        await sleep(200);
        const got = (await editingText()).replace(/\u00a0/g, ' ').trim();
        check(`inline ${input}`, got === want, got);
      }
    }

    if (!only || only === 'fraction') {
      await newText();
      await keys('y=3//4 ');
      await sleep(300);
      check('3//4 stays as typed while writing', (await editingText()).trim() === 'y=3//4', await editingText());
      await keys('+1 /draw ');
      await sleep(500);
      await keys('= 7//4');
      await sleep(300);
      const t = await texts();
      check('/draw then space: drawn, and typing carries on', t.includes('3') && t.includes('4') && t.some((v) => v.includes('= 7//4')), JSON.stringify(t));
      await shot('fraction');
    }
    if (!only || only === 'integral') {
      await newText();
      await keys('A=int_0^1 x^2 dx = 1//3 /draw');
      await sleep(200);
      check('int_0^1 stays ∫_0^1 while typing', (await editingText()).includes('∫_0^1'), await editingText());
      await press(Key.ENTER);
      await sleep(600);
      const s = await shapes();
      const t = s.filter((x) => x.type === 'text').map((x) => x.text);
      check('integral drawn with bounds', ['0', '1', '∫'].every((w) => t.includes(w)), JSON.stringify(t));
      const op = s.find((x) => x.text === '∫');
      const up = s.find((x) => x.text === '1' && op && x.y < op.y + 5);
      check('1 above ∫', !!up, JSON.stringify(s.filter((x) => x.type === 'text')));
      await shot('integral');
      await newText();
      await keys('sum_{i=1}^n i = n(n+1)//2 /draw');
      await press(Key.ENTER);
      await sleep(600);
      await shot('sum');
      await newText();
      await keys('d/dx e^{x//2} = 1//2 e^{x//2} /draw');
      await press(Key.ENTER);
      await sleep(600);
      check('d/dx drawn', (await texts()).includes('dx'), JSON.stringify(await texts()));
      await shot('deriv');
      await newText();
      await keys('solve x^2=4 by factoring');
      await press(Key.ENTER);
      await sleep(300);
      check('a note without / is left alone', !(await texts()).some((v) => v.includes('⇒')), JSON.stringify(await texts()));
    }
    if (!only || only === 'hints') {
      await newText();
      await keys('alp');
      await sleep(300);
      const visible = await js("const h = document.querySelector('[data-mathtyping-ui=hints]'); return !!h && h.shadowRoot.textContent.includes('alpha')");
      check('hint list shows alpha after typing alp', visible);
      await shot('hints');
      await press(Key.TAB);
      await sleep(250);
      const got = (await editingText()).trim();
      check('Tab takes the hint', got === 'α', got);
    }

    if (!only || only === 'fonts') {
      await newText();
      await keys('x∈ℝ x^{-n} ');
      await sleep(800);
      const f = await js(`
        const c = document.querySelector('.tl-container');
        return { err: document.documentElement.dataset.mathtypingFontError, n: document.fonts.size, cls: document.documentElement.classList.contains('mathtyping-fonts'),
          v: getComputedStyle(c).getPropertyValue('--tl-font-draw'),
          faces: [...document.fonts].filter(f => f.family.includes('mathtyping')).map(f => f.family + ':' + f.status) };`);
      check('fallback fonts loaded and in front of tldraw fonts',
        f.cls && f.v.includes('mathtyping_draw') && f.faces.length === 8 && f.faces.every((x) => x.endsWith('loaded')), JSON.stringify(f));
      await shot('fonts');
    }

    if (!only || only === 'block') {
      await newText();
      await keys('a=x//{x+3} + 4 /draw ');
      await sleep(500);
      const s = await shapes();
      const t = s.filter((x) => x.type === 'text').map((x) => x.text);
      check('y=x//{x+3} + 4 /draw: x over x+3, then + 4', t.some((v) => v.startsWith('a')) && t.includes('x') && t.includes('x+3') && t.some((v) => v.includes('+ 4')) &&
        s.some((x) => x.type === 'line'), JSON.stringify(t));
      await keys(' = 5');
      await sleep(300);
      await shot('block');
      await newText();
      await keys('{a+b}//{c//d} = 1//2 /draw');
      await press(Key.ENTER);
      await sleep(500);
      const t2 = await texts();
      check('nested block', ['a+b', 'c', 'd', ' = ', '1', '2'].every((w) => t2.some((v) => v.trim() === w.trim())), JSON.stringify(t2));
      await shot('block2');
    }
    if (!only || only === 'cmd') {
      for (const [line, want] of [['/calc 2^10/3', '2¹⁰/3 = 1024/3 ≈ 341.333'], ['/diff x^3*sin(x)', 'd/dx (x³·sin(x)) = 3x²·sin(x) + x³·cos(x)'],
        ['/integrate x^2 from 0 to 3', '∫₀³ x² dx = 9'], ['/solve x^2-5x+6=0', 'x² − 5x + 6 = 0  ⇒  x = 2 or x = 3']]) {
        await newText();
        await keys(line);
        await press(Key.ENTER);
        await sleep(300);
        const got = (await editingText()).replace(/ /g, ' ').trim();
        check(`command ${line}`, got === want, got);
      }
    }
    if (!only || only === 'plot') {
      await newText();
      await keys('/plot sin(x), cos(x)');
      await press(Key.ENTER);
      await sleep(800);
      const s = await shapes();
      check('plot draws curves under the caption', s.some((x) => x.text && x.text.includes('sin(x)')) && s.filter((x) => x.type === 'line').length > 6, s.length);
      await shot('plot');
      await newText();
      await keys('/plot x^2+y^2=9');
      await press(Key.ENTER);
      await sleep(800);
      await shot('plot2');
    }
    if (!only || only === 'draw') {
      await newText();
      await keys('/draw triangle 3 4 5');
      await press(Key.ENTER);
      await sleep(800);
      const t = await texts();
      check('draw triangle: labels 3 4 5 and angles, command text removed', ['3', '4', '5', '36.87°'].every((w) => t.includes(w)) && !t.some((v) => v.includes('draw')), JSON.stringify(t));
      await shot('draw');
      await newText();
      await keys('/draw circle 3');
      await press(Key.ENTER);
      await sleep(800);
      check('draw circle', (await shapes()).some((x) => x.type === 'geo'));
    }
    if (!only || only === 'braces') {
      for (const [input, want] of [['abs{x-3}', '|x-3|'], ['vec{v}', 'v⃗']]) {
        await newText();
        await keys(input);
        await sleep(200);
        const got = (await editingText()).trim();
        check(`brace ${input}`, got === want, got);
      }
      await newText();
      await keys('\\frac{a}{b} /draw');
      await press(Key.ENTER);
      await sleep(500);
      const t = await texts();
      check('\\frac{a}{b} /draw is stacked', t.includes('a') && t.includes('b'), JSON.stringify(t));
    }
    if (!only || only === 'root') {
      await newText();
      await keys('sqrt{x+1}');
      await sleep(500);
      const t = await texts();
      check('sqrt{x+1} is drawn as a root with a bar', t.includes('x+1') && (await shapes()).some((x) => x.type === 'line'), JSON.stringify(t));
    }
    if (only === 'diag') {
      await newText();
      await keys('x∈ℝ ');
      await sleep(300);
      console.log(await js(`
        const out = [];
        const el = document.activeElement;
        for (let n = el; n && n !== document.body; n = n.parentElement) {
          const cs = getComputedStyle(n);
          out.push(n.tagName + '.' + [...n.classList].join('.') + ' | ff=' + cs.fontFamily + ' | var=' + cs.getPropertyValue('--tl-font-draw') + ' | inline=' + (n.getAttribute('style')||'').slice(0,120));
        }
        return out.join(' ## ');`));
    }
    if (only === 'compare') {
      await newText();
      await keys('x∈ℝ, e^{-2x}, alpha+beta=>forall n ');
      await press(Key.ESCAPE);
      await sleep(800);
      await js("editor.selectNone(); editor.zoomToFit(); editor.zoomOut(); document.querySelectorAll('.tlui-layout__top, .tlui-layout__bottom').forEach(e => e.style.visibility='hidden')");
      await sleep(800);
      await shot('compare-on');
      await js("document.documentElement.classList.remove('mathtyping-fonts')");
      await sleep(800);
      await shot('compare-off');
    }
    for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : '  ' + r.info}`);
    console.log(`${results.filter((r) => r.ok).length}/${results.length} ok`);
  } finally {
    await driver.quit();
  }
})().catch((e) => { console.error(e); process.exit(1); });
