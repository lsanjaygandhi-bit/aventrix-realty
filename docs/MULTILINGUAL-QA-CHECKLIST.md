# Multilingual QA checklist

## Routing
- [ ] `/` stays English and loads as before.
- [ ] `/ta/`, `/hi/`, `/te/`, `/kn/`, `/ml/` serve the matching home page.
- [ ] Locale-prefixed nested pages resolve to the matching underlying page.
- [ ] Query strings and hash fragments survive language switching.
- [ ] Static images, stylesheets, scripts, PDFs and font URLs load.
- [ ] Property sharing URLs and crawler metadata remain valid.

## Preservation / regression
- [ ] Compare English desktop and mobile screenshots against baseline.
- [ ] Header and footer appearance unchanged except for the language selector.
- [ ] Property search and dynamic property detail content work.
- [ ] Forms, login, shortlist, wishlist, map and calculators still work.
- [ ] AI assistant language behaviour reviewed; current backend is not automatically multilingual.
- [ ] No price, address, property ID, legal reference or business rule is translated or changed.

## Browser-verified implementation batches
- Plot Area Calculator: English, Tamil, Hindi, Telugu, Kannada and Malayalam were
  checked for page heading, hero copy, shared navigation, rectangle input labels,
  shape help, validation errors, calculated
  area/method, drawing-preview title/close label and converter output. Dynamic
  shape selection and generated field labels were exercised; the Telugu version
  was checked across all 12 shape types at a 390px viewport. Tested fallback
  counter was `0` and no page errors were observed.
- This batch check is scoped to those controls and states. It does not mark the
  entire calculator page or website complete: generated print/download content,
  several export/share messages and legal/survey disclaimers still need work or
  human review.
- Joint Venture Feasibility Calculator: English, Tamil, Hindi, Telugu, Kannada
  and Malayalam were checked for the hero, stage heading, description, shared
  footer tagline, recommendation action, dynamic deposit treatment, ratio
  adjustment, scenario table generation and invalid-input status. Each locale
  reported zero missing translation keys; no browser page errors were observed.
  The proposal/PDF text and several commercial, regulatory and legal
  explanations remain English and need qualified human review; this is not a
  complete translation of the calculator page.
- JV Feasibility Guide: English, Tamil, Hindi, Telugu, Kannada and Malayalam
  were checked for the hero, calculator/checklist/enquiry cards, formula labels,
  professional-confirmation heading and footer description. Each locale
  reported zero missing translation keys. Detailed formulas, professional
  checklist statements and the model disclaimer remain English for qualified
  review of technical, regulatory, property and financial terminology. This
  page is only partially translated and is not marked complete.
- Property Checklists: English, Tamil, Hindi, Telugu, Kannada and Malayalam
  were checked for the hero, checklist type selector, generated checklist title,
  progress message, metadata-field labels/placeholders and legal caution notice.
  All five checklist types can be selected and their generated headings follow
  the active language; tested fallback count was zero. The actual due-diligence
  checklist items and the printable legal/technical disclaimer remain English
  pending qualified human translation/review, so this page is only partially
  translated.
- Property Valuation: English, Tamil, Hindi, Telugu, Kannada and Malayalam
  were checked for core form labels/options, result headings, dynamically
  generated rate basis/source, sample indicative values, and zero-area
  validation. The market-rate table loaded 21 published rows in the test
  environment; rates, locality names and amounts were unchanged. Each locale
  reported zero missing keys and there were no browser errors. Technical
  explanatory notes, market-rate caveats, publication dates and some secondary
  rate-table messages remain English and need content review; this page is
  partially translated, not complete.
- Commercial Investment Calculator: English, Tamil, Hindi, Telugu, Kannada and
  Malayalam were checked for inputs, calculation labels and formulas, sample
  annual NOI/payback/cash-on-cash outputs, over-100% vacancy validation,
  negative-NOI warning, and loan-payment cash-flow warning. The calculated
  numeric results stayed consistent across locales; each locale reported zero
  missing translation keys and there were no browser errors. The financial
  disclaimer wording is translated for usability but requires qualified human
  review. This does not mark the entire commercial investment page complete.
