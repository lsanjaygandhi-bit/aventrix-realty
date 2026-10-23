# Aventrix Realty multilingual source preview

This is a local-testing source package only. It does not deploy or change the live website.

## Languages
English (default), Tamil (`/ta/`), Hindi (`/hi/`), Telugu (`/te/`), Kannada (`/kn/`), Malayalam (`/ml/`).

## Local preview
From this folder run:
```bash
python3 tools/dev-server.py
```
Open `http://127.0.0.1:4173/` and choose a language from the selector. Localhost
uses a `?lang=` parameter so the same flow also works with VS Code Live Server,
which does not rewrite locale-prefixed routes. The preview server also maps
direct `/ta/`, `/hi/`, `/te/`, `/kn/`, and `/ml/` paths to the same source pages.

## Browser smoke steps
1. On `/`, select English, Tamil, Hindi, Telugu, Kannada and Malayalam in turn.
   Check the navigation, hero, property-search labels and placeholder, section
   heading, footer, and the `data-avx-translation-fallbacks` value (`0` for the
   explicitly keyed sample).
2. On `properties.html`, select each language and check the page heading, filter
   labels, result count and property-card action labels. Change a filter, refresh,
   and confirm the language and filter remain selected.
3. On `emi-calculator.html`, check the loan labels, outputs and chart
   accessibility text in each language. Toggle Years/Months and confirm tenure
   units and calculation results update.
4. On `plot-area-calculator.html`, check the shape picker, dimension labels,
   shape help, validation, calculated area/method, drawing preview controls,
   and converter in each language. Check the mobile layout at a 390px viewport.
5. In Hindi, open the AI assistant and check its dialog label, welcome message,
   suggestions, input placeholder, send/close labels and disclaimer.
6. Switch to another page and refresh; the selected local language should remain.
   Select English to restore the original English UI.
7. Visit `/ta/index.html` directly to confirm the preview server serves it rather
   than a `Cannot GET` error.

## Current implementation
- Adds a compact language dropdown styled to match the existing dark Post Property pill.
- Switching language keeps the current page. Localhost stores the choice and uses `?lang=`; production locale routes use their existing prefixes.
- Uses explicit `data-i18n*` keys on the homepage plus static interface phrases already translated in all six locale dictionaries across the existing HTML pages and footer partial.
- Supports semantic keys for shared chrome and dynamic components through `window.avxI18n`; missing translations use English and are reported in the page console.
- Keeps the language choice across local navigation and refresh.
- Does not alter database records, prices, listing facts, or the existing header/footer markup.
- The plot calculator's shape controls, dynamic input labels/help, common validation
  messages, calculated result units/methods, preview dialog controls and converter
  have explicit translations in all six locales.

## Important QA limitation
This is still a partial implementation, not a complete website translation. See [the page-by-page coverage report](./docs/MULTILINGUAL-COVERAGE.md) for keyed and unmarked source text. The plot calculator's printable/downloaded drawing labels, some preview/export/share status messages, and its transaction/survey disclaimers remain untranslated or require human review. Other forms, calculators, dynamic states, legal content, and property/CMS data also need additional translation and human review. Names, addresses, listing facts, prices, and user-submitted descriptions are intentionally not translated as generic UI. Do not deploy until missing keys are resolved and every page and interaction has passed six-language browser QA.
