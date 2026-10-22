# Aventrix Realty Multilingual Website — Implementation Guardrails

## Approved scope
Implement a complete six-language version of the existing Aventrix Realty website:
- English (default)
- Tamil (`ta`)
- Hindi (`hi`)
- Telugu (`te`)
- Kannada (`kn`)
- Malayalam (`ml`)

## Non-negotiable preservation rules
1. Do not redesign, rearrange, or restyle existing pages.
2. Preserve the existing header and footer markup and appearance. The only permitted header addition is a compact language selector, positioned to minimise layout impact.
3. Preserve existing English content and its meaning. Other locales must be translations of the same content, not rewritten or shortened alternatives.
4. Preserve all property data, prices, business rules, routes, forms, calculators, search, authentication, AI assistant behaviour, and existing integrations.
5. Do not duplicate property records by language. Property data stays canonical; translated presentation content is locale-specific.
6. Do not use a blanket browser translation overlay as the implementation.
7. Do not deploy until all pages/locales have been translated and regression-tested.

## Recommended URL model
- English: existing URLs remain unchanged.
- Tamil: `/ta/<existing-path>`
- Hindi: `/hi/<existing-path>`
- Telugu: `/te/<existing-path>`
- Kannada: `/kn/<existing-path>`
- Malayalam: `/ml/<existing-path>`

The Worker must resolve locale-prefixed requests to the existing underlying asset without changing the visible path. Root and directory index handling, query strings, hash links, property share URLs, and static asset URLs must be tested before release.

## Translation coverage
Every user-visible string must be inventoried, including:
- All HTML pages, headings, paragraphs, navigation, buttons, forms, validation/errors, dialogs and notices
- Property search, property detail templates, CMS-driven property fields and property actions
- Calculators, filters, sorting, empty/loading/error states
- Land Knowledge Centre and legal/regulatory content
- AI assistant launcher, panel, suggestions, prompts and replies
- SEO title/description, Open Graph metadata, canonical/hreflang and sitemap entries
- Accessible names, labels, alt text and document language attributes

## Release gates
- English routes remain byte-for-byte unchanged wherever possible.
- Every locale route resolves to the corresponding page, not the homepage or a 404.
- Language switching retains the equivalent page and query parameters where meaningful.
- No language selector or translation styles disturb existing responsive layout.
- Verify desktop, tablet and mobile; links, forms, calculators, property search, login and AI assistant.
- Legal/land/RERA translations receive human review.
- Add canonical and reciprocal hreflang only after each translated page exists.
- No production deployment until the user-visible translations are complete and the regression checks pass.

## Current status
Planning branch created from `main`. No production website files, layout, header, footer, or live deployment have been changed by this planning document.