- Property Tools landing page: English, Tamil, Hindi, Telugu, Kannada and
  Malayalam were checked for the two-line hero, calculator and resource
  headings, all nine card titles/actions, Ramsar feature title/action and
  language fallback counter. Every card destination remained intact; all six
  locales had zero reported missing keys. Ramsar-specific explanatory/legal
  copy and remaining tool-page text are not fully translated or legally
  reviewed, so this page remains partial.
- Government Services directory: English, Tamil, Hindi, Telugu, Kannada and
  Malayalam were checked for the locale document language, page heading, portal
  description, legal caution, shared footer presence and navigation presence.
  The 19 Government Services dictionary keys have values for all six locales;
  the 27 marked page elements include the hero, breadcrumb, portal-card
  descriptions/actions, caution and shared header/footer labels. Official
  portal names, URLs and property/legal meaning were preserved. Government,
  land-record and legal terminology requires qualified human review; remaining
  unmarked page content and external portal pages are not covered, so this
  directory is only partially translated.
- Contact enquiry form: English, Tamil, Hindi, Telugu, Kannada and Malayalam
  were checked for full-name and phone labels, message placeholder, submit
  action, locale document language and the translated shared submission-error
  message. All 10 explicit form/error keys have values in every locale and the
  required-field flags remain intact. No live submission was performed; the
  form's headings, CMS-managed office content, native browser validation text,
  and static fallback office-map actions remain outside this batch. Contact
  page coverage is therefore partial.
- General property enquiry page: English, Tamil, Hindi, Telugu, Kannada and
  Malayalam were checked for the hero eyebrow/description/action, mobile and
  subject labels, submit action, required-field state and preservation of the
  submitted field names. Sixteen shared/enquiry keys have translations in all
  locales, with zero reported key fallbacks. The hero title and form heading
  are CMS-managed and were deliberately left as supplied rather than
  translating arbitrary CMS content; no live submission was performed.
  Native browser validation copy and the rest of the page are not covered, so
  this page remains partial.
- List With Us owner form: English, Tamil, Hindi, Telugu, Kannada and
  Malayalam were checked for owner/property form headings, translated
  property-type and status options, listing requirement, map hint, submit
  action, required-field state and preservation of all submitted field names.
  Select options retain their original English `value` payloads across
  locales. The 52 listing/map dictionary keys have values for all six locales
  and fallback count was zero. The location picker now resolves its search,
  selection, error and map-load status messages through the active locale;
  live geocoding, Google Maps API states and form submission were not exercised.
  CMS-managed benefits/process content and the rest of the page remain
  untranslated or unchecked, so this page is partial.
- Account authentication UI: English, Tamil, Hindi, Telugu, Kannada and
  Malayalam were checked for account heading, login/signup tabs, signup
  action, password guidance and the client-side password-mismatch message.
  Password mismatch was exercised without contacting the authentication
  backend. All 20 account keys have values in all six locales, with zero
  reported key fallbacks. Provider-generated authentication errors, the
  signed-in dashboard and account-data interactions remain outside this
  batch; no account was created or password changed.
- Wishlist and recently viewed: English, Tamil, Hindi, Telugu, Kannada and
  Malayalam were checked for both section headings, empty wishlist state,
  recently viewed cards from existing browser history, localized sale badges,
  save-heart accessible labels and card actions. Three recent property cards
  were rendered; their property titles, locations, measurements and prices
  remain unchanged. Dynamic translations wait for the dictionary-ready event
  before rendering localized labels, and all six locales reported zero
  fallback keys. Existing recent-view history was not cleared or modified.
  No property was added/removed from the wishlist, and no click-action flow was
  exercised.
- Shortlist and comparison: English, Tamil, Hindi, Telugu, Kannada and
  Malayalam were checked using two existing recently viewed property records
  temporarily loaded into the shortlist and removed after the browser check.
  Verified translated shortlist heading, selection labels/count buttons,
  comparison table UI labels, enquiry heading/selected-count summary, and
  preserved `Shortlisted Properties` submission field name. Both property
  cards and the compare table rendered in each locale, with zero fallback
  keys. Property titles, locations, listing data, and the hidden enquiry
  payload remained original property values; no enquiry was submitted.
  Other shortlist states and broader page copy remain unchecked, so this page
  remains partial.
