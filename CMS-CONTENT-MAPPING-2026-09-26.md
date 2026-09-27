# Aventrix Realty — CMS Content Mapping (2026-09-26)

Every piece of editable website content, where it appears and where it is edited. The static HTML in each page stays as the fallback: an Admin value only replaces the page's own text when it is not empty, so the site never goes blank if the database is unreachable.

## Global content (shown on many pages)

| Content | Appears on | Edited in Admin | Stored in |
|---|---|---|---|
| Homepage hero title, subtitle, tagline, tagline colour, background video | Homepage | Website Content → Homepage → Hero | `site_settings` |
| Homepage "Post Property" button, video poster image | Homepage | Website Content → Homepage → Hero | `pages` (home) |
| Header call button, WhatsApp float button, menu/footer WhatsApp link | every page | Site Settings → Contact (Primary Phone, WhatsApp) | `site_settings` |
| Footer tagline, description, copyright | every page | Site Settings → Footer | `site_settings` |
| Facebook, Instagram, LinkedIn, YouTube links (footer and mobile menu) | every page | Site Settings → Social Links | `site_settings` |
| RERA agent number | property pages, Quick View, Sanjay's profile | Site Settings → Contact | `site_settings` |
| Head Office name, address, phones, email, Google Maps link, footer map | footer on every page, mobile menu phones, Homepage Quick Enquiry, Contact quick contact | Office Locations → Head Office | `office_locations` |
| Office cards and maps | Homepage, Contact | Office Locations | `office_locations` |
| Property listings, Future Properties cards (the latest 20 Published, Featured first), similar properties | Homepage, Properties, property pages, Wishlist, Shortlist, Sitemap | Properties | `properties` |
| Testimonials (section hidden until one is Published) | Homepage | Testimonials | `testimonials` |
| Team cards; founder name, title, photo, intro, specialisations, contact, About, Experience, Expertise, Languages | Our Realtors, founder pages, realtor profile | Our Realtors / Leadership | `realtors` |
| Articles | Insights, article page, Sitemap | Insights | `insights` |
| Page SEO (title, description, keywords, sharing image) | each page | Website Content → page → SEO | `pages` |

Intentionally static (layout/navigation, not content): header menu, Explore Properties shortcut tiles, Recent Searches, the search form options (driven by the shared property taxonomy), form field labels, the footer "Branch Office: Adyar, Chennai" line, Wishlist/Shortlist/Account page headings.

## Page by page (Admin → Website Content)

Each bullet is one block on the page, in page order: the label shown in Admin, its internal key and what can be edited. Lists can have items added, removed and reordered.

### index.html — Admin → Website Content → Homepage

- **Hero:** title, subtitle, tagline, tagline colour and video (the `site_settings` record); "Post Property" button text and link, and the video poster image (the Homepage `pages` row).
- **SEO:** title, meta description, keywords, sharing image
- **Meet Our Leadership (founders)** `leadership-intro` — heading, html; list "leaders" (2 items: photo, name, label, role, bio, link_text, profile_link)
- **Future Properties (heading; cards are the latest 20 Published properties, Featured first — Admin → Properties)** `future-properties` — heading, subtitle, link_text, link
- **Property Categories** `property-categories` — eyebrow, heading; list "categories" (6 items: link, image, label)
- **What We Do (service cards)** `what-we-do` — eyebrow, heading; list "services" (6 items: link, icon, title, text, link_text)
- **Why Aventrix (6 points)** `why-us` — eyebrow, heading; list "points" (6 items: title, text)
- **Testimonials (heading; quotes come from Admin → Testimonials)** `testimonials-heading` — eyebrow, heading
- **Call to action band** `cta` — heading, html; list "buttons" (2 items: text, link)
- **Professional Fees teaser** `brokerage-teaser` — eyebrow, heading, text, link_text, link
- **Why Invest in Chennai** `why-invest` — eyebrow, heading, link_text, link; list "points" (3 items: title, text)
- **Frequently Asked Questions** `faq` — eyebrow, heading; list "faqs" (6 items: question, answer)
- **Office Locations (heading; offices come from Admin → Office Locations)** `office-intro` — eyebrow, heading, html
- **Quick Enquiry (intro text)** `quick-enquiry-intro` — eyebrow, heading, html

### about.html — Admin → Website Content → About Us

