# Aventrix Realty AI Property Assistant — setup notes

## Current status
This feature is isolated on `feature/ai-property-assistant`. It is **not deployed or enabled on the public website**. The homepage widget is deliberately disabled until the backend and safeguards are configured.

## What it does
- Answers property questions in English or Tamil.
- Reads only published property rows from `public.properties`.
- Returns up to four exact listing slugs from the fetched records; the UI builds links only from those returned rows.
- Uses a Supabase Edge Function so the OpenAI API key never enters browser JavaScript.
- Does not write customer messages or contact details to the database.

## Before enabling
1. Review and merge the feature branch only after code review.
2. Configure the Supabase Edge Function secret `OPENAI_API_KEY` in the Aventrix Realty project's Edge Function secrets. API usage is billed separately by the AI provider; set usage limits and alerts.
3. Confirm the Edge Function's built-in environment includes `SUPABASE_URL` and `SUPABASE_ANON_KEY`; if not, configure the correct publishable/anon key as a function secret.
4. Confirm the existing RLS policy permits anonymous SELECT of published rows in `public.properties`. Do not loosen RLS broadly or use a service-role key for this public lookup.
5. Add reliable server-side rate limiting / abuse protection (prefer a managed rate limiter and/or Cloudflare Turnstile) before public activation. The current function has request-size and origin checks, but CORS is not a substitute for rate limiting.
6. Deploy the Edge Function and test with no matches, matching listings, Tamil, malformed requests, large payloads, unavailable AI provider, and mobile layout.
7. Only then change the widget container's `data-enabled="false"` to `true`, test the preview, and deploy the site after explicit approval.

## Endpoint
`https://gkrtjeygrqkglsadskcg.supabase.co/functions/v1/ai-property-assistant`

## Important
- The UI currently stays hidden while disabled.
- Never put `OPENAI_API_KEY`, Supabase secret keys, or service-role keys in public files.
- Model output is not trusted for listing details; returned properties are filtered against real rows fetched by the function.
- No live database schema, RLS policy, key, or production deployment is changed by this branch.
