# Aventrix Realty — Admin Links + EMI Calculator (2026-09-26)

**Base:** `aventrix-realty-cms-complete-2026-09-26`.

**Status:**
- Tested locally only.
- **Not deployed and not pushed.**
- **Nothing was written to the live database, and no migration was run.**

## 1. Files

**Created**
- `emi-calculator.html` — the page. Built from the site's shared page template: same `<head>`, header, footer, floating buttons and scripts as every other page.
- `js/emi-calculator.js` — calculator logic. Plain JavaScript, no libraries.
- `css/emi-calculator.css` — calculator styles. Existing colours, font, card and button styles.
- `ADMIN-LINKS-AND-EMI-CALCULATOR-2026-09-26.md` — this report.

**Modified**
- **All 24 existing public HTML pages.** The only changes on each page:
  - the header Admin link
  - the footer Admin link
  - the footer EMI Calculator link
  - one blank line
- `sitemap.html` — also lists "EMI Calculator" under Services.
- `sitemap.xml` — adds `emi-calculator.html`.
- `tests/browser_e2e.py` — two checks updated. They used to assert "no Admin link" and now assert "exactly one header and one footer Admin link to `/admin/`".
- `PRODUCTION-MIGRATION-CHECKLIST.md` — step 8 now expects the Admin links and checks the EMI page.
- `CMS-AND-WEBSITE-AUDIT-2026-09-26.md` — one note that the earlier "no Admin link" decision is reversed.

**Not touched**
- everything in `/admin/`
- `style.css` and every other existing CSS/JS file
- `sql/`, Supabase, RLS, CRM, CMS mappings, founder content, testimonials, Terms/Privacy text, media and property cards

## 2. Admin links

- **Header:** `<a href="/admin/" class="main-nav-admin">Admin</a>`, the last item of `<nav class="main-nav">`, directly after "Contact", on every page.
  - This is the original header link, restored. `style.css` still had its spacing rules at every desktop width tier, and `script.js` already skips it when highlighting the current page.
  - On phones it appears as the last item in the ☰ menu, above the phone numbers.
- **Footer:** `<a href="/admin/" class="pf-legal-admin">Admin</a>` in the bottom legal row (`.pf-legal`): Privacy Policy · Terms & Conditions · Sitemap · **Admin**, on every page.
- **Shared header/footer:** there is no shared include system. Each page carries its own copy of the header and footer, so the identical line was inserted by script into all 24 pages plus the new page. It was verified identical everywhere.
- **Admin Panel:** `/admin/` already existed and was **not rebuilt or modified**. `/admin/index.html` (login), `/admin/dashboard.html` and all Admin JS/CSS are byte-identical to the base build.
- **Security:** each link is plain navigation only. Nothing about Admin (data, keys, config) is exposed on the public pages, and Admin authentication is unchanged.
- **Robots:** `robots.txt` still has `Disallow: /admin/`.

## 3. EMI Calculator

**Formula** (reducing balance): `EMI = P × r × (1+r)^n / ((1+r)^n − 1)`, where
- P = loan amount
- r = annual rate ÷ 12 ÷ 100
- n = months

The EMI is rounded to the nearest rupee. Every total is built from that rounded EMI, so the screen always reconciles:
- **Total Amount Payable = EMI × months = Principal + Total Interest**
- **Principal % + Interest % = 100%**, since interest % is computed as 100 − principal %, rounded to 0.1%

**Inputs**

| Input | Range | Step | Default |
|---|---|---|---|
| Loan amount | ₹1 Lakh – ₹5 Cr | ₹1 Lakh (slider); any rupee amount when typed | ₹50 Lakh |
| Interest rate (p.a.) | 5% – 20% | 0.05% | 8.5% |
| Tenure | 1 – 30 years, or 12 – 360 months (Yr/Mo toggle) | 1 | 20 years |

- **Typing:** each input also has a box you can type into. The amount box accepts `7500000`, `75,00,000`, `75 lakh`, `75L` or `1.2 cr`.
- **Out of range:** values outside the range snap to the nearest limit.
- **Amount display:** shown as ₹50 Lakh / ₹1.60 Cr, with full Indian grouping in the results (₹1,60,00,000).

**Page contents:**
- a note under the hero
- Loan Details (inputs) and the Monthly EMI result card: side by side on desktop, stacked on phones
- Breakdown, with an SVG donut (principal green, interest gold), a legend with amounts and percentages, and principal %, interest % and monthly rate
- five Tips
- the disclaimer (your exact wording)
- a closing call to action to Properties / Contact

