# Tamil Nadu Land Knowledge Centre

Integrated into the existing Aventrix Realty static site at `/land-knowledge/`.

- English-only first release.
- Shared site header/footer copied from `government-services.html` without modifying their markup.
- Page styles: `css/land-knowledge.css` (scoped to `.lk-page`).
- Interactions: `js/land-knowledge.js`.
- Local illustrations: `images/land-knowledge/`.
- Source/legal review: `docs/LAND-KNOWLEDGE-SOURCE-AUDIT.md`.

Open the root project in VS Code and run the existing local server from the project root. Browse to `/land-knowledge/`. Do not publish until the legal-source audit blockers are cleared.


## Hero background (source asset)
The hero section uses `/images/land-knowledge/hero-government-background.svg`, a locally bundled vector background showing a generic public-office silhouette, historic land registers and cadastral boundaries. It is illustrative only and does not use an official government seal or imply government endorsement. CSS applies a dark gradient overlay to preserve text contrast.
