# Changelog

## 1.8.0 (release candidate)
- Firefox/Zen and Chrome/Edge packages from one source (`npm run build`).
- Writing flow, from typing whole exam questions:
  - Enter after an answer or a drawing continues on the next line, at the left edge.
  - A line with `//` fractions is laid out when you press Enter (no `/draw` needed; can be turned off).
  - A drawing taller than its line moves its row down instead of covering the line above.
  - A root inside a formula waits for the whole formula (the quadratic formula comes out in one piece).
  - `sin(x)//x` puts sin(x) on top.
  - Commands run on the whole line, wherever the caret is, even after edits split the line.
- Triangles are named like questions name them: `/draw triangle 3 4 5` is AB = 3, BC = 4, CA = 5;
  `/draw triangle AB=3 BC=4 AC=5` works too.
- Answers show 6 significant digits.
- Several curves can be written `f(x)=…, g(x)=…` or separated by `and`, `;` or `&`.
- Calculator commands run in the background (a worker with a 6 s limit on Firefox), so the algebra
  library no longer loads into every page.
- The handwriting style's maths symbols use a bold font that matches its strokes.
- nerdamer's code-compiling `build()` removed: no linter warnings.

## 1.6.0 – 1.7.2
Pre-release review fixes (calculator correctness and limits, never losing text, notes-friendly typing,
store readiness), the new popup and suggestion card, drawn roots, intersection points and circle
centres in graphs.

## 1.0 – 1.5
The original Chrome extension by Boaz Cohen, the Firefox/Zen port, typing shortcuts, drawn fractions and
equations, calculator, graphs, shapes and font matching.
