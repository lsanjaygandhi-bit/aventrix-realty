# Manual QA Checklist

## UI
- [ ] Open `index.html` in Chrome/Safari/Firefox.
- [ ] Header logo keeps its proportions and is not distorted.
- [ ] Mobile width around 375px has no horizontal overflow.
- [ ] Step navigation shows the correct current step.
- [ ] Required fields block progress when blank.
- [ ] Ownership share below 1 or above 100 is rejected.
- [ ] Back/Continue navigation works.
- [ ] User can review all entered values before printing.
- [ ] Print / Save as PDF opens browser print dialog.
- [ ] Disclaimer appears in report printout.
- [ ] Copy summary action works where clipboard permissions allow.

## Data handling
- [ ] Confirm there are no fetch/XHR/network requests.
- [ ] Confirm values are not written to localStorage/sessionStorage/cookies.
- [ ] Refresh page and confirm form data is not retained.
- [ ] Do not use real personal data during tests.

## Important limitation checks
- [ ] Summary labels arithmetic difference as NOT taxable gain.
- [ ] No tax rate, TDS amount, refund, exemption or final liability is calculated.
- [ ] Prototype clearly states it is not for tax filing.

## Production-only gates (not implemented)
- [ ] Legal rule review signed off
- [ ] Benchmark cases approved by CA
- [ ] Server-side validation and rate limiting
- [ ] Privacy/retention/deletion tests
- [ ] Existing routes/header/footer regression tests
- [ ] Staging and explicit production approval