- **Hero:** eyebrow, title, subtitle
- **SEO:** title, meta description, keywords, sharing image
- **Brand statement** `about-statement` — heading, text
- **Who We Are** `who-we-are` — eyebrow, heading, image_url, text, text2; list "tags" (8 items: label)
- **Our Approach (4 cards)** `our-approach` — eyebrow, heading; list "items" (4 items: number, title, text)
- **Our Services (6 cards)** `about-services` — eyebrow, heading; list "items" (6 items: number, title, text)
- **Our Legacy — shown on About Us** `about-legacy` *(stored in the Homepage row)* — eyebrow, heading, subtitle, closing; list "timeline" (3 items: year, title, text)
- **Leadership heading (people are edited under Homepage → Meet Our Leadership)** `about-leadership` — eyebrow, heading
- **leadership-intro** `leadership-intro` *(stored in the Homepage row)* — —; list "leaders" (2 items: photo, name, label, role, bio, link_text, profile_link)
- **Our Network** `about-network` — eyebrow, heading, text, link_text, link; list "tags" (8 items: label)
- **Why Aventrix (5 points)** `about-why` — eyebrow, heading; list "points" (5 items: number, title, text)
- **Commitment statement** `about-declaration` — eyebrow, heading
- **Closing call to action** `final-cta` — heading, text; list "buttons" (2 items: text, link)

### services.html — Admin → Website Content → Services

- **Hero:** eyebrow, title, subtitle
- **SEO:** title, meta description, keywords, sharing image
- **Services (7 cards)** `services-list` — eyebrow, heading; list "services" (7 items: title, text, link_text, link)

### properties.html — Admin → Website Content → Properties (search page header)

- **Hero:** eyebrow, title, subtitle
- **SEO:** title, meta description, keywords, sharing image

### list-with-us.html — Admin → Website Content → List With Us

- **Hero:** eyebrow, title, subtitle, button text, button link
- **SEO:** title, meta description, keywords, sharing image
- **Why list with Aventrix (4 cards)** `why-list` — eyebrow, heading; list "items" (4 items: number, title, text)
- **What you gain (6)** `owner-benefits` — eyebrow, heading; list "items" (6 items: title, text)
- **Listing form (heading and intro)** `form-intro` — heading, text
- **Property types we handle (6)** `property-types` — eyebrow, heading; list "items" (6 items: title, text)
- **Why owners work with us (6 cards)** `why-owners` — eyebrow, heading; list "items" (6 items: number, title, text)
- **Listing process (5 steps)** `listing-process` — eyebrow, heading; list "items" (5 items: number, title, text)
- **Common situations (6)** `situations` — eyebrow, heading; list "items" (6 items: title, text)
- **Owner FAQs (7)** `owner-faq` — eyebrow, heading; list "faqs" (7 items: question, answer)
- **Closing call to action** `final-cta` — heading, text, button_text, link

### free-valuation.html — Admin → Website Content → Free Property Valuation

- **Hero:** eyebrow, title, subtitle, button text, button link
- **SEO:** title, meta description, keywords, sharing image
- **Why choose a valuation (4 cards)** `why-valuation` — eyebrow, heading; list "items" (4 items: number, title, text)
- **What a valuation helps you understand (6)** `valuation-benefits` — eyebrow, heading; list "items" (6 items: title, text)
- **Valuation form (heading and intro)** `form-intro` — heading, text
- **What your valuation includes (5 cards)** `valuation-includes` — eyebrow, heading; list "items" (5 items: number, title, text)
- **Our valuation process (4 steps)** `valuation-process` — eyebrow, heading; list "items" (4 items: number, title, text)
- **Who is this for** `who-for` — eyebrow, heading; list "tags" (7 items: label)
- **Closing call to action** `final-cta` — heading, text, button_text, link

### joint-venture.html — Admin → Website Content → Joint Venture

- **Hero:** eyebrow, title, subtitle, button text, button link
- **SEO:** title, meta description, keywords, sharing image
- **What is a Joint Venture** `what-is-jv` — eyebrow, heading, lead, text; list "flow" (6 items: title, note)
- **Why consider a Joint Venture** `why-jv` — eyebrow, heading, lead, note, list_label; list "benefits" (7 items: text)
- **Your land, your structure (6 options)** `structures` — eyebrow, heading, subhead, intro, footnote; list "options" (6 items: letter, title, text)
- **What Aventrix Realty does (9 roles)** `our-role` — eyebrow, heading, intro, disclaimer; list "roles" (9 items: number, title, text)
- **What the development partner may bring** `development-partner` — eyebrow, heading, intro, owner_label, partner_label; list "owner_contributes" (4 items: text); list "partner_brings" (11 items: text)
- **Commercial structures (4) and factors** `commercial-structures` — eyebrow, heading, intro, factors_label, note; list "structures" (4 items: letter, title, text); list "factors" (11 items: text)
- **Before you agree (15 points)** `before-you-agree` — eyebrow, heading, quote, list_label; list "points" (15 items: text)
- **We start with your objective (8)** `your-objective` — eyebrow, heading, intro; list "objectives" (8 items: title, text)
- **Multiple owners / Due diligence** `ownership-and-verification` — disclaimer; list "panels" (2 items: eyebrow, title, text, points)
- **From land to development (9 steps)** `jv-process` — eyebrow, heading, intro; list "steps" (9 items: number, title)
- **Alignment before agreement** `alignment` — eyebrow, heading, intro, result; list "elements" (6 items: label, value)
- **Why Aventrix Realty (6 principles)** `why-aventrix` — eyebrow, heading, intro; list "principles" (6 items: title, text)
- **Who can approach us** `who-can-approach` — eyebrow, heading, intro, note; list "owners" (8 items: text)
- **Joint Venture FAQs (10)** `jv-faq` — eyebrow, heading; list "faqs" (10 items: question, answer)
- **Closing call to action** `final-cta` — heading, text; list "buttons" (2 items: text, link)
- **Enquiry form (heading and intro)** `form-intro` — heading, text

