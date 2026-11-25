# addons.mozilla.org submission

## Before submitting
- [ ] Permission from BoazCohenJ to publish this fork (the original repo has no licence), or a licence added there.
- [ ] Decide listed (public) or unlisted (signed, link-only).
- [ ] Untick Android at submission (no touch-keyboard support).
- [ ] Upload screenshots (1280×800) of: the popup, a drawn equation, a graph, the suggestion card.

## Listing
**Name:** Math Typing for tldraw

**Summary (≤ 250):** Type maths on tldraw.com: symbols as you type (x² α ∈ ≤), real roots, fractions and
bounds, a calculator that differentiates, integrates and solves, and graphs and shapes drawn on the board.

**Description:**
Math Typing turns tldraw.com into a maths notebook.

- Symbols as you type: x^2 → x², alpha → α, \in → ∈, -> → →, and about 120 more.
- Real roots, fractions and bounds drawn as shapes: sqrt{x+1}, d/dx, lim_{x->inf}.
- End a line with /draw to lay out a whole equation with nested fractions.
- /calc, /diff, /integrate, /solve, /simplify, /factor, /expand: answers are checked before they are written.
- /plot draws graphs with crossing points and circle centres; /draw triangle 3 4 5 draws labelled shapes.
- Suggestions while you type, and a popup with a quick start and every shortcut.

Not made by or affiliated with tldraw. Works only on tldraw.com.

**Category:** Education (or Productivity)
**Homepage / support:** https://github.com/yotam1001/tldraw-math-typing

## Privacy policy
Math Typing collects no data and makes no network requests. It runs only on tldraw.com pages, works
entirely in the browser, and stores its settings with `storage.local`. The manifest declares
`data_collection_permissions: { required: ["none"] }`.

## Notes for reviewers
- **Build:** no bundler or minifier; every file in the package is the source. `fonts.js` is generated
  by `tools/build-fonts.py` (in the repository, not the package) from Noto Sans Math, Noto Sans and
  Noto Serif (Google Fonts, SIL OFL 1.1, licence in `fonts/OFL.txt`): it subsets them to the maths
  characters tldraw's fonts lack and inlines them as base64, because a content script can't fetch its
  own files.
- **vendor/nerdamer:** unmodified nerdamer 1.1.13 (MIT, https://github.com/jiggzson/nerdamer), used for
  symbolic derivatives, integrals and solving. The linter flags `new Function` in nerdamer.core.js
  (its numeric `build()`). Our commands avoid the paths that use it, and Firefox's extension CSP
  blocks it anyway; if reached, it throws and the command reports an error.
- **page.js (world: MAIN):** tldraw only exposes its editor object to the page. page.js uses it to
  create text and line shapes for drawn equations, graphs and shapes, and talks to the content script
  through DOM CustomEvents with JSON strings. On boards where tldraw doesn't put the editor on
  `window`, it finds it through React's internals on the canvas element. It reads and writes nothing
  else.
- **Permissions:** `storage` (settings), `scripting` (to start in tldraw tabs that were open before
  install, update or Allow), host access to tldraw.com only.
- **Tests:** `node --test` in the repository.
