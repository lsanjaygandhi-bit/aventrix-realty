# Aventrix Published Rates — research, methodology & test report (14 Oct 2026)

## What was wrong
The message "No verified rates have been published yet" was **not** a code fault: `data/market-rates.json` was shipped deliberately empty (no sourced data had been supplied), and the loader was working. The published-rate option also needed a manual click, showed no low/mid/high breakdown and matched locality names exactly as typed. Fixed:

| # | Bug / gap | Fix |
|---|---|---|
| 1 | Empty dataset | Researched dataset: 31 locality/type rows, 72 source observations, 21 published |
| 2 | Visitor had to pick the published rate by hand | Published rate is selected automatically when one exists for the locality + type; visitor can still switch to their own rate (and the choice sticks while they edit) |
| 3 | Exact-text locality match ("T Nagar" ≠ "T. Nagar") | Matching ignores case, spaces and punctuation and checks each row's aliases — still exact per locality, never a neighbouring one |
| 4 | No publication control | Rows carry `status`; only `published` rows are used; single-source rows are `draft` |
| 5 | No midpoint, no low/high value rows, no source in result | Result shows low / midpoint / high values, effective rate, basis, source count and check date; the rate panel lists every source with link, period and check date |
| 6 | Carpet vs super built-up mixing | Published apartment rates are flagged as super built-up; if the visitor picks carpet or built-up the result says so and that no conversion was applied |
| 7 | Locality suggestions hard-coded | Suggestions now come from the dataset |
| 8 | Load failure / bad JSON | Clear error, manual rate still works, table shows the failure |

## Sources checked (14 Oct 2026)
| Source | Access | Used for | What the figure is |
|---|---|---|---|
| Square Yards locality pages (`squareyards.com/property-rates/<locality>-chennai`) | 16 of 23 localities returned a rate; Velachery, Selaiyur and T. Nagar pages failed to load; no ECR or OMR page found; the Neelankarai page has no rate | Apartment average | "Asking Sale Price", period Jun–Sep 2026 per page. Pages contain internal inconsistencies (zero values in trend tables, conflicting dates) — headline apartment figure used |
| Housing.com city table + ECR page | Opened | Apartment average (Adyar, Chromepet, Madipakkam, Anna Nagar, ECR, Neelankarai) | Average of listings for sale; title "2026", no month; ECR page shows two conflicting averages |
| HomeBazaar "Property Rates in Chennai" | Opened (modified 22 May 2026) | Apartment average | Single average; source not stated |
| NoBroker "Property Rates in Chennai" | Opened (updated 7 Apr 2026) | Apartment + plot ranges | 2026 ranges; source not stated; some printed typos (Madipakkam plot excluded) |
| LiveHomes (developer) blogs | Opened (29 May 2026; 11 Apr 2026) | Apartment + land ranges | No source/method stated; counted as one publisher |
| Magicbricks | **Blocked** | — | — |
| 99acres | **Could not be retrieved** | — | — |
| Commercial sale rates | No per-locality source found | — | Only office rents (not usable for sale value) |

No government guideline values or registered-transaction data are in the dataset. Every row is labelled **online asking price**.

## Methodology
1. One value per publisher: a stated average as-is; a stated range → its midpoint.
2. Published **low** = lowest publisher value, **high** = highest, **mid** = (low + high) ÷ 2 — i.e. the spread between sources, not a min/max of transactions.
3. **Published** only with ≥ 2 independent publishers; otherwise **draft** (never shown as an Aventrix rate).
4. **Confidence:** medium = ≥ 3 publishers incl. a dated portal locality page and sources within 35%; otherwise low. No row is rated high.
5. Apartment figures are portal listing rates, normally quoted on super built-up area. Land is per sq.ft of plot; per ground = × 2,400.

