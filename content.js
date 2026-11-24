// tldraw Math Typing: auto-replaces math shortcuts while you type in a tldraw text box.
// Alt+M turns it on/off.
(() => {
  'use strict';

  const STORAGE_KEY = 'tldrawMathTyping:enabled';
  let enabled = true;
  try { enabled = localStorage.getItem(STORAGE_KEY) !== '0'; } catch (_) {}

  const SUP = {
    0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ',
    l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ',
    x: 'ˣ', y: 'ʸ', z: 'ᶻ',
  };
  const SUB = {
    0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ',
    r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
  };
  const VULGAR = {
    '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾', '1/5': '⅕', '2/5': '⅖',
    '3/5': '⅗', '4/5': '⅘', '1/6': '⅙', '5/6': '⅚', '1/7': '⅐', '1/8': '⅛', '3/8': '⅜',
    '5/8': '⅝', '7/8': '⅞', '1/9': '⅑', '1/10': '⅒',
  };
  const WORDS = {
    pi: 'π', inf: '∞', alpha: 'α', beta: 'β', theta: 'θ', delta: 'Δ', lambda: 'λ',
    sigma: 'Σ', deg: '°', div: '÷',
  };

  const mapAll = (s, table) => {
    let out = '';
    for (const ch of s) {
      const v = table[ch];
      if (v === undefined) return null;
      out += v;
    }
    return out;
  };

  // Each rule: [regex tested on the text right before the caret, fn(match) -> replacement for match[0] or null].
  const RULES = [
    [/sqrt$/i, () => '√'],
    [/cbrt$/i, () => '∛'],
    // √(10) -> √10 when the inside is a single number or letter (keeps brackets for √(81+9))
    [/([√∛])\(([0-9a-zA-Z.]+)\)$/, (m) => m[1] + m[2]],
    [/\*$/, () => '×'],
    [/\+-$/, () => '±'],
    [/>=$/, () => '≥'],
    [/<=$/, () => '≤'],
    [/!=$/, () => '≠'],
    [/->$/, () => '→'],
    // x^2 -> x², x_1 -> x₁
    [/\^(.)$/, (m) => SUP[m[1]] ?? null],
    [/_(.)$/, (m) => SUB[m[1]] ?? null],
    // keep typing digits after an exponent/index: x²3 -> x²³, x⁻1 -> x⁻¹
    [/([⁰¹²³⁴⁵⁶⁷⁸⁹⁻])([0-9])$/, (m) => m[1] + SUP[m[2]]],
    [/([₀₁₂₃₄₅₆₇₈₉₋])([0-9])$/, (m) => m[1] + SUB[m[2]]],
    // fraction: 3//4 followed by a space or symbol -> ¾ ; 48//10 -> ⁴⁸⁄₁₀
    [/(^|[^0-9a-z])([0-9a-z]+)\/\/([0-9a-z]+)([^0-9a-z/])$/, (m) => {
      const key = `${m[2]}/${m[3]}`;
      if (VULGAR[key]) return m[1] + VULGAR[key] + m[4];
      const num = mapAll(m[2], SUP);
      const den = mapAll(m[3], SUB);
      return num && den ? m[1] + num + '⁄' + den + m[4] : null;
    }],
    // whole words, converted when you type the next space or symbol: 2pi -> 2π, 90deg -> 90°
    [/(^|[^a-zA-Z])(pi|inf|alpha|beta|theta|delta|lambda|sigma|deg|div)([^a-zA-Z])$/,
      (m) => m[1] + WORDS[m[2]] + m[3]],
  ];

  const findReplacement = (before) => {
    for (const [re, fn] of RULES) {
      const m = before.match(re);
      if (!m) continue;
      const rep = fn(m);
      if (rep != null && rep !== m[0]) return { length: m[0].length, text: rep };
    }
    return null;
  };

  let applying = false;
  const insertText = (text) => {
    applying = true;
    try { document.execCommand('insertText', false, text); } finally { applying = false; }
  };

  // The caret's text node and offset (contenteditable), or the textarea itself.
  const caretInfo = (el) => {
    if (el && el.tagName === 'TEXTAREA') {
      if (el.selectionStart !== el.selectionEnd) return null;
      return { before: el.value.slice(0, el.selectionStart), textarea: el, pos: el.selectionStart };
    }
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || !sel.anchorNode) return null;
    let node = sel.anchorNode;
    let offset = sel.anchorOffset;
    if (node.nodeType !== Node.TEXT_NODE) {
      const prev = node.childNodes[offset - 1];
      if (!prev || prev.nodeType !== Node.TEXT_NODE) return null;
      node = prev;
      offset = prev.data.length;
    }
    return { before: node.data.slice(0, offset), sel, node, offset };
  };

  // Select the last `length` characters before the caret and type `text` over them.
  const replaceBeforeCaret = (info, length, text) => {
    if (info.textarea) {
      info.textarea.setSelectionRange(info.pos - length, info.pos);
    } else {
      const range = document.createRange();
      range.setStart(info.node, info.offset - length);
      range.setEnd(info.node, info.offset);
      info.sel.removeAllRanges();
      info.sel.addRange(range);
    }
    insertText(text);
  };

  // The most recent replacement, so Backspace right after it can undo it.
  let last = null;

  document.addEventListener('input', (e) => {
    if (applying) return;
    last = null;
    if (!enabled || e.inputType !== 'insertText') return;
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.closest('.tl-container')) return;
    if (el.tagName !== 'TEXTAREA' && !el.isContentEditable) return;
    // Let the editor finish handling the keystroke first.
    setTimeout(() => {
      const info = caretInfo(el);
      if (!info) return;
      const rep = findReplacement(info.before);
      if (!rep) return;
      const original = info.before.slice(-rep.length);
      replaceBeforeCaret(info, rep.length, rep.text);
      last = { el, original, text: rep.text };
    }, 0);
  }, true);

  // Backspace right after a replacement restores what you typed (√ -> sqrt).
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Backspace' || !last || e.ctrlKey || e.altKey || e.metaKey) return;
    const info = caretInfo(last.el);
    const undo = last;
    last = null;
    if (!info || !info.before.endsWith(undo.text)) return;
    e.preventDefault();
    e.stopPropagation();
    replaceBeforeCaret(info, undo.text.length, undo.original);
  }, true);

  // Alt+M toggles the auto-replace on and off.
  let toastEl = null;
  let toastTimer = 0;
  const toast = (msg) => {
    if (!toastEl) {
      toastEl = document.createElement('div');
      Object.assign(toastEl.style, {
        position: 'fixed', left: '50%', bottom: '80px', transform: 'translateX(-50%)',
        background: 'rgba(30,30,30,0.92)', color: '#fff', padding: '8px 14px', borderRadius: '8px',
        font: '14px system-ui, sans-serif', zIndex: '2147483647', pointerEvents: 'none',
      });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 1600);
  };

  window.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyM') {
      e.preventDefault();
      e.stopPropagation();
      enabled = !enabled;
      try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch (_) {}
      toast(enabled ? 'Math typing: ON  (sqrt → √)' : 'Math typing: OFF');
    }
  }, true);
})();
