# Integration Plan (Not Executed)

1. Review existing website ZIP and confirm exact header/footer and NRI Services link conventions.
2. Confirm the current Cloudflare Worker + static asset deployment path; do not migrate hosting.
3. Decide whether a separate staging branch/project is available and safe.
4. Add the calculator route in an isolated branch only after owner approval.
5. Link homepage banner and NRI Services page to the same calculator URL.
6. Keep current site CSS/JS namespacing isolated to prevent regressions.
7. Keep all draft SQL under `sql/` excluded from public static assets; review `.wranglerignore` and assets exposure before any deployment.
8. Implement server-side calculation endpoint only after security review; never expose service-role credentials.
9. Add professional-approved rules and benchmark tests.
10. Test all existing routes, locale prefixes, property sharing, admin, header/footer and calculators.
11. Obtain explicit approval before commit/merge/deploy or database migration.