- Services page: English, Tamil, Hindi, Telugu, Kannada and Malayalam were
  checked in the local browser for the hero title and description, portfolio
  heading, all seven service-card titles/descriptions and card actions. The
  document language matched the selected locale, all seven cards rendered, and
  the explicit translation fallback count was zero. CMS-managed custom copy is
  only translated when it exactly matches the known English source; customized
  service text and the rest of the page/footer were not reviewed. The page
  remains partial.
- About page: English, Tamil, Hindi, Telugu, Kannada and Malayalam were checked
  against all 73 marked About/shared-footer elements, including the hero,
  company overview, all six service cards, the legacy and leadership section
  headings, network description and tags, all five "Why Aventrix" points, final
  call-to-action and footer description. Every rendered element matched its
  locale dictionary value; document language matched selection and fallback
  count was zero. Service cards, eight network tags and five value points were
  present in every locale. CMS-customized text remains unchanged unless it
  matches the known English source. The legacy timeline narrative, leadership
  biographies, CMS-overridden legacy eyebrow and commitment statement remain
  English/unverified; user and biographical names and historical statements
  were not translated. This page remains partial.
- Our Realtors directory: English, Tamil, Hindi, Telugu, Kannada and Malayalam
  were checked for the hero eyebrow/title/description, each of three dynamic
  realtor-card profile actions and the shared footer description. All five
  dictionary keys matched in each locale, three cards rendered, and fallback
  count was zero. Realtor names, designations and short bios are data and
  remain unchanged; individual profile pages and the rest of the directory UI
  were not reviewed, so this page remains partial.
- Dynamic realtor profile: English, Tamil, Hindi, Telugu, Kannada and
  Malayalam were tested with both published profile IDs, covering seven
  explicit labels/actions, the shared footer description, the locale document
  language, and preservation of profile names, experience values and tag
  counts. Each profile rendered in all six locales with all seven checked keys
  matching and zero fallback keys. The not-found state and return link were
  also checked in all six languages. Names, designations, biographies,
  expertise/specialization terms, language lists, contact details and RERA
  facts remain profile data and were not translated; the profiles are partial.
- Dedicated founder profiles (`gnanasekaran.html`, `sanjay.html`): English,
  Tamil, Hindi, Telugu, Kannada and Malayalam were checked for each page's
  section headings, WhatsApp action, back link and shared footer description.
  Nine marked elements on Gnanasekaran's page and eight on Sanjay's page
  matched their dictionary values in every locale; both retained the correct
  profile name and reported zero fallbacks. Biography paragraphs,
  specializations, experience data, contact details, RERA registration and
  CMS-managed social/legacy content remain unchanged and unverified, so both
  pages remain partial.
- NRI services enquiry form: English, Tamil, Hindi, Telugu, Kannada and
  Malayalam were checked for 54 explicit localized labels, placeholders,
  option labels, consent/success copy and form headings. All rendered values
  matched their dictionaries with zero fallback keys. Form field `name`
  attributes, required-field flags and every select option `value` remained
  identical across all six locales; no submission was made. The form copy is
  checked only for translated output, not legal suitability; the wider NRI
  page sections, FAQ claims, CMS content and success/error backend flow remain
  unchecked, so the page remains partial.

## Translation coverage required before release
- [ ] All page headings and paragraphs across the 50 HTML files.
- [ ] CMS-driven property content and all property detail states.
- [ ] Form validation, success/error/loading/empty states.
- [ ] Calculator labels, output units, print/PDF and downloaded drawing labels.
- [ ] Land Knowledge Centre, privacy policy, terms and legal/regulatory pages.
- [ ] AI assistant prompts, suggestions and replies.
- [ ] `title`, description, Open Graph, canonical and reciprocal `hreflang`.
- [ ] Locale-aware sitemap.
- [ ] Human review of legal, land classification, RERA and financial terminology.

## Release rule
Do not merge/deploy until all boxes are checked and a fresh production backup is available.
