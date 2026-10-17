# Plot Area Calculator — implementation notes (2026-10-17)

Files: `plot-area-calculator.html`, `css/plot-area-calculator.css`, `js/plot-area-calculator.js`,
`images/plot-area-calculator-hero.jpg`, `images/og/plot-area-calculator-social.jpg`, link card in `property-tools.html`.

- 12 shapes, simple length inputs only (no angles/bearings/directions).
- Exact: square, rectangle, triangle (Heron), trapezoid (from 4 sides or with depth), L, T, flag (main + access path), irregular 4-sided with diagonal, curved with survey area.
- Approximate (clearly labelled "≈" with method note): pentagon / polygon / irregular without diagonal — uses the cyclic polygon (largest area those sides can enclose); curved without survey area.
- Live drawing and A4 sheet are drawn to scale from the entered measurements; road band (optional) is indicative.
- Exports: View Drawing (A4 landscape preview), Print / Save PDF (print tab, falls back to page print), Share (PNG via Web Share where supported, else link copy), Download PNG (2240×1580), Download SVG.
- Changing ft ↔ m converts entered values instead of clearing them.

## Tests
- `node tests/plot-area-calculator.test.js` — 26 geometry/area tests.
- Browser (Chromium/Playwright): all 12 shapes, unit switching, reset, validation, View Drawing, Print tab, Share fallback, PNG + SVG downloads, mobile 390px layout without horizontal overflow.
