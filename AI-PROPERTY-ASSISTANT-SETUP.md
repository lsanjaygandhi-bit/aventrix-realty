# Aventrix Realty Free Property Search Assistant — setup notes

## Current status
- The free-search Edge Function `free-property-search` is deployed and active in the Aventrix Realty Supabase project.
- The homepage widget remains disabled (`data-enabled="false"`) until the feature branch is reviewed and the website preview is tested.
- The free-search endpoint does not call OpenAI and does not require an OpenAI API credit balance.
- The original AI endpoint is separate and is not used by the free-search widget.

## What the free version does
- Searches published rows in `public.properties` only.
- Returns up to four matching property links, using listing data from Supabase.
- Includes basic matching for locations, property type, BHK and a maximum budget when those details can be interpreted.
- Provides English or Tamil response text based on the query.
- Does not write messages or customer contact details to the database.
- Does not use a service-role key or expose a secret key in browser code.

## Endpoint
`https://gkrtjeygrqkglsadskcg.supabase.co/functions/v1/free-property-search`

## Before public activation
1. Review the changes on `feature/ai-property-assistant` and test the branch preview on mobile and desktop.
2. Test matching and no-match queries in English and Tamil, including budget, location, property type, and BHK.
3. Confirm property links resolve correctly and the assistant never implies a listing is available without current confirmation.
4. Add robust server-side rate limiting / abuse protection before public activation. CORS and request-size checks alone are not rate limiting.
5. Keep `data-enabled="false"` until the website preview is approved.
6. Merge and deploy only after explicit approval.

## Later optional AI upgrade
The original `ai-property-assistant` Edge Function calls OpenAI and requires a valid API key and available API credits. ChatGPT subscriptions do not include OpenAI API usage. The free-search version does not depend on that function.

## Security notes
- Never put `OPENAI_API_KEY`, Supabase secret keys, or service-role keys in public files.
- The search endpoint reads published property records through the public/anon key and existing database access policy.
- Do not broaden database RLS policies merely to make the assistant work.
