/*
 * AVENTRIX REALTY — SUPABASE CLIENT (SHARED)
 * -------------------------------------------
 * Single source of truth for the Supabase connection, used by both
 * the public website and the admin panel. Loaded on every page that
 * needs Supabase, AFTER the Supabase CDN script and BEFORE any
 * page-specific script that uses `window.supabaseClient`.
 *
 * IMPORTANT: only the public "anon" key belongs here. Never put the
 * service_role key in any file that ships to the browser.
 */

const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-SUPABASE-ANON-KEY";

window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);
