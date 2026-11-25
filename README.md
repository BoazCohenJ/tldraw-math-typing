# Math Typing for tldraw

A Firefox / Zen extension (Chrome and Edge work too) for writing maths on [tldraw.com](https://tldraw.com).
Not made by or affiliated with tldraw.

- **Symbols as you type**: `x^2` → x², `alpha` → α, `\in` → ∈, `->` → →, `+-` → ±, and about 120 more.
- **Real roots, fractions and bounds**: `sqrt{x+1}` is drawn as a root with its bar, `d/dx` stacked,
  `lim_{x->inf}` with x→∞ underneath.
- **Whole equations on `/draw`**: end a line with `/draw` and it is laid out with stacked (nested)
  fractions, bounds above and below ∫ ∑ lim, raised exponents and roots, as grouped tldraw shapes.
- **Calculator**: `/calc`, `/diff`, `/integrate`, `/solve`, `/simplify`, `/factor`, `/expand` + Enter.
  Answers are checked numerically before they are written.
- **Graphs**: `/plot sin(x), cos(x)` + Enter draws a graph under the line, with crossing points and
  circle centres marked. `y = 3x^2 + 2x /draw` graphs it too.
- **Shapes**: `/draw triangle 3 4 5`, `/draw circle 3` … + Enter, with sides and angles marked.
- **Matching fonts**: symbols tldraw's fonts lack (∈ ℝ ⇒, superscript letters, Greek in handwriting)
  come from one bundled font instead of whatever the system finds.
- **Suggestions** for maths words, `\commands` and `/commands` (Tab to use), and a toolbar popup with
  a quick start, a searchable list of every shortcut, your own shortcuts and a switch for each feature.

Forked from [BoazCohenJ/tldraw-math-typing](https://github.com/BoazCohenJ/tldraw-math-typing).

## Install
**Zen or Firefox (140+), until it is on addons.mozilla.org:**
1. In `about:config`, set `xpinstall.signatures.required` to `false` (Zen allows unsigned add-ons; release Firefox doesn't).
2. Build: `npx web-ext build` (uses `web-ext-config.mjs`), then rename the zip in `web-ext-artifacts/` to `.xpi`.
3. Open the `.xpi` in Zen and click **Add**. If the popup says it needs your OK for tldraw.com, press **Allow**.

For a quick try that lasts until restart: `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json`.

**Chrome/Edge:** `chrome://extensions` → Developer mode → Load unpacked → this folder.

## Typing shortcuts
| Type | Get |
|---|---|
| `x^2`, `x^-12`, `e^{2x}`, `x^(n+1)` | x², x⁻¹², e²ˣ, xⁿ⁺¹ |
| `x_1`, `x_max`, `a_{n-1}` | x₁, xₘₐₓ, aₙ₋₁ (not inside words like `my_name`) |
| `sqrt{x+1}`, `cbrt{8}` | a drawn root: the bar grows as you type, drawn when `}` closes it |
| `sqrt(81+9)`, `4sqrt(10)` | √(81+9), 4√10 (inline) |
| `2*3`, `2**3`, `8 div 2` | 2×3, 2·3, 8 ÷ 2 (`* item` lists and `**bold**` stay as typed) |
| `+-` `-+` `>=` `<=` `!=` `~=` `===` | ± ∓ ≥ ≤ ≠ ≈ ≡ |
| `->` `=>` `<->` `<=>` `...` | → ⇒ ↔ ⇔ … |
| `abs{x}`, `vec{v}`, `bar{x}`, `hat{x}`, `dot{x}` | \|x\|, v⃗, x̄, x̂, ẋ |
| `pi` `inf` `90deg` `approx` `forall` `emptyset` | π ∞ 90° ≈ ∀ ∅ |
| `int_` `int^` `int(`, `partial/partial x` | ∫, ∂/∂x (not the English words) |
| `alpha` `beta` `gamma` `delta` `epsilon` `theta` `lambda` `mu` `sigma` `phi` `omega`, `Delta` `Sigma` `Omega` | α β γ Δ ε θ λ μ Σ φ ω, Δ Σ Ω |
| `NN` `ZZ` `QQ` `RR` | ℕ ℤ ℚ ℝ |
| LaTeX: `\in` `\notin` `\subseteq` `\cup` `\cap` `\sum` `\exists` `\therefore` `\angle` `\perp` `\iff` `\delta` … | ∈ ∉ ⊆ ∪ ∩ ∑ ∃ ∴ ∠ ⊥ ⇔ δ … (full list in the popup) |

Words convert when you type the next space or symbol, or press Enter, Esc or Tab. Backspace right
after a change puts back what you typed. **Alt+M** pauses everything.

## Drawing
Drawing happens only when you ask for it:

| Write | Drawn as |
|---|---|
| `sqrt{x+1}` | √ with a bar over x+1, when `}` closes it |
| `d/dx` + space, `dy/dx`, `d²y/dx²`, `∂/∂x` | stacked |
| `lim_{x->inf}` + space, `int_{0}^{1}`, `sum_{i=1}^{n}` | the operator with bounds above and below |
| `y = x//{x+3} + 4 /draw` | the whole line: x over x+3, + 4 |
| `{a+b}//{c//d} = 1//2 /draw` | nested fractions; `{…}` groups a part |
| `int_0^1 x^2 dx = 1//3 /draw` | ∫ with 0 below and 1 above |
| `//{3//{x+2}}` | the block, drawn when its last `}` closes it |
| `y = 3x^2 + 2x /draw` | a plain equation in x and y is drawn as its graph |

`\\` works like `//`. Drawn equations are grouped shapes; Ctrl+Z takes them back. In box labels and
sticky notes, which can't hold shapes, they stay as text (√(x+1), ∫₀¹). Settings has stricter
modes (draw every `3//4` as you type, or turn it into ¾).

## Tools: start a line with `/`, press Enter
| Line | Result |
|---|---|
| `/calc 2^10/3` | `2¹⁰/3 = 1024/3 ≈ 341.3333333` |
| `/calc sin(30°)`, `/calc log(100)` | `0.5`, `2` (log is base 10, ln is natural) |
| `/diff x^3 sin(x)`, `/diff e^x//(2-e^x)` (also `wrt t`) | `3x²·sin(x) + x³·cos(x)` … |
| `/integrate x^2`, `/integrate x^2 from 0 to 3` | `x³/3 + C`, `9` |
| `/solve x^2-5x+6=0` | `x = 2 or x = 3` (at most 6 roots shown) |
| `/simplify`, `/factor`, `/expand` | `(x − 2)·(x − 3)` … |
| `/plot sin(x), cos(x) from -pi to pi`, `/plot f(x)=x^2, g(x)=2x`, `/plot x^2 and 2x` | a graph with crossing points marked (separate curves with `,` `;` `&` or `and`) |
| `/plot x^2+y^2=25, y=x`, `/plot x^2-6x+y^2+t=0 where t=5` | circles get their centre and radius |
| `/draw triangle 3 4 5`, `right triangle 3 4`, `circle 3`, `ellipse 3 2`, `square 4`, `rectangle 3 by 5`, `hexagon 2`, `polygon 7 2`, `angle 40` | the shape, sides and angles marked |

`/plot{…}`, `/calc{…}` and `\plot …` work too. Lines without the slash are never run. If an answer
can't be checked (a library slip, an integral across a pole), you get a message instead of a wrong
answer.

## Privacy
Math Typing collects nothing and sends nothing anywhere. It runs only on tldraw.com, works entirely
in your browser, and keeps its settings in the browser's extension storage.

## Files
- `rules.js` typing shortcuts and `/draw` parsing · `mathtools.js` calculator, graphs, shapes
- `content.js` runs on tldraw.com · `page.js` draws with tldraw's editor (page world)
- `background.js` attaches to open tabs after install, update or Allow
- `fonts.js` fallback fonts, built by `tools/build-fonts.py` (Noto fonts, SIL OFL: `fonts/OFL.txt`;
  DejaVu Sans Bold for the handwriting style's symbols: `fonts/DejaVu-LICENSE.txt`)
- `cas-worker.js` runs the calculator in the background, loaded only when you use it, with a time limit
- `vendor/nerdamer` symbolic maths (MIT, unmodified 1.1.13) · `popup.*` the toolbar popup
- `AMO.md` store listing, privacy statement and notes for reviewers

## Tests
`node --test` runs the typing rules, the calculator and figures, with eval disabled as in Firefox.
