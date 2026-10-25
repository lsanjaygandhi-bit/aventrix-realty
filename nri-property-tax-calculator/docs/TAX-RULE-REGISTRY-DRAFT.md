# Tax Rule Registry — Draft, Not Legal Advice

No rates or legal rules in this file are approved for calculation. A production rule may be activated only after qualified professional review.

Each rule record should include:
- `rule_id`, country, jurisdiction, transaction type
- applicable law / section / form and official source URL
- effective-from and effective-to dates
- relevant tax year / transaction-date rule
- required input fields and decision conditions
- formula or decision logic with rounding method
- exclusions and edge cases
- source last-checked date
- prepared_by, reviewed_by, approval timestamp
- version, tests and release status

## Rule groups to research for India
1. Residential status and tax year
2. Property holding period and classification
3. Cost of acquisition, previous-owner cost and acquisition date
4. Stamp duty/guideline value and deemed consideration
5. Eligible transfer costs and capital improvements
6. Capital losses and set-off rules
7. Applicable capital-gains rates, surcharge and cess
8. Exemptions/reinvestment and deadlines
9. Non-resident seller withholding/TDS
10. Lower/nil withholding application and certificate workflow
11. Return filing, refund and tax payment
12. Tax treaty/foreign tax credit review
13. FEMA/RBI/bank repatriation checklist

## Guardrail
Never hard-code a rate from a blog, old calculator or unverified memory. If the rule is not verified for the transaction date, stop and refer to a professional.
