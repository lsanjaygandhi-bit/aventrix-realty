# Land Knowledge Centre — Source and Legal Audit (Internal)

Status: **Draft for verification; not a legal opinion and not yet approved for public release.**

## Current implementation
- Route: `/land-knowledge/` (static directory index).
- English-only initial release.
- Existing shared header and footer markup copied from `government-services.html`; neither was edited in that existing page.
- Page-specific styles are in `css/land-knowledge.css` and are scoped to `.lk-page`.
- Interactions are local to `js/land-knowledge.js`.
- Original local SVG illustrations are in `images/land-knowledge/`.

## Primary official portals linked in the page
1. Tamil Nadu land e-Services: https://eservices.tn.gov.in/eservicesnew/index.html
2. National Government Services Portal description of Tamil Nadu land records: https://services.india.gov.in/service/detail/e-services-of-land-records-tamil-nadu
3. TNREGINET: https://tnreginet.gov.in/portal/
4. CMDA: https://www.cmdachennai.gov.in/
5. Directorate of Town and Country Planning: https://tcp.tn.gov.in/ (verify live route and authority scope before release).

## Historical timeline — content improved, primary-source audit still open
The first build's history section was too compressed: it used broad labels such as “Pre-Independence” and did not explain the British-era origin of survey/settlement records in a reader-friendly way. The revised page now has a chronological explanation covering:
- Early/mid-19th-century Madras Presidency survey and ryotwari revenue settlement (with a caution that dates and operations varied by district).
- The 1871 revenue glossary definition of “natham” as a village dwelling site; distinctions among ryotwari, zamindari and inam tenure.
- The 1905 Land Encroachment Act context.
- Post-1947 estate/inam abolition, ryotwari settlement and land reforms.
- The separate 1971 planning-law framework.
- UDR (commonly cited 1979–1987) versus Natham survey/settlement (1987–1988 orders).
- Later maintenance/digitisation, 2021–2025 Natham administration and the 6 March 2026 Full Bench ruling.

Useful references discovered in the audit:
- LBSNAA / Centre of Excellence for Rural Studies, compiled land-acts training material: https://www.lbsnaa.gov.in/pdfs/1745919112_Compiled%20Document%20of%20Land%20Module%20based%20on%20Cadre-wise%20PPT%20on%20Relevant%20Land%20Acts.pdf (secondary training reference; describes UDR as 1979–1987 and record purposes).
- Madras High Court Full Bench judgment copy, *Nallasivam v. District Collector*, pronounced 6 March 2026: https://indiankanoon.org/doc/144948700/ (court-originated text mirrored by a secondary legal site; the judgment itself shows the Madras High Court Judis URL and upload date 10 March 2026).
- India Code notification extract discussing settlement under G.O. 1971: https://upload.indiacode.nic.in/showfile?actid=AC_TN_85_693_00005_00005_1688556998148&filename=25_ii_2.pdf&type=notification (official repository, but the exact instrument and scope must be matched to the relevant land).

These sources support a more explicit educational timeline, but do not close the requirement to inspect every complete original order and current official court status.

## Court decision requiring current legal review
- *Nallasivam v. The District Collector*, Madras High Court Full Bench, 6 March 2026. Search/case copy: https://indiankanoon.org/doc/144948700/
- The reported majority answer says occupied Grama Natham lands do not vest with Government and the Tamil Nadu Land Encroachment Act, 1905 cannot be invoked in respect of occupied Grama Natham lands. Do not generalise this to every natham parcel, vacant site, classification, ownership dispute or statutory context.
- **Before public launch:** retrieve the official Madras High Court judgment PDF from https://www.mhc.tn.gov.in/judis; confirm the majority ratio, operative order, later judgments, review/appeal/SLP/stay status from official court records. This package does not claim that the current appeal status has been exhaustively verified.

## Government Orders / records to verify from complete official texts
- G.O. Ms. No. 525, Revenue Department, 16 May 1979 — UDR / Updating of Registry: verify title, objective, statewide scope, start and completion dates, circulars and exceptions.
- G.O. Ms. No. 1177, Commercial Taxes and Religious Endowments Department, 30 October 1987 — Natham survey/settlement: obtain full text and annexures.
- G.O. Ms. No. 1971, Revenue Department, 14 October 1988 — natham settlement and ground-rent instructions: obtain full text and annexures.
- G.O. Ms. No. 454, 13 May 1996 — cited in the Full Bench judgment as withdrawing the Natham ground-rent levy; verify original department and full official text.
- G.O. Ms. No. 233, 5 February 2021; G.O. Ms. No. 221, 4 May 2023; G.O. Ms. No. 869, 30 September 2023 — cited in the Full Bench judgment in connection with held-over Natham cases, classification/record terminology and later scheme directions; obtain and compare the full official texts and annexures.
- G.O. Ms. No. 221, Revenue and Disaster Management Department, 4 May 2023 — natham record terminology/classification: verify full text and exact effects.
- G.O. Ms. No. 105, Revenue and Disaster Management Department, 13 March 2024 — natham record terminology/classification: verify full text and exact effects.
- Tamil Nadu Town and Country Planning Act, 1971; original commencement notification and current amendments/rules.
- Tamil Nadu Estates (Abolition and Conversion into Ryotwari) Act, 1948; relevant commencement and settlement provisions.
- Tamil Nadu land ceiling legislation and relevant Inam Abolition Acts, only where relevant to a specific tenure/parcel.
- Land-record computerisation timeline: reconcile departmental annual reports, NIC/TamilNilam documentation and CAG Performance Audit on Land Records Management in Tamil Nadu (Report No. 3 of 2022). Avoid a single statewide start date unless a primary source establishes it.

## Editorial safeguards
- Classification labels listed on this page are illustrative and commonly encountered, not a complete official statewide taxonomy.
- Patta/Chitta/A-Register/Adangal/FMB/TSLR/EC are not interchangeable and no single extract is represented as conclusive title.
- Nanjai/Punjai labels do not by themselves authorise conversion or development.
- CMDA/DTCP planning permission and title/revenue records are separate checks; competent authority depends on jurisdiction.
- Do not say that any parcel is saleable, eligible for patta, buildable, private, government-owned or free from encroachment based only on a label or online extract.
- The 2026 decision must be read with later judgments and the actual facts of each case.

## Search references used during build (secondary index pages; verify primary sources)
- National Government Services Portal, Tamil Nadu land records: https://services.india.gov.in/service/detail/e-services-of-land-records-tamil-nadu
- Madras High Court judgment copy/search: https://indiankanoon.org/doc/144948700/
- CAG Performance Audit on Land Records Management in Tamil Nadu: https://saiindia.gov.in/uploads/download_audit_report/2021/Report-No.-3-of-2022--Government-of-Tamil-Nadu-068b150ce6f1520.63784397.pdf

## Pre-publication blockers
- [ ] Official PDF of the 2026 Full Bench decision and current appellate status checked.
- [ ] Full official texts of all listed GOs obtained and quoted accurately.
- [ ] CMDA / DTCP jurisdiction statements checked against current official maps/notifications.
- [ ] Computerisation timeline checked against primary sources.
- [ ] Legal professional review of the Natham/poramboke section.
- [ ] Browser/mobile accessibility and visual QA.