**Floating buttons:**
- **Phones:** WhatsApp and Back-to-top step aside (fade out) while the calculator is under them, and return over the hero, the call to action and the footer.
- **Desktop 769–1279px:** the calculator keeps a side gutter so the buttons never overlap it.
- **1280px and wider:** the page margin already clears them.
- **Call button:** this site has no floating Call button. Calls go through the phone icon in the header, which is unchanged.

**SEO:**
- title "EMI Calculator | Aventrix Realty", with one H1
- meta description and canonical URL
- Open Graph / Twitter tags, in the same pattern as the other pages
- WebPage + BreadcrumbList structured data, as on the other service pages
- indexable, and listed in `sitemap.xml`

**Accessibility:**
- every slider and box has a label
- the sliders work by keyboard (arrows, Home/End)
- `aria-valuetext` reads e.g. "₹50 Lakh" or "8.5% per year"
- the Yr/Mo buttons use `aria-pressed`
- the monthly EMI is announced when it changes (`aria-live`)
- the donut has a text label, and every figure is also printed as text, so nothing relies on colour alone

**Size:** about 13 KB of new JS + 11 KB of CSS. No libraries, no new CDN.

**CMS:**
- The formula is code-only.
- The hero (eyebrow, heading, intro), the note, the Tips and the disclaimer carry the site's standard CMS hooks, so they are ready for Admin. Until an Admin row exists they show the text in the page, as every page does.
- The page is **not yet listed in Admin → Website Content**. That needs one line in `admin/js/page-content.js`, and you asked that Admin modules not be changed. Say the word and I'll add it.

## 4. Tests (local stack: Chromium + real site code + PostgREST over a copy of the live content)

| Test | Result |
|---|---|
| Maths: 13 named cases, including published EMIs (10 L·10%·10 yr = ₹13,215; 50 L·8.5%·20 yr = ₹43,391; 1 Cr·9%·20 yr = ₹89,973; 30 L·7%·15 yr = ₹26,965), min/max loan, 5%/20%, 12/360 months | 13/13 |
| Maths sweep: 50,568 amount × rate × tenure combinations. The exact EMI clears the loan to under ₹0.01, and every total and percentage reconciles | 0 failures |
| Admin links + EMI probe, touch devices: 320, 375, 390, 430, 768, 1024 (tablet), 1280, 1440 × all 25 pages. Covers header/footer Admin (exactly 2, labelled "Admin", `/admin/`), the ☰ menu on phones, the footer links clickable, floating buttons vs footer, overflow, JS errors, EMI inputs (keyboard, typing, tap-and-type, Yr/Mo, clamping), results reconcile on screen, floating buttons never over the calculator (checked every 120px of scroll), 40px+ touch targets, Admin links open the existing login, and no broken internal links | 1725/1725 |
| Same probe, desktop windows (no touch) at 768 and 1024 | 435/435 |
| Desktop header sweep: 769, 800, 900, 1000, 1023, 1024, 1100, 1150, 1151, 1200, 1300, 1301, 1366, 1450, 1920 × 25 pages. Admin visible, nav on one row, icons in view, no overflow | 375/375 |
| EMI page recheck after the final CSS spacing fix, all widths | 253/253 + 67/67 |
| Existing browser E2E suite | 80/80 |
| Existing Admin CMS round-trip | 185/185 |
| Existing DB / RLS security matrix | 85/85 |
| Existing matching tests | 13/13 |
| Property-card regression, this build vs base build, same data | identical results |
| Property-card layout audit, 10 widths, this build vs base build | identical geometry |
| Existing responsive probe (25 pages × 10 widths, 320–1440): overflow, footer covered, JS errors | 250/250, 0 problems |

## 5. For your review

1. **`/admin/` on Cloudflare:** the links use `/admin/`. Cloudflare static assets serve `admin/index.html` for it by default, and checklist step 8 already checks it. I couldn't open it from here because `robots.txt` blocks automated fetches of `/admin/`, as intended.
2. **EMI in Admin:** see the CMS note in §3.
3. **Reference-video differences:**
   - The reference computes totals from the unrounded EMI. Its ₹1.60 Cr · 8% · 4 yr example shows interest ₹27,49,124; this page shows ₹27,49,136 (EMI ₹3,90,607 × 48 − principal), so the numbers on screen always add up.
   - The reference's enquiry form was not copied. The page ends with the site's existing call-to-action instead.
4. **Existing, not changed:** on phones the closed ☰ menu casts a faint shadow along the right screen edge. It is on every page, is identical in the base build, and was left alone.
