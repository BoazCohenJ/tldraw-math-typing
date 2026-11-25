(() => {
  'use strict';
  const MT = globalThis.MathTyping;
  const ext = globalThis.browser ?? globalThis.chrome;
  const STORAGE_KEY = 'settings';
  const UI_KEY = 'ui'; // { seenIntro, tab }
  const $ = (id) => document.getElementById(id);

  let settings = MT.normalizeSettings(null);
  let ui = { seenIntro: false, tab: 'start' };
  let lastSaved = '';
  const save = () => {
    lastSaved = JSON.stringify(settings);
    return ext.storage.local.set({ [STORAGE_KEY]: settings });
  };
  const saveUi = () => ext.storage.local.set({ [UI_KEY]: ui });
  const catLabel = Object.fromEntries(MT.CATEGORIES.map((c) => [c.id, c.label]));
  const announce = (msg) => { $('live').textContent = msg; };

  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    for (const k of kids) if (k != null) n.append(k);
    return n;
  };
  const copy = (btn, value) => {
    const shown = btn.textContent;
    navigator.clipboard.writeText(value).then(() => {
      btn.textContent = 'Copied';
      announce(`Copied ${value}`);
      setTimeout(() => { btn.textContent = shown; }, 800);
    }).catch(() => {});
  };
  const switchEl = (checked, label, onChange) => {
    const input = el('input', { type: 'checkbox', checked });
    if (label) input.setAttribute('aria-label', label);
    input.addEventListener('change', () => onChange(input.checked));
    return el('span', { className: 'switch' }, input, el('span', { className: 'track' }, el('span', { className: 'thumb' })));
  };

  // ---------------------------------------------------------------- tabs (WAI-ARIA tabs)
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const showTab = (name, focus = false) => {
    for (const t of tabs) {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
      $(t.dataset.tab).hidden = !on;
    }
    ui.tab = name;
    saveUi();
    if (name === 'sheet' && !focus) setTimeout(() => $('search').focus(), 0);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      const n = tabs.length;
      const go = { ArrowRight: i + 1, ArrowLeft: i - 1 + n, Home: 0, End: n - 1 }[e.key];
      if (go === undefined) return;
      e.preventDefault();
      showTab(tabs[go % n].dataset.tab, true);
    });
  });

  // ---------------------------------------------------------------- start
  for (const b of document.querySelectorAll('.try')) b.addEventListener('click', () => copy(b, b.dataset.copy));
  $('intro-done').addEventListener('click', () => {
    ui.seenIntro = true;
    showTab('sheet');
  });

  // ---------------------------------------------------------------- symbols
  const TOOL_CATS = new Set(MT.CATEGORIES.filter((c) => c.group === 'tools').map((c) => c.id));
  const rows = MT.cheatSheet().filter((r) => !TOOL_CATS.has(r.cat));
  const CHIPS = [
    ['all', 'All', null],
    ['ops', 'Operators', ['symbols']],
    ['powers', 'Powers & roots', ['scripts', 'roots', 'fractions']],
    ['greek', 'Greek & sets', ['greek', 'sets', 'words']],
    ['latex', 'LaTeX & braces', ['latex', 'braces']],
    ['draw', 'Drawing', ['draw', 'deriv', 'bounds', 'blocks', 'stacked']],
  ];
  let chip = 'all';
  const renderChips = () => {
    const box = $('chips');
    box.replaceChildren();
    for (const [id, label] of CHIPS) {
      const b = el('button', { textContent: label, type: 'button' });
      b.setAttribute('aria-pressed', String(chip === id));
      b.addEventListener('click', () => { chip = id; renderChips(); renderSheet(); });
      box.append(b);
    }
  };
  // Only real symbols get a copy button; rows that describe a layout show it as text.
  const copyable = (get) => !/[a-z]{3,}/i.test(get);
  const renderSheet = () => {
    const q = $('search').value.trim().toLowerCase();
    const list = $('sheet-list');
    list.replaceChildren();
    const cats = (CHIPS.find((c) => c[0] === chip) || [])[2];
    let lastCat = null;
    for (const r of rows) {
      if (cats && !cats.includes(r.cat)) continue;
      const label = catLabel[r.cat];
      if (q && !`${r.type} ${r.get} ${label}`.toLowerCase().includes(q)) continue;
      if (r.cat !== lastCat) {
        const h = el('h3', { textContent: label });
        if (!settings.categories[r.cat]) h.append(el('span', { className: 'pill', textContent: 'off' }));
        list.append(h);
        lastCat = r.cat;
      }
      let out;
      if (copyable(r.get)) {
        const sym = r.get.split(/\s{2}|\s\(/)[0];
        out = el('button', { className: 'out', textContent: r.get, type: 'button' });
        out.setAttribute('aria-label', `Copy ${sym}`);
        out.addEventListener('click', () => copy(out, sym));
      } else {
        out = el('span', { className: 'desc', textContent: r.get });
      }
      list.append(el('div', { className: 'item' }, el('code', { textContent: r.type }), out));
    }
    if (!list.children.length) list.append(el('p', { className: 'empty', textContent: 'No matches.' }));
  };

  const renderCustom = () => {
    const ul = $('custom-list');
    ul.replaceChildren();
    $('mine-count').textContent = settings.custom.length ? `(${settings.custom.length})` : '';
    settings.custom.forEach((c, i) => {
      const del = el('button', { className: 'remove', textContent: '×', type: 'button' });
      del.setAttribute('aria-label', `Remove ${c.from}`);
      del.addEventListener('click', () => {
        settings.custom.splice(i, 1);
        save();
        renderCustom();
      });
      ul.append(el('li', { className: 'item' }, el('code', { textContent: c.from }), el('span', { className: 'out', textContent: c.to }), del));
    });
    if (!settings.custom.length) ul.append(el('li', { className: 'empty', textContent: 'None yet. Try eps → ε.' }));
  };
  $('custom-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const from = $('custom-from').value.trim();
    const to = $('custom-to').value;
    const err = $('custom-error');
    err.hidden = true;
    if (!from || !to) return;
    if (to.endsWith(from)) {
      err.textContent = `"${to}" ends with "${from}", so it would keep changing. Pick something else.`;
      err.hidden = false;
      return;
    }
    settings.custom = settings.custom.filter((c) => c.from !== from);
    settings.custom.push({ from, to });
    save();
    $('custom-from').value = '';
    $('custom-to').value = '';
    $('custom-from').focus();
    renderCustom();
    announce(`Added ${from} → ${to}`);
  });

  // ---------------------------------------------------------------- tools
  const TOOLS = [
    { id: 'draw', icon: '½', name: 'Draw equations',
      text: 'End a line with /draw (then space or Enter). // makes a fraction and {…} groups a part. A plain equation in x and y, like y = 3x^2, is drawn as its graph.',
      examples: ['y = x//{x+3} + 4 /draw', '{a+b}//{c//d} = 1//2 /draw', 'int_0^1 x^2 dx = 1//3 /draw', 'y = 3x^2 + 2x /draw'] },
    { id: 'cas', icon: '∑', name: 'Calculator',
      text: 'Start a line with a command and press Enter: the answer is written after it. Answers are checked numerically.',
      examples: ['/calc 2^10/3', '/diff e^x//(2-e^x)', '/integrate x^2 from 0 to 3', '/solve x^2-5x+6=0', '/factor x^2-5x+6'] },
    { id: 'plot', icon: '〜', name: 'Graphs',
      text: 'Draws a graph under the line, with crossing points and circle centres marked.',
      examples: ['/plot sin(x), cos(x)', '/plot x^2+y^2=25, y=x', '/plot x^2-6x+y^2+t=0 where t=5'] },
    { id: 'shapes', icon: '△', name: 'Shapes',
      text: 'Draws the shape with its sides and angles marked.',
      examples: ['/draw triangle 3 4 5', '/draw right triangle 3 4', '/draw circle 3', '/draw hexagon 2', '/draw angle 40'] },
  ];
  const renderTools = () => {
    const box = $('tool-cards');
    box.replaceChildren();
    for (const t of TOOLS) {
      const on = !!settings.categories[t.id];
      const examples = el('div', { className: 'examples' });
      for (const ex of t.examples) {
        const b = el('button', { textContent: ex, type: 'button', className: 'try' });
        b.setAttribute('aria-label', `Copy ${ex}`);
        b.addEventListener('click', () => copy(b, ex));
        examples.append(b);
      }
      const card = el('div', { className: 'card' + (on ? '' : ' off') });
      const sw = switchEl(on, `${t.name} on or off`, (v) => {
        settings.categories[t.id] = v;
        card.classList.toggle('off', !v);
        save();
      });
      card.append(el('label', { className: 'card-head' }, el('span', { className: 'icon', textContent: t.icon }), el('strong', { textContent: t.name }), sw),
        el('p', { textContent: t.text }), examples);
      box.append(card);
    }
  };

  // ---------------------------------------------------------------- settings
  const DRAW_CATS = ['deriv', 'bounds', 'blocks', 'stacked', 'fractions'];
  const renderCategories = () => {
    const draw = $('cats-draw');
    const typing = $('cats-typing');
    draw.replaceChildren();
    typing.replaceChildren();
    for (const c of MT.CATEGORIES) {
      if (c.group === 'tools' || c.id === 'draw') continue; // on the Tools tab
      const sw = switchEl(!!settings.categories[c.id], null, (v) => {
        settings.categories[c.id] = v;
        save();
        renderSheet();
      });
      const row = el('label', { className: 'row' }, el('span', { textContent: c.label }), sw);
      (DRAW_CATS.includes(c.id) ? draw : typing).append(row);
    }
  };
  for (const input of document.querySelectorAll('[data-opt]')) {
    input.addEventListener('change', () => {
      settings[input.dataset.opt] = input.checked;
      save();
    });
  }
  // Presets: the defaults, or a quieter set for writing notes and prose.
  const NOTES_OFF = ['words', 'greek', 'sets', 'deriv', 'bounds'];
  for (const b of document.querySelectorAll('[data-preset]')) {
    b.addEventListener('click', () => {
      const base = MT.normalizeSettings({ v: settings.v, custom: settings.custom });
      if (b.dataset.preset === 'notes') for (const id of NOTES_OFF) base.categories[id] = false;
      settings = { ...base, enabled: settings.enabled };
      save();
      render();
      announce(b.dataset.preset === 'notes' ? 'Notes-friendly settings on' : 'Default settings on');
    });
  }
  $('reset').addEventListener('click', () => {
    settings = MT.normalizeSettings(null);
    save();
    render();
    announce('All settings reset');
  });

  $('enabled').addEventListener('change', () => {
    settings.enabled = $('enabled').checked;
    save();
    checkTab();
  });
  $('search').addEventListener('input', renderSheet);

  const render = () => {
    $('enabled').checked = settings.enabled;
    for (const input of document.querySelectorAll('[data-opt]')) input.checked = !!settings[input.dataset.opt];
    renderChips();
    renderSheet();
    renderTools();
    renderCustom();
    renderCategories();
  };

  try { $('version').textContent = `v${ext.runtime.getManifest().version}`; } catch (_) {}

  // ---------------------------------------------------------------- status of this tab
  const ORIGINS = { origins: ['https://tldraw.com/*', 'https://*.tldraw.com/*'] };
  const setStatus = (state, text, action) => {
    $('status').dataset.state = state;
    $('status-text').textContent = text;
    const btn = $('status-action');
    btn.hidden = !action;
    if (action) {
      btn.textContent = action.label;
      btn.onclick = action.run;
    }
  };
  const checkTab = async () => {
    let allowed = true;
    try { allowed = await ext.permissions.contains(ORIGINS); } catch (_) {}
    $('access').hidden = allowed;
    if (!allowed) return setStatus('warn', 'Needs your OK for tldraw.com');
    if (!settings.enabled) return setStatus('off', 'Paused (Alt+M on the page)');
    let tab = null;
    try { [tab] = await ext.tabs.query({ active: true, currentWindow: true }); } catch (_) {}
    if (!tab || !tab.url || !/^https:\/\/([a-z0-9-]+\.)*tldraw\.com\//i.test(tab.url)) {
      return setStatus('off', 'Open a tldraw.com board to use it');
    }
    let answer = null;
    try { answer = await ext.tabs.sendMessage(tab.id, { type: 'mathtyping:ping' }); } catch (_) {}
    if (answer && answer.ok) return setStatus('ok', 'Active on this board');
    setStatus('warn', 'Not running in this tab yet', {
      label: 'Start',
      run: async () => {
        try { await ext.runtime.sendMessage({ type: 'mathtyping:attach' }); } catch (_) {}
        setTimeout(checkTab, 300);
      },
    });
  };
  $('grant').addEventListener('click', async () => {
    try { await ext.permissions.request(ORIGINS); } catch (_) {}
    checkTab();
  });

  // ---------------------------------------------------------------- load
  ext.storage.local.get([STORAGE_KEY, UI_KEY]).then((got) => {
    settings = MT.normalizeSettings(got[STORAGE_KEY]);
    ui = { ...ui, ...(got[UI_KEY] || {}) };
    render();
    showTab(ui.seenIntro ? (ui.tab === 'start' ? 'sheet' : ui.tab) : 'start');
    checkTab();
  });
  // Alt+M on the page while the popup is open. Our own saves are skipped, so a switch you
  // just pressed keeps its keyboard focus.
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    const incoming = JSON.stringify(changes[STORAGE_KEY].newValue);
    if (incoming === lastSaved) return;
    settings = MT.normalizeSettings(changes[STORAGE_KEY].newValue);
    render();
    checkTab();
  });
  render();
})();
