# Aventrix Realty — NRI Property Tax Calculator Prototype

**Status:** isolated review prototype, not production-ready and not a tax calculator.

## Open it
1. Extract the ZIP.
2. Open `index.html` in a current browser.
3. Complete the five-step flow using fictional/sample values only.
4. On the final step, select **Preview branded report**. Review the Aventrix Realty branded report, then choose Print / Save as PDF or Share from the preview.

No build tooling, package install, backend, API key, database or internet connection is required.

## Important boundaries
- This is a separate prototype folder; it does not overwrite the uploaded Aventrix Realty website.
- It does not call Supabase, Cloudflare, GitHub, or any remote service. The report preview is generated in the browser and the Share action is only initiated after the user taps it.
- It does not save or transmit entered inputs. Browser clipboard/print features are initiated only by the user.
- The “simple arithmetic difference” is **not taxable capital gain**. No tax rates, holding-period rules, indexation, exemptions, TDS, treaty or repatriation rules are applied.
- Never enter PAN, passport, bank details, or real confidential financial data in this prototype.
- The original user-provided logo is included at `assets/aventrix-realty-original-logo.png`.

## Contents
- `index.html` — five-step user interface
- `css/calculator.css` — responsive Aventrix black/green/white visual system
- `js/calculator.js` — client-side navigation, validation, preliminary arithmetic summary, branded report preview, print/PDF and share actions
- `assets/` — original logo asset
- `docs/` — requirements, rule registry, PDF content and security notes
- `tests/` — manual QA checklist and scenario catalogue

## Before any real tax engine or production release
1. Obtain written review of the applicable Indian tax law for each supported transaction date and tax year from a qualified Indian tax professional.
2. Validate capital gains, withholding, exemption and remittance logic with independently calculated benchmark cases.
3. Implement a server-side, versioned rule registry and secure API only after architecture/security review.
4. Review privacy notice, consent, retention, deletion, logging, rate limits and access controls.
5. Test on an isolated staging environment and preserve all existing site routes, header/footer and Worker behaviour.
6. Obtain explicit production-release approval.

This is not legal, tax, financial or accounting advice.

## v9 implementation update (25 October 2026)
- Added a reference-inspired calculation dashboard with distinct Sale Consideration, Capital Gain, Estimated Final Tax, Buyer TDS Scenario, and Net Proceeds cards.
- Added editable provisional buyer TDS rate and surcharge assumption fields; they are visibly identified as assumptions and not legal advice.
- Calculation detail now includes holding-period months, stamp-duty value as a separate displayed input, TDS paid reconciliation where enough data exists, and explicit limits for short-term cases.
- Branded report preview continues to gate Print / Save as PDF and Share.
- Legal caveat: LTCG rate/cess outputs are illustrative; buyer TDS rate/base, surcharge, stamp value treatment, exemptions and special cases require transaction-specific CA verification before production use.
