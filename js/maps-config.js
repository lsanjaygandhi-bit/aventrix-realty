/*
 * AVENTRIX REALTY — GOOGLE MAPS CONFIGURATION (Properties → Map View)
 * --------------------------------------------------------------------
 * Same pattern as js/supabase-client.js: a small public config file.
 * The site is static (no build step or server-side environment), so a
 * browser key is configured here.
 *
 * apiKey — a Google Maps Platform BROWSER key. It is visible to anyone
 *          who opens the page; that is normal for Maps JavaScript API
 *          keys. It is protected by restrictions set in Google Cloud
 *          Console, not by being hidden:
 *            Application restriction: Websites (HTTP referrers)
 *              https://aventrixrealty.com/*
 *              https://www.aventrixrealty.com/*
 *            API restriction: Maps JavaScript API only
 *          Never put a server key, a Places/Geocoding server key, or
 *          any Supabase service_role key in this file.
 *
 * mapId  — optional. A Map ID from Google Cloud Console → Map
 *          Management. When set, markers use Google's current
 *          "Advanced Markers"; when empty, classic markers are used.
 *
 * While apiKey is empty, the Map View shows "Map view is temporarily
 * unavailable…" and List View works exactly as before.
 */
window.AVENTRIX_MAPS_CONFIG = {
    apiKey: "AIzaSyAeQ62pO_VQ6e0kq8xCoUezFy-OmJfpZMQ",
    mapId: ""
};
