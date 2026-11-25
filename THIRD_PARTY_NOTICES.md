# Third-party notices

## nerdamer 1.1.13 — MIT
`src/vendor/nerdamer/` — https://github.com/jiggzson/nerdamer — Copyright (c) 2015 Martin Donk.
Licence: `src/vendor/nerdamer/license.txt`.

One change, in `nerdamer.core.js`: the `build()` function, which compiled expressions into JavaScript with
`new Function`, throws an error instead. Browser extensions may not compile code from strings, and Math
Typing never uses `build()`.

## Noto Sans Math, Noto Sans, Noto Serif — SIL Open Font License 1.1
Subsets inlined in `src/fonts.js` (built by `tools/build-fonts.py`). Copyright 2022 The Noto Project
Authors. Licence: `src/fonts/OFL.txt`.

## DejaVu Sans Bold — Bitstream Vera / DejaVu licence
A subset of the maths symbols, inlined in `src/fonts.js` and renamed "MathTyping Symbols" as the licence
requires for modified versions. Licence: `src/fonts/DejaVu-LICENSE.txt`.
