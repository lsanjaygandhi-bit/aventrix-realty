# Cloudflare Web Analytics Setup — Aventrix Realty

This guide uses the existing Cloudflare account and makes no source-code, DNS, or Supabase changes.

Official instructions:
- https://developers.cloudflare.com/web-analytics/get-started/
- https://developers.cloudflare.com/pages/how-to/web-analytics/

## Setup

1. Sign in to the Cloudflare dashboard.
2. Open Workers & Pages and select the existing Aventrix Realty deployment.
3. If it is a Pages project, open Metrics and select Enable under Web Analytics. Cloudflare says it will add the beacon on the next deployment.
4. If it is not a Pages project, open Analytics & Logs → Web Analytics → Add a site, select or enter the correct Aventrix Realty hostname, and follow the dashboard's setup instructions.
5. Check first whether analytics is already enabled. Avoid adding a second beacon if automatic setup is already active.
6. Visit https://aventrixrealty.com and a few public pages. Wait a few minutes, then check Web Analytics for page views and visitor trends.

## What it provides

Cloudflare Web Analytics is documented as free and privacy-first. It provides aggregate page-view, visitor-trend, and real-user performance information. It does not provide visitors' names, account login history, or CRM details.

## Cost and safety

- Do not upgrade a plan or create another project for this setup.
- Do not change DNS or source code merely to enable the standard dashboard feature.
- If the dashboard presents a paid option or unexpected charge, stop and verify before proceeding.
- The custom live-visitor/login-history feature in PR #38 remains a draft. Do not deploy it until SQL, RLS, browser, privacy, and abuse-control tests pass.
