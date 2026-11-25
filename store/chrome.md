# Chrome Web Store submission

Upload `dist/math-typing-chrome-<version>.zip` (from `npm run build`) in the
[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Before submitting
- [ ] A Chrome Web Store developer account (one-time registration fee, paid by whoever publishes).
- [ ] The licence question settled with both authors (see README).
- [ ] A support email or URL for the listing (the GitHub issues page works).

## Store listing
- **Name:** Math Typing for tldraw
- **Summary (≤132):** Type maths on tldraw.com: symbols as you type, real fractions and roots, a calculator, graphs and shapes. Not made by tldraw.
- **Description:** use the one in `store/firefox.md`.
- **Category:** Education
- **Language:** English
- **Screenshots (1280×800):** `store/screenshots/1-calculus.png`, `2-graph.png`, `3-equations.png`, `4-suggestions.png`, `5-popup.png`
- **Small promo tile (440×280):** `store/screenshots/promo-440x280.png`
- **Icon:** in the package (`icons/icon-128.png`).
- **Homepage:** https://github.com/yotam1001/tldraw-math-typing

## Privacy practices tab
- **Single purpose:** Helps students write and work with maths on tldraw.com whiteboards: it turns typed
  shortcuts into maths symbols and layouts, and runs maths commands typed into text boxes.
- **Permission justifications:**
  - `storage` — saves the user's settings and custom shortcuts.
  - `scripting` — starts the extension in tldraw tabs that were already open when it was installed or
    updated, so they work without a reload.
  - Host permission `https://tldraw.com/*`, `https://*.tldraw.com/*` — the extension only works on
    tldraw.com, where it reads what you type in text boxes and draws maths shapes.
- **Remote code:** No. All code is in the package; nothing is downloaded or evaluated.
- **Data usage:** the extension collects no user data (tick none of the data types). Certify that data
  is not sold, not used for unrelated purposes, and not used for creditworthiness.
- **Privacy policy URL:** https://github.com/yotam1001/tldraw-math-typing/blob/main/store/privacy.md
