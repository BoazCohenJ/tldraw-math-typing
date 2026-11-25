// tldraw Math Typing: auto-replaces math shortcuts while you type in a tldraw text box.
// Alt+M turns it on/off. Settings live in extension storage and are edited from the toolbar popup.
(() => {
  'use strict';

  const MT = globalThis.MathTyping;
  const TOOLS = globalThis.MathTools;
  const FONTS = globalThis.MathTypingFonts;
  const ext = globalThis.browser ?? globalThis.chrome;
  const STORAGE_KEY = 'settings';
  let VERSION = '0';
  try { VERSION = ext.runtime.getManifest().version; } catch (_) { /* tests */ }

  // ---------------------------------------------------------------- one copy per tab
  // background.js also puts this script into tabs that were open before an install or update.
  // The newest copy wins: it tells older ones to stop and removes what they left on the page.
  if (globalThis.__mathTypingContent === VERSION) return;
  globalThis.__mathTypingContent = VERSION;
  const INSTANCE = `${VERSION}:${Math.random().toString(36).slice(2)}`;
  let dead = false;
  document.addEventListener('mathtyping:teardown', (e) => {
    if (e.detail === INSTANCE) return;
    dead = true;
    hideHints();
    hideRootBar();
  });
  document.dispatchEvent(new CustomEvent('mathtyping:teardown', { detail: INSTANCE }));
  document.querySelectorAll('[data-mathtyping-ui]').forEach((n) => n.remove());

  let settings = MT.normalizeSettings(null);
  let rules = MT.buildRules(settings);
  let hintList = MT.hintEntries(settings);

  const applySettings = (s) => {
    settings = MT.normalizeSettings(s);
    rules = MT.buildRules(settings);
    hintList = MT.hintEntries(settings);
    applyFonts();
    if (!settings.enabled || !settings.hints) hideHints();
    if (!settings.enabled) hideRootBar();
  };

  const loadSettings = async () => {
    try {
      const got = await ext.storage.local.get(STORAGE_KEY);
      applySettings(got[STORAGE_KEY]);
    } catch (_) { applyFonts(); }
  };
  const saveSettings = () => {
    try { ext.storage.local.set({ [STORAGE_KEY]: settings }); } catch (_) {}
  };
  try {
    ext.storage.onChanged.addListener((changes, area) => {
      if (!dead && area === 'local' && changes[STORAGE_KEY]) applySettings(changes[STORAGE_KEY].newValue);
    });
  } catch (_) {}
  // The popup asks whether this tab is running (for its status line).
  try {
    ext.runtime.onMessage.addListener((msg) => {
      if (dead || !msg || msg.type !== 'mathtyping:ping') return undefined;
      return Promise.resolve({ ok: true, version: VERSION, enabled: settings.enabled });
    });
  } catch (_) {}

  // ---------------------------------------------------------------- fonts
  // tldraw's fonts lack many math symbols, so the browser fills them from random system fonts.
  // These faces sit in front of each tldraw font and cover only the characters that font lacks,
  // plus every superscript/subscript so exponent runs stay one size (see fonts.js).
  let fontsLoaded = null;
  const loadFonts = () => {
    if (fontsLoaded || !FONTS) return fontsLoaded;
    // An earlier copy of the add-on may have added them already.
    if ([...document.fonts].some((f) => f.family.replace(/"/g, '').startsWith('mathtyping_'))) {
      fontsLoaded = Promise.resolve();
      return fontsLoaded;
    }
    fontsLoaded = (async () => {
      // The subsets are inlined in fonts.js: Firefox won't let a content script fetch its own files.
      const files = {};
      for (const [file, b64] of Object.entries(FONTS.files)) {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        files[file] = bytes.buffer;
      }
      for (const [tlFont, faces] of Object.entries(FONTS.faces)) {
        for (const f of faces) {
          // Firefox content scripts must hand page objects a copy made for the page.
          const data = typeof cloneInto === 'function' ? cloneInto(files[f.file], window) : files[f.file].slice(0);
          const face = new FontFace(`mathtyping_${tlFont}`, data, {
            unicodeRange: f.range, weight: '100 900', style: 'normal',
          });
          await face.load();
          document.fonts.add(face);
        }
      }
    })().catch((err) => {
      console.warn('[math typing] fonts', err);
      document.documentElement.dataset.mathtypingFontError = String(err);
    });
    return fontsLoaded;
  };
  const applyFonts = () => {
    const on = settings.enabled && settings.fonts && !!FONTS;
    if (on) loadFonts();
    document.documentElement.classList.toggle('mathtyping-fonts', on);
    document.documentElement.classList.toggle('mathtyping-system-cursor', settings.systemCursor);
  };

  // ---------------------------------------------------------------- cursor
  // After typing, the first mouse move swaps the canvas cursor for two frames, which makes
  // Firefox draw tldraw's crosshair again if Windows hid the pointer while you typed.
  let typedSinceMove = false;
  window.addEventListener('keydown', () => { typedSinceMove = true; }, true);
  window.addEventListener('pointermove', () => {
    if (dead || !typedSinceMove) return;
    typedSinceMove = false;
    if (!settings.cursorKick) return;
    const rootEl = document.documentElement;
    rootEl.classList.add('mathtyping-cursor-kick');
    requestAnimationFrame(() => requestAnimationFrame(() => rootEl.classList.remove('mathtyping-cursor-kick')));
  }, true);

  loadSettings();

  // ---------------------------------------------------------------- editing helpers
  let applying = false;
  const insertText = (text) => {
    applying = true;
    try {
      if (text) document.execCommand('insertText', false, text);
      else document.execCommand('delete', false);
    } finally { applying = false; }
  };

  const isEditable = (el) =>
    el instanceof HTMLElement && !!el.closest('.tl-container') &&
    (el.tagName === 'TEXTAREA' || el.isContentEditable);

  // The caret's text node and offset (contenteditable), or the textarea itself.
  const caretInfo = (el) => {
    if (el && el.tagName === 'TEXTAREA') {
      if (el.selectionStart !== el.selectionEnd) return null;
      return { before: el.value.slice(0, el.selectionStart), textarea: el, pos: el.selectionStart };
    }
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || !sel.anchorNode) return null;
    if (el && !el.contains(sel.anchorNode)) return null;
    let node = sel.anchorNode;
    let offset = sel.anchorOffset;
    if (node.nodeType !== Node.TEXT_NODE) {
      const prev = node.childNodes[offset - 1];
      if (!prev || prev.nodeType !== Node.TEXT_NODE) return { before: '', sel, node: null, offset: 0 };
      node = prev;
      offset = prev.data.length;
    }
    return { before: node.data.slice(0, offset), sel, node, offset };
  };
  // The line without the invisible zero-width space a drawn equation leaves at its start.
  const visible = (s) => s.replace(/​/g, '');

  // Select the last `length` characters before the caret and type `text` over them.
  const replaceBeforeCaret = (info, length, text) => {
    if (length === 0) {
      if (text) insertText(text);
      return;
    }
    if (info.textarea) {
      info.textarea.setSelectionRange(info.pos - length, info.pos);
    } else {
      if (!info.node) return;
      const range = document.createRange();
      range.setStart(info.node, info.offset - length);
      range.setEnd(info.node, info.offset);
      info.sel.removeAllRanges();
      info.sel.addRange(range);
    }
    insertText(text);
  };

  // ---------------------------------------------------------------- drawing (page.js)
  // A plain tldraw text shape can hand a fraction or bounds to page.js, which draws them
  // as real shapes. Anything else (a label inside a box, a note) gets the inline version.
  const canDraw = (el) =>
    document.documentElement.dataset.mathtypingPage === '1' &&
    el.closest('[data-shape-type]')?.dataset.shapeType === 'text';
  // d/dx, roots and {…} bounds are drawn as you type (their own switches); other fractions only
  // with "draw as you type". Never inside a /command line, which is read as text.
  const canStack = (el, rep) => {
    if (!canDraw(el)) return false;
    const info = caretInfo(el);
    if (info && /^\s*[/\\][a-z]/i.test(visible(info.before))) return false;
    if (settings.categories.stacked) return true;
    const st = rep && rep.stack;
    if (!st) return false;
    if (st.root) return true;
    if (st.deriv) return !!settings.categories.deriv;
    if (st.bounds) return !!settings.categories.bounds;
    return false;
  };

  let stackResult = null;
  let pendingNonce = null;
  document.addEventListener('mathtyping:stack-done', (e) => {
    try {
      const r = JSON.parse(e.detail);
      if (r.nonce !== pendingNonce) return;
      // Several page scripts can answer (an old version left in the tab): a success wins.
      if (!stackResult || !stackResult.ok) stackResult = r;
    } catch (_) {}
  });

  // Sends a drawing request to page.js. Returns its answer (the reply is synchronous).
  const askPage = (req) => {
    stackResult = null;
    pendingNonce = Math.random().toString(36).slice(2);
    document.dispatchEvent(new CustomEvent('mathtyping:stack', { detail: JSON.stringify({ ...req, nonce: pendingNonce }) }));
    const res = stackResult || { ok: false, reason: 'the page script did not answer; reload the tab' };
    if (!res.ok) {
      const why = stackResult ? res.reason || 'an older version is still running in this tab; reload the tab' : res.reason;
      toast(`Math typing: couldn't draw it: ${why}`, 6000);
    }
    return res;
  };

  // While a drawing is handed over (the text box closes, the next one opens), keys you type are
  // held here and typed into the new box once it has the caret, in order.
  let busy = false;
  let held = '';
  let busyTimer = 0;
  const startBusy = () => {
    busy = true;
    held = '';
    clearTimeout(busyTimer);
    busyTimer = setTimeout(endBusy, 1500); // never hold keys for longer than this
  };
  const endBusy = () => {
    if (!busy) return;
    busy = false;
    clearTimeout(busyTimer);
    const keys = held;
    held = '';
    const el = document.activeElement;
    if (!keys || !isEditable(el)) return;
    // Typed through the editor, so shortcuts still apply to them.
    for (const ch of keys) document.execCommand('insertText', false, ch);
  };
  document.addEventListener('mathtyping:ready', () => setTimeout(endBusy, 0));

  const stack = (el, info, rep, finish) => {
    const pre = rep.stack.pre || '';
    const removed = info.before.slice(info.before.length - rep.length + pre.length);
    const restore = rep.text.slice(pre.length) || removed;
    replaceBeforeCaret(info, rep.length - pre.length, '');
    last = null;
    hideHints();
    hideRootBar();
    startBusy();
    // Let tldraw take in the deletion before page.js reads the caret position.
    requestAnimationFrame(() => {
      const res = askPage({ ...rep.stack, finish: !!finish, restore });
      if (res.ok) return;
      // Could not draw it: put the text back (inline form when there is one), unless page.js
      // already recreated it.
      if (!res.restored) {
        const now = caretInfo(el);
        if (now) replaceBeforeCaret(now, 0, restore);
      }
      endBusy();
    });
  };

  // Replaces the line with its caption and draws the figure under it; puts the line back on failure.
  const drawFigure = (el, info, res, caption) => {
    const original = info.before;
    replaceBeforeCaret(info, info.before.length, caption);
    startBusy();
    requestAnimationFrame(() => {
      const r = askPage({ type: 'figure', figure: res.figure });
      if (!r.ok) {
        const now = caretInfo(el);
        if (now && now.before.endsWith(caption)) replaceBeforeCaret(now, caption.length, original);
      }
      endBusy();
    });
  };

  // ---------------------------------------------------------------- converting
  // The most recent replacement, so Backspace right after it can undo it.
  let last = null;

  // Applies replacements before the caret, repeating so chains work (pi* -> π×).
  // `first` finds the first replacement; later ones use the normal rules.
  const inBlock = (before) => settings.categories.blocks && MT.openBlockAt(before) >= 0;

  const convert = (el, first, { finish = false, allowStack = true } = {}) => {
    let start = null;
    for (let i = 0; i < 4; i++) {
      const info = caretInfo(el);
      if (!info) break;
      // Shortcuts only look at the end of the line: keep the work per key small on long lines.
      const rep = (i === 0 ? first : MT.findReplacement)(rules, info.before.slice(-300));
      if (!rep) break;
      // Inside an open //{ … } block, fractions wait for the block to close.
      if (inBlock(info.before.slice(0, -1)) &&
          (rep.stack || info.before.slice(info.before.length - rep.length).includes('//'))) break;
      if (rep.stack && allowStack && canStack(el, rep)) {
        stack(el, info, rep, finish);
        return;
      }
      if (rep.text === info.before.slice(info.before.length - rep.length)) break; // nothing to do
      if (start === null) start = info.before;
      replaceBeforeCaret(info, rep.length, rep.text);
    }
    if (start === null) return;
    // Remember what changed (and exactly where), for Backspace undo.
    const info = caretInfo(el);
    if (!info) return;
    const end = info.before;
    let p = 0;
    while (p < start.length && p < end.length && start[p] === end[p]) p++;
    last = { el, original: start.slice(p), text: end.slice(p), node: info.node, offset: info.offset };
  };

  // ---------------------------------------------------------------- equation blocks and commands
  // Typing the } that closes //{ … } draws the whole equation as shapes.
  const drawBlock = (el) => {
    if (!settings.categories.blocks || !canDraw(el)) return false;
    const info = caretInfo(el);
    const blk = info && MT.closedBlock(info.before);
    if (!blk || !blk.src.trim()) return false;
    const length = info.before.length - blk.start;
    stack(el, info, { length, text: info.before.slice(blk.start), stack: { type: 'block', tree: MT.parseBlock(blk.src), pre: '' } }, false);
    return true;
  };

  // Layout syntax (// fractions, {…} groups, \frac, raised groups): /draw lays the line out.
  const LAYOUT = /\/\/|[{}]|\\frac/;

  // "… /draw" then space or Enter: the line is drawn as an equation (or, for a plain equation
  // in x and y such as y = 3x² + 2x, as its graph).
  const drawLine = (el, finish) => {
    if (!settings.categories.draw) return false;
    const info = caretInfo(el);
    const m = info && visible(info.before).match(/^([\s\S]*?\S)\s+\/draw\s?$/);
    if (!m) return false;
    if (!canDraw(el)) {
      toast('Math typing: /draw needs a plain text box (T tool)', 5000);
      return true;
    }
    let plot = null;
    if (!LAYOUT.test(m[1])) {
      try { plot = settings.categories.plot && TOOLS ? TOOLS.asPlot(m[1]) : null; } catch (_) { plot = null; }
    }
    if (plot) {
      last = null;
      hideHints();
      drawFigure(el, info, plot, plot.caption);
      return true;
    }
    stack(el, info, {
      length: info.before.length, text: info.before,
      stack: { type: 'block', tree: MT.parseBlock(m[1].trimEnd()), pre: '' },
    }, finish);
    return true;
  };

  // Enter at the end of a line like "/calc 2^10" or "/plot sin(x)" runs it.
  const runCommandLine = (el, info) => {
    if (!TOOLS) return false;
    const on = settings.categories;
    let res;
    try {
      res = TOOLS.runCommand(info.before, { cas: on.cas, plot: on.plot, shapes: on.shapes, draw: on.draw });
    } catch (err) {
      toast(`Math typing: ${err.message}`, 5000);
      return true; // keep the line so it can be fixed
    }
    if (!res) return false;
    last = null;
    hideHints();
    if (res.equation) {
      // /draw{ … }: lay the equation out like "… /draw"
      if (!canDraw(el)) {
        toast('Math typing: /draw needs a plain text box (T tool)', 5000);
        return true;
      }
      stack(el, info, {
        length: info.before.length, text: info.before,
        stack: { type: 'block', tree: MT.parseBlock(res.equation), pre: '' },
      }, true);
      return true;
    }
    if (res.text) {
      replaceBeforeCaret(info, info.before.length, res.text);
      return true;
    }
    if (!canDraw(el)) {
      toast('Math typing: graphs and shapes need a plain text box (T tool)', 5000);
      return true;
    }
    const isShape = /^\s*[/\\]draw\s+(?:circle|ellipse|oval|square|rect|right|equilateral|triangle|regular|polygon|pentagon|hexagon|heptagon|octagon|nonagon|decagon|angle)/i
      .test(visible(info.before));
    drawFigure(el, info, res, isShape ? '' : res.caption);
    return true;
  };

  // ---------------------------------------------------------------- live root bar
  // While typing inside √{ … }, a bar is drawn over what you have typed so far.
  let rootBar = null;
  const hideRootBar = () => { if (rootBar) rootBar.style.display = 'none'; };
  const openRootAt = (before) => {
    let depth = 0;
    for (let i = before.length - 1; i >= 0; i--) {
      const c = before[i];
      if (c === '}') depth++;
      else if (c === '{') {
        if (depth === 0) return i > 0 && (before[i - 1] === '√' || before[i - 1] === '∛') ? i : -1;
        depth--;
      }
    }
    return -1;
  };
  const updateRootBar = (el) => {
    const info = settings.enabled && el ? caretInfo(el) : null;
    // Nothing to do (and no layout work) unless a √{ is open.
    if (!info || !info.node || !/[√∛]\{/.test(info.before)) {
      if (rootBar && rootBar.style.display !== 'none') hideRootBar();
      return;
    }
    const at = openRootAt(info.before);
    if (at < 0) return hideRootBar();
    const range = document.createRange();
    range.setStart(info.node, at + 1);
    range.setEnd(info.node, info.offset);
    let rect = range.getBoundingClientRect();
    if (!rect.width) {
      const r2 = document.createRange();
      r2.setStart(info.node, at);
      r2.setEnd(info.node, at + 1);
      const b = r2.getBoundingClientRect();
      rect = { left: b.right, top: b.top, width: b.height * 0.5, height: b.height };
    }
    if (!rootBar) {
      rootBar = document.createElement('div');
      rootBar.dataset.mathtypingUi = 'rootbar';
      Object.assign(rootBar.style, { position: 'fixed', zIndex: '2147483646', pointerEvents: 'none', height: '0' });
      document.body.appendChild(rootBar);
    }
    const color = getComputedStyle(el).color || '#1d1d1d';
    const thick = Math.max(1.5, rect.height * 0.07);
    Object.assign(rootBar.style, {
      display: 'block', left: `${rect.left}px`, top: `${rect.top + rect.height * 0.08}px`,
      width: `${rect.width + 2}px`, borderTop: `${thick}px solid ${color}`,
    });
  };
  // Keep the bar on the text when the caret moves or the board pans/zooms.
  let barFrame = 0;
  const followBar = () => {
    if (dead || barFrame || !rootBar || rootBar.style.display === 'none') return;
    barFrame = requestAnimationFrame(() => {
      barFrame = 0;
      const el = document.activeElement;
      if (isEditable(el)) updateRootBar(el); else hideRootBar();
    });
  };
  document.addEventListener('selectionchange', followBar);
  window.addEventListener('wheel', followBar, { passive: true, capture: true });

  // ---------------------------------------------------------------- hints
  // A small card under the caret: what the maths word you are typing can turn into.
  // Tab takes the highlighted suggestion. ↑/↓ pick only for \commands and /commands, so arrows
  // keep moving the caret in ordinary text. Esc closes it and still does what Esc does.
  let hintBox = null;
  let hintItems = [];
  let hintIndex = 0;
  let hintFor = null; // { el, token, rect }

  const HINT_CSS = `
    :host { all: initial; }
    .card { position: fixed; z-index: 2147483647; min-width: 200px; max-width: 340px; padding: 6px;
      border-radius: 12px; font: 13px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
      background: rgba(255,255,255,0.98); color: #16181d; border: 1px solid #e3e5ea;
      box-shadow: 0 10px 30px rgba(15,20,40,0.16), 0 2px 6px rgba(15,20,40,0.08); }
    .row { display: grid; grid-template-columns: 34px 1fr auto; align-items: center; gap: 8px;
      padding: 4px 8px 4px 4px; border-radius: 8px; cursor: pointer; }
    .row.on { background: #e8effd; }
    .sym { width: 34px; height: 30px; display: grid; place-items: center; border-radius: 7px;
      background: #f1f3f7; font-size: 17px; overflow: hidden; white-space: nowrap; }
    .row.on .sym { background: #fff; }
    .key { font: 12px ui-monospace, Consolas, monospace; color: #2f5fcc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .note { color: #6a6f7a; font-size: 11px; white-space: nowrap; }
    .foot { display: flex; gap: 10px; padding: 6px 8px 2px; color: #6a6f7a; font-size: 11px; border-top: 1px solid #eceef2; margin-top: 4px; }
    kbd { font: 10.5px ui-monospace, Consolas, monospace; background: #f1f3f7; border: 1px solid #dfe2e8;
      border-bottom-width: 2px; border-radius: 4px; padding: 0 4px; color: #16181d; }
    @media (prefers-color-scheme: dark) {
      .card { background: rgba(32,34,40,0.98); color: #eceef2; border-color: #3a3d45; box-shadow: 0 10px 30px rgba(0,0,0,0.45); }
      .row.on { background: #2c3b5c; }
      .sym, kbd { background: #2b2e35; color: #eceef2; border-color: #3a3d45; }
      .row.on .sym { background: #1f2229; }
      .key { color: #9fbcff; }
      .note, .foot { color: #9da1ab; }
      .foot { border-top-color: #33363d; }
    }`;
  let hintRoot = null;
  const ensureHintBox = () => {
    if (hintBox) return hintBox;
    // A shadow root keeps tldraw's styles out of the card and the card's styles out of tldraw.
    const host = document.createElement('div');
    host.dataset.mathtypingUi = 'hints';
    document.body.appendChild(host);
    hintRoot = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = HINT_CSS;
    hintBox = document.createElement('div');
    hintBox.className = 'card';
    hintBox.setAttribute('role', 'listbox');
    hintBox.setAttribute('aria-label', 'Math typing suggestions');
    hintBox.style.display = 'none';
    hintRoot.append(style, hintBox);
    hintBox.addEventListener('mousedown', (e) => {
      e.preventDefault(); // keep the caret in the text box
      const row = e.target.closest('[data-i]');
      if (row) acceptHint(Number(row.dataset.i));
    });
    return hintBox;
  };

  const hideHints = () => {
    if (hintBox) hintBox.style.display = 'none';
    hintItems = [];
    hintFor = null;
  };

  const renderHints = () => {
    const box = ensureHintBox();
    const rect = hintFor.rect;
    box.replaceChildren();
    hintItems.forEach((h, i) => {
      const row = document.createElement('div');
      row.dataset.i = String(i);
      row.className = 'row' + (i === hintIndex ? ' on' : '');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(i === hintIndex));
      const sym = document.createElement('span');
      sym.className = 'sym';
      sym.textContent = h.out;
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = h.key;
      const note = document.createElement('span');
      note.className = 'note';
      note.textContent = h.note || '';
      row.append(sym, key, note);
      box.append(row);
    });
    const foot = document.createElement('div');
    foot.className = 'foot';
    const tip = (k, t) => {
      const span = document.createElement('span');
      const kb = document.createElement('kbd');
      kb.textContent = k;
      span.append(kb, ` ${t}`);
      return span;
    };
    foot.append(tip('Tab', 'use'));
    if (hintFor.arrows && hintItems.length > 1) foot.append(tip('↑↓', 'pick'));
    foot.append(tip('Esc', 'close'));
    box.append(foot);
    box.style.display = 'block';
    const top = rect.bottom + 8;
    const height = box.offsetHeight;
    box.style.top = `${top + height > window.innerHeight ? Math.max(4, rect.top - height - 8) : top}px`;
    box.style.left = `${Math.max(4, Math.min(rect.left - 6, window.innerWidth - box.offsetWidth - 8))}px`;
  };

  const updateHints = (el) => {
    if (!settings.enabled || !settings.hints) return hideHints();
    const info = caretInfo(el);
    const line = info ? visible(info.before) : '';
    const m = line.match(/(?:^|[^A-Za-z\\/])([\\/]?[A-Za-z]{2,})$/);
    if (!m) return hideHints();
    const token = m[1];
    const prefix = /^[\\/]/.test(token) ? token[0] : '';
    // Plain words need 3 letters (so "in", "to", "be" don't pop the list up), and inside a
    // /command line only the command names are suggested.
    if (!prefix && (token.length < 3 || /^\s*[/\\][a-z]/i.test(line))) return hideHints();
    const plainTok = token.slice(prefix.length);
    if (!plainTok) return hideHints();
    const lower = plainTok.toLowerCase();
    const scored = [];
    for (const h of hintList) {
      const hp = /^[\\/]/.test(h.key) ? h.key[0] : '';
      if (hp !== prefix) continue; // LaTeX names only after \, commands only after /
      const key = h.key.slice(hp.length);
      if (!key.toLowerCase().startsWith(lower)) continue;
      if (!prefix && key === plainTok && key.length === h.key.length && !/[{(_]/.test(key)) {
        // the word is already complete: the next space converts it, no list needed
        continue;
      }
      let score = key.length;
      if (key.startsWith(plainTok)) score -= 100; // same case first
      scored.push([score, h]);
    }
    if (!scored.length) return hideHints();
    scored.sort((a, b) => a[0] - b[0]);
    const seen = new Set();
    hintItems = [];
    for (const [, h] of scored) {
      const sig = h.key + h.out;
      if (seen.has(sig)) continue;
      seen.add(sig);
      hintItems.push(h);
      if (hintItems.length === 6) break;
    }
    hintIndex = 0;
    let rect;
    try {
      const r = info.sel.getRangeAt(0).cloneRange();
      if (info.node && info.offset > 0) r.setStart(info.node, info.offset - 1);
      rect = r.getBoundingClientRect();
    } catch (_) {}
    if (!rect || (!rect.width && !rect.height)) rect = el.getBoundingClientRect();
    hintFor = { el, token, rect: { top: rect.top, bottom: rect.bottom, left: rect.left }, arrows: !!prefix };
    renderHints();
  };

  // What accepting a hint types: the symbol, or the start of a template (∫_, abs{, \frac{ …).
  const hintInsert = (h) => {
    if (h.key === 'int_a^b') return '∫_';
    if (h.key.startsWith('sum_')) return '∑_';
    if (h.key.startsWith('prod_')) return '∏_';
    if (h.key.startsWith('lim_')) return 'lim_';
    if (/^(sqrt|cbrt)[{(]…[})]$/.test(h.key)) return (h.key.startsWith('sqrt') ? '√' : '∛') + h.key[4];
    const brace = h.key.match(/^(\\?[a-z]+)\{/i);
    if (brace && h.key !== '//{…}') return `${brace[1]}{`; // abs{, bar{, \frac{ … then type inside
    if (h.note === 'stacked') return h.key;
    if (h.note === 'then Enter') return h.key + ' ';
    if (h.key === '/draw') return '/draw';
    return h.out;
  };

  const acceptHint = (i) => {
    const h = hintItems[i];
    const target = hintFor;
    hideHints();
    if (!h || !target) return;
    const info = caretInfo(target.el);
    if (!info || !info.before.endsWith(target.token)) return;
    replaceBeforeCaret(info, target.token.length, hintInsert(h));
    last = null;
    updateRootBar(target.el);
  };

  // ---------------------------------------------------------------- events
  document.addEventListener('input', (e) => {
    if (dead || applying) return;
    last = null;
    const el = e.target;
    if (!settings.enabled || !isEditable(el)) return hideHints();
    if (e.inputType !== 'insertText') {
      setTimeout(() => { updateHints(el); updateRootBar(el); }, 0);
      return;
    }
    // Let the editor finish handling the keystroke first.
    setTimeout(() => {
      if (busy) return;
      convert(el, MT.findReplacement);
      if (busy) return;
      updateRootBar(el);
      if (e.data === '}' && drawBlock(el)) return;
      if (e.data === ' ' && drawLine(el, false)) return;
      updateHints(el);
    }, 0);
  }, true);

  window.addEventListener('keydown', (e) => {
    if (dead) return;
    const el = document.activeElement;

    // While a drawing is being handed over, hold typed keys for the next text box.
    if (busy) {
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        held += e.key;
        return;
      }
      if (e.key === 'Backspace' && held) {
        e.preventDefault();
        e.stopPropagation();
        held = held.slice(0, -1);
        return;
      }
    }

    // The suggestion card, while it is open
    if (hintItems.length && hintFor && el === hintFor.el && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        acceptHint(hintIndex);
        return;
      }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && hintFor.arrows) {
        e.preventDefault();
        e.stopPropagation();
        const n = hintItems.length;
        hintIndex = (hintIndex + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
        renderHints();
        return;
      }
      if (e.key === 'Escape') hideHints(); // and let Esc through
    }

    // Backspace right after a replacement restores what you typed (√ -> sqrt), only at the
    // same spot.
    if (e.key === 'Backspace' && last && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const info = caretInfo(last.el);
      const undo = last;
      last = null;
      if (!settings.enabled || !info || info.node !== undo.node || info.offset !== undo.offset ||
          !info.before.endsWith(undo.text)) return;
      e.preventDefault();
      e.stopPropagation();
      replaceBeforeCaret(info, undo.text.length, undo.original);
      return;
    }

    // Enter / Escape / Tab: convert a word that has no space after it yet (2pi -> 2π).
    // Only Enter runs commands and draws; Esc and Tab never draw.
    if ((e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab') && settings.enabled &&
        !e.isComposing && isEditable(el)) {
      last = null;
      hideHints();
      const info = caretInfo(el);
      if (e.key === 'Enter' && !e.shiftKey && info) {
        if (/\s\/draw\s?$/.test(visible(info.before)) && drawLine(el, true)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (runCommandLine(el, info)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const rep = MT.findPendingWord(rules, info.before.slice(-300));
        if (rep && rep.stack && canStack(el, rep)) {
          // A drawn fraction/bound at the end of the text: draw it and stop editing.
          e.preventDefault();
          e.stopPropagation();
          stack(el, info, rep, true);
          return;
        }
      }
      convert(el, MT.findPendingWord, { allowStack: false });
      return;
    }

    // Alt+M toggles the auto-replace on and off.
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyM') {
      e.preventDefault();
      e.stopPropagation();
      settings.enabled = !settings.enabled;
      saveSettings();
      applySettings(settings);
      toast(settings.enabled ? 'Math typing: ON  (sqrt{ → √)' : 'Math typing: OFF');
    }
  }, true);

  // Clicking away from the text box: convert a trailing word too (inline only), and remove
  // text boxes that were left empty after a drawing.
  document.addEventListener('focusout', (e) => {
    if (dead) return;
    hideHints();
    hideRootBar();
    if (!isEditable(e.target)) return;
    setTimeout(() => document.dispatchEvent(new CustomEvent('mathtyping:cleanup')), 50);
    if (!settings.enabled || applying || busy) return;
    last = null;
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !e.target.contains(sel.anchorNode)) return;
    convert(e.target, MT.findPendingWord, { allowStack: false });
  }, true);

  document.addEventListener('mousedown', (e) => {
    if (dead) return;
    last = null;
    if (hintBox && !e.composedPath().includes(hintBox)) hideHints();
  }, true);

  let toastEl = null;
  let toastTimer = 0;
  const toast = (msg, ms = 1600) => {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.dataset.mathtypingUi = 'toast';
      toastEl.setAttribute('role', 'status');
      Object.assign(toastEl.style, {
        position: 'fixed', left: '50%', bottom: '80px', transform: 'translateX(-50%)', maxWidth: '80vw',
        background: 'rgba(28,30,36,0.95)', color: '#fff', padding: '9px 16px', borderRadius: '10px',
        font: '14px system-ui, sans-serif', zIndex: '2147483647', pointerEvents: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, ms);
  };
})();
