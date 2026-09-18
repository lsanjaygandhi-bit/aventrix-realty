# Aventrix Realty — Phase 1 SEO Implementation

Technical SEO foundation only. No redesign, no removed functionality, no
Supabase schema changes (none were needed — see below), no fake content,
no thin/duplicate pages. Map search, AI assistant, CRM, saved-search
alerts and market intelligence are explicitly deferred to later phases.

## New files
- `robots.txt` — allows all crawlers, disallows `/admin/`, `/account.html`,
  `/wishlist.html`, `/shortlist.html`; points to the sitemap.
- `sitemap.xml` — every static page plus all 22 currently published
  property URLs (slug-based). This is a snapshot as of implementation
  time — see "Known limitation" below.

## Modified files
**index.html** — meta description, canonical URL, Open Graph/Twitter
tags, `RealEstateAgent` + `WebSite` + `FAQPage` JSON-LD structured data
(the FAQ schema wraps the existing homepage FAQ content verbatim — no
new claims). Fixed a pre-existing broken `action` attribute on the Quick
Enquiry form (`action=" method="POST"` → `action="" method="POST"`).

**properties.html, contact.html, free-valuation.html, brokerage-fees.html,
joint-venture.html, nri-services.html, list-with-us.html,
our-realtors.html, insights.html, sanjay.html, gnanasekaran.html** —
canonical URL, meta description (only where missing), Open Graph/Twitter
tags, `WebPage` + `BreadcrumbList` JSON-LD.

**privacy-policy.html, realtor-profile.html, property.html** — canonical
URL and Open Graph/Twitter tags (static fallback; property.html's real
per-property tags come from the JS engine below).

**account.html, wishlist.html, shortlist.html** — `<meta name="robots"
content="noindex, follow">` plus canonical. These are personal/utility
pages and are correctly kept out of search results rather than given
full SEO treatment.

**contact.html, joint-venture.html, free-valuation.html,
list-with-us.html, nri-services.html, enquiry.html** — fixed the same
broken form `action` attribute bug found on the homepage.

**insights.html** — added `loading="lazy"` to the 6 article thumbnail
images that were missing it.

**js/public-properties.js** — the core of this phase. Every property
page (`property.html?id=<slug>`) now gets, generated live from the
actual Supabase record:
- Dynamic `<title>` and meta description (falls back to the property's
  own title/short_description when `seo_title`/`seo_description` are
  empty, so no property ever ships a blank tag)
- A canonical URL matching its own slug
- Open Graph + Twitter Card tags, including the property's real image
- `RealEstateListing` JSON-LD — only includes `image`, `address`,
  `offers.price`, and `numberOfRooms` when the record actually has
  that data; nothing is invented
- `BreadcrumbList` JSON-LD: Home → Properties → [Category] → this
  property

This means all 22 current (and every future) published property gets
this treatment automatically — no per-property manual work.

## Explicitly not touched
- `style.css` — byte-identical, confirmed
- Supabase schema — no changes made or needed. The `properties` table
  already has `slug`, `seo_title`, `seo_description`, `seo_keywords`
  columns, already populated for most listings.
- Admin panel, CMS modules, wishlist/shortlist logic, buyer accounts,
  Cloudflare deploy config — untouched.

## Known limitation
`sitemap.xml` is a static snapshot of the 22 properties published at
generation time. It will not automatically pick up new properties added
through the CMS afterward. Automating sitemap regeneration (e.g. via a
Cloudflare Worker on publish) is a good Phase 2 candidate — flagged in
the roadmap doc, not built here since it would mean new backend
infrastructure beyond "technical SEO foundation."
