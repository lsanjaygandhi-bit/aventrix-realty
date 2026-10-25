# Requirements Specification — NRI Property Tax Review System
Version 0.1 · Draft for review · Not approved for production

## Objective
Provide an accessible, carefully bounded preliminary workflow for non-resident individuals considering sale of property in India. It must not misrepresent an estimate as a certified tax result.

## Intended first release
- Residential property sales in India, initially focused on straightforward individual ownership cases.
- Tamil Nadu/Chennai may be used as a sample location, but Indian tax rules are not necessarily state-specific.
- Exclude automated final results for inherited/gifted properties, companies, trusts, partnerships, agricultural land, multiple complex ownership histories, treaty edge cases, or any scenario not validated by tax professionals.
- US and other country modules are later phases, each with independent professional validation.

## User steps
1. Tax residency and relevant tax year
2. Property and ownership profile
3. Acquisition cost and history
4. Proposed sale and withholding context
5. Summary, missing evidence, professional review checklist and PDF

## Input handling
- Do not request PAN, passport number, bank account details or raw document scans in initial version.
- Require explicit user consent before any future storage or document upload.
- Validate dates, positive amounts, ownership percentage (1–100), currency and required fields.
- Distinguish user-provided facts from system-derived values and professional determinations.
- Do not silently infer missing facts.

## Output requirements
- Show entered values, calculation steps, assumptions, applicable tax year, rule version and source citations.
- Separate preliminary capital-gain arithmetic, legally determined taxable gain, estimated final tax, withholding/TDS, tax already paid and possible refund.
- If rules or evidence are insufficient, show “Professional review required” and suppress an unsupported estimate.
- Branded PDF must show report ID, generated timestamp, scope, assumptions, limitations, source/rule version, missing documents and disclaimer.
- PDF default is generated on demand and not permanently stored server-side.
- Disclaimer must request independent reconciliation by a qualified CA/tax professional and clearly state this is not final tax advice.

## Proposed release gates
- Legal source verified and dated
- Rule set reviewed and approved by qualified professional
- Independently prepared benchmark calculations pass
- Unit, integration, regression, accessibility and privacy tests pass
- Rate limiting and abuse controls verified
- Retention/deletion test passes for any persisted anonymous records
- Security review completed
- Staging sign-off and explicit owner approval

## Website integration guardrails
- Preserve current header/footer and existing links.
- Proposed page route: `/nri-property-tax-calculator/` (confirm routing/deployment details before implementation).
- Homepage banner and NRI Services card should link to the same page.
- No production edits, commits, migrations or deployments without explicit approval.