## Published — apartments (per sq.ft, asking)
| Locality | Range | Mid | Sources | Confidence | Publishers |
|---|---|---|---|---|---|
| Adyar | ₹17,000 – ₹19,850 | ₹18,425 | 5 | medium | HomeBazaar, Housing.com, LiveHomes, NoBroker, Square Yards |
| Besant Nagar | ₹19,000 – ₹20,900 | ₹19,950 | 3 | medium | HomeBazaar, NoBroker, Square Yards |
| Thiruvanmiyur | ₹12,500 – ₹14,500 | ₹13,500 | 2 | low | HomeBazaar, Square Yards |
| Velachery | ₹9,400 – ₹11,250 | ₹10,325 | 3 | low | HomeBazaar, LiveHomes, NoBroker |
| Perungudi | ₹11,050 – ₹11,050 | ₹11,050 | 2 | low | HomeBazaar, Square Yards |
| Thoraipakkam | ₹9,250 – ₹10,050 | ₹9,650 | 3 | medium | HomeBazaar, NoBroker, Square Yards |
| Pallikaranai | ₹7,550 – ₹8,450 | ₹8,000 | 2 | low | HomeBazaar, Square Yards |
| Madipakkam | ₹6,500 – ₹8,163 | ₹7,332 | 4 | medium | HomeBazaar, Housing.com, NoBroker, Square Yards |
| Chromepet | ₹7,300 – ₹8,261 | ₹7,780 | 3 | medium | HomeBazaar, Housing.com, Square Yards |
| Tambaram | ₹5,800 – ₹6,900 | ₹6,350 | 3 | medium | HomeBazaar, LiveHomes, Square Yards |
| Medavakkam | ₹6,000 – ₹8,165 | ₹7,082 | 3 | low | HomeBazaar, LiveHomes, Square Yards |
| Pallavaram | ₹7,300 – ₹10,800 | ₹9,050 | 3 | low | HomeBazaar, LiveHomes, Square Yards |
| Sholinganallur | ₹7,600 – ₹9,950 | ₹8,775 | 4 | medium | HomeBazaar, LiveHomes, NoBroker, Square Yards |
| ECR | ₹9,375 – ₹13,719 | ₹11,547 | 2 | low | Housing.com, LiveHomes |
| Perumbakkam | ₹6,200 – ₹6,300 | ₹6,250 | 2 | low | HomeBazaar, Square Yards |
| Porur | ₹7,750 – ₹9,250 | ₹8,500 | 4 | medium | HomeBazaar, LiveHomes, NoBroker, Square Yards |
| Anna Nagar | ₹14,600 – ₹17,930 | ₹16,265 | 5 | medium | HomeBazaar, Housing.com, LiveHomes, NoBroker, Square Yards |
| T. Nagar | ₹16,500 – ₹19,950 | ₹18,225 | 2 | low | HomeBazaar, LiveHomes |
| Nungambakkam | ₹15,750 – ₹21,550 | ₹18,650 | 3 | low | HomeBazaar, LiveHomes, Square Yards |

## Published — residential land (per sq.ft, asking)
| Locality | Range | Mid | Sources | Confidence | Publishers |
|---|---|---|---|---|---|
| Adyar | ₹24,000 – ₹31,750 | ₹27,875 | 2 | low | LiveHomes, NoBroker |
| Anna Nagar | ₹29,500 – ₹29,575 | ₹29,538 | 2 | low | LiveHomes, NoBroker |

Anna Nagar land shows a narrow ₹29,500 – ₹29,575 because both sources report nearly the same **midpoint**; their published ranges are wide (₹24,250 – ₹34,900), which the source list shows.

## Draft — one source only (not shown to visitors until reviewed)
| Locality | Type | Figure |
|---|---|---|
| Selaiyur | apartment | ₹6,600/sq.ft (average) (HomeBazaar) |
| Neelankarai | apartment | Neelankarai sub-locality rows on the ECR page: ₹13,026 / ₹13,742 / ₹13,985 (8–23 listings each) (Housing.com) |
| OMR | apartment | OMR (Perungudi–Sholinganallur): ₹6,500 – ₹9,500/sq.ft — the 11 Apr 2026 LiveHomes article gives ₹12,000 – ₹13,000 for OMR (LiveHomes) |
| Guindy | apartment | Asking Sale Price ₹15,650/sq.ft (apartment) — based on 7 projects (Square Yards) |
| Besant Nagar | land | Plot 2026: ₹25,000 – ₹35,000/sq.ft (NoBroker) |
| Velachery | land | Plot 2026: ₹11,500 – ₹13,550/sq.ft (NoBroker) |
| Sholinganallur | land | Plot 2026: ₹10,500 – ₹13,000/sq.ft (NoBroker) |
| Thoraipakkam | land | Plot 2026: ₹8,000 – ₹12,045/sq.ft (NoBroker) |
| ECR | land | Land: ₹2,850 – ₹10,550/sq.ft (LiveHomes) |
| Tambaram | land | Land: ₹3,000 – ₹6,500/sq.ft (LiveHomes) |

## Coverage of the requested localities
| Locality | Apartment | Land | Commercial |
|---|---|---|---|
| Adyar | ✅ published | ✅ published | — no source |
| Besant Nagar | ✅ published | draft (1 source) | — no source |
| Thiruvanmiyur | ✅ published | — no source | — no source |
| Velachery | ✅ published | draft (1 source) | — no source |
| Perungudi | ✅ published | — no source | — no source |
| Thoraipakkam | ✅ published | draft (1 source) | — no source |
| Pallikaranai | ✅ published | — no source | — no source |
| Madipakkam | ✅ published | — no source | — no source |
| Chromepet | ✅ published | — no source | — no source |
| Tambaram | ✅ published | draft (1 source) | — no source |
| Selaiyur | draft (1 source) | — no source | — no source |
| Medavakkam | ✅ published | — no source | — no source |
| Pallavaram | ✅ published | — no source | — no source |
| Sholinganallur | ✅ published | draft (1 source) | — no source |
| ECR | ✅ published | draft (1 source) | — no source |
| Neelankarai | draft (1 source) | — no source | — no source |
| Perumbakkam | ✅ published | — no source | — no source |
| OMR | draft (1 source) | — no source | — no source |
| Porur | ✅ published | — no source | — no source |
| Guindy | draft (1 source) | — no source | — no source |
| Anna Nagar | ✅ published | ✅ published | — no source |
| T. Nagar | ✅ published | — no source | — no source |
| Nungambakkam | ✅ published | — no source | — no source |

**Not available at all:** land for 14 of the 23 localities and commercial for all 23 (no usable source found).

## Limitations
- All figures are asking prices from portal / developer publications. Several sources do not state how they compute their figures; Square Yards pages contain internal inconsistencies. Treat every rate as a broad indication.
- Some disagreements are large (e.g. Pallavaram: Square Yards ₹10,800 vs others ~₹7,300–7,650; Nungambakkam ₹15,750 – ₹21,550). The range shows the disagreement rather than hiding it.
- ECR and OMR are corridors, not localities; rates vary widely along them.
- The dataset was compiled by automated research and **needs your review** before you call it an Aventrix-approved rate. Withdraw any row by setting `status` to `draft`.
- Re-check sources at least quarterly and update `last_checked`.

## Admin management
The site has a Supabase admin panel, but adding a table means a schema change, which needs your approval. So: the dataset is a static JSON file with a documented update process (`README-PROPERTY-INTELLIGENCE.md`), and `sql/proposal-2026-10-14-market-rates-NOT-APPLIED.sql` is ready for when you want Admin-managed rates (existing `publish_status` + `is_admin()` RLS pattern, 2-source check, no service-role key in the browser). Nothing was run against Supabase.

## Test report
Run in headless Chromium at 1280×800 (desktop) and 390×844 (touch, iPhone user agent), against the real dataset.
**68 / 68 checks passed.**

| Case | Result |
|---|---|
| Locality with published apartment rate (Chromepet 1,200 sq.ft → ₹87.60 L – ₹99.13 L, mid ₹93.37 L) | Pass |
| Result changes when locality changes (Chromepet → Adyar) | Pass |
| Locality with published land rate (Anna Nagar, 1 ground) | Pass |
| Apartment rate but no land rate (Chromepet land → "Rate not yet available…", no substitution) | Pass |
| Locality with no rate (Kodambakkam), draft-only locality (Selaiyur), commercial (Adyar) | Pass |
| Alias match ("t nagar" → T. Nagar) | Pass |
| Manual reference rate per sq.ft and per ground | Pass |
| Area units sq.ft / ground / cent | Pass |
| Invalid & empty: negative area, empty area, negative rate, high < low (swapped with notice) | Pass |
| Brief's example ₹8,000 – ₹9,000 × 1,200 sq.ft = ₹96 L – ₹1.08 Cr | Pass |
| Carpet-area warning with published rate | Pass |
| Source links (https) and last-checked dates in panel, result and table | Pass |
| Rate table: 21 published rows; drafts listed as not yet available | Pass |
| Calculate sends nothing to WhatsApp / Supabase | Pass |
| Data file HTTP 500 and malformed JSON → error shown, manual entry still works | Pass |
| No horizontal overflow, no JS errors (desktop + mobile) | Pass |

**Untested:** real iPhone Safari / Android devices; whether each source URL still shows the same figure after today; Admin integration (not built — proposal only).