### nri-services.html — Admin → Website Content → NRI Services

- **Hero:** eyebrow, title, subtitle, button text, button link
- **SEO:** title, meta description, keywords, sharing image
- **Local support while overseas (5)** `local-support` — eyebrow, heading; list "items" (5 items: title, text)
- **How Aventrix helps NRIs (6 cards)** `how-we-help` — eyebrow, heading; list "items" (6 items: number, title, text)
- **Enquiry form (heading and intro)** `form-intro` — heading, text
- **Property categories we assist with** `categories` — eyebrow, heading; list "tags" (6 items: label)
- **Why NRIs choose local support (5)** `why-local` — eyebrow, heading; list "items" (5 items: title, text)
- **Getting started (5 steps)** `getting-started` — eyebrow, heading; list "items" (5 items: number, title, text)
- **NRI FAQs (6)** `nri-faq` — eyebrow, heading; list "faqs" (6 items: question, answer)
- **Closing call to action** `final-cta` — heading, text, button_text, link

### brokerage-fees.html — Admin → Website Content → Professional Fees

- **Hero:** eyebrow, title, subtitle
- **SEO:** title, meta description, keywords, sharing image
- **Every assignment is different** `fees-intro` — eyebrow, heading, lead, text
- **What shapes the fee (5 cards)** `fees-factors` — eyebrow, heading; list "items" (5 items: number, title, text)
- **Our real estate services (7 rows)** `fees-services` — eyebrow, heading, note; list "services" (7 items: title, text)
- **How we agree your fee (4 steps)** `fees-process` — eyebrow, heading, text; list "steps" (4 items: number, title, text)
- **Our commitment (4 points)** `fees-commitment` — eyebrow, heading; list "points" (4 items: title, text)
- **Taxes & invoicing / Clear terms** `fees-terms` — —; list "panels" (2 items: title, text)
- **Closing call to action** `final-cta` — heading, text; list "buttons" (2 items: text, link)

### our-realtors.html — Admin → Website Content → Our Realtors (page intro)

- **Hero:** eyebrow, title, subtitle
- **SEO:** title, meta description, keywords, sharing image

### gnanasekaran.html — Admin → Website Content → Founder profile — Gnanasekaran P

- **SEO:** title, meta description, keywords, sharing image
- **Legacy paragraph on this profile page** `profile-legacy` — heading, text

### sanjay.html — Admin → Website Content → Co-Founder profile — Sanjay Gandhi L

- **SEO:** title, meta description, keywords, sharing image
- **Legacy paragraph on this profile page** `profile-legacy` — heading, text
- **Personal social links on this profile page** `profile-social` — heading; list "links" (4 items: link, label)

### insights.html — Admin → Website Content → Insights (page intro)

- **Hero:** eyebrow, title, subtitle
- **SEO:** title, meta description, keywords, sharing image

### contact.html — Admin → Website Content → Contact

- **Hero:** eyebrow, title, subtitle
- **SEO:** title, meta description, keywords, sharing image
- **Our Offices (heading; offices come from Admin → Office Locations)** `offices-intro` — eyebrow, heading, html
- **Enquiry form (heading and intro)** `contact-form-intro` — heading, text
- **Locate Our Offices (maps come from Admin → Office Locations)** `offices-heading` — eyebrow, heading
- **Business hours & quick contact (phone/email come from the Head Office)** `contact-hours` — hours_title, contact_title; list "hours" (2 items: day, time)

### enquiry.html — Admin → Website Content → Property Enquiry

- **Hero:** eyebrow, title, subtitle, button text, button link
- **SEO:** title, meta description, keywords, sharing image
- **Enquiry form (heading and intro)** `form-intro` — heading, text

### privacy-policy.html — Admin → Website Content → Privacy Policy

- **Hero:** eyebrow, title, subtitle
- **SEO:** title, meta description, keywords, sharing image
- **Privacy Policy text** `policy` — html

### terms.html — Admin → Website Content → Terms & Conditions

- **Hero:** eyebrow, title, subtitle
- **SEO:** title, meta description, keywords, sharing image
- **Terms & Conditions text** `terms` — html

### sitemap.html — Admin → Website Content → Sitemap (page intro)

- **Hero:** eyebrow, title, subtitle
- **SEO:** title, meta description, keywords, sharing image