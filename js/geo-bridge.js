/*
 * AVENTRIX REALTY — GEOLOCATION SESSION BRIDGE
 * ---------------------------------------------------
 * Shared by index.html (which triggers the browser's native location
 * prompt on page load) and js/near-me.js on properties.html (which
 * reuses whatever was already resolved on the homepage instead of
 * asking again).
 *
 * The actual navigator.geolocation.getCurrentPosition() call lives
 * here, in exactly one place, so it only ever runs once per browser
 * session (per tab) regardless of how many pages the visitor moves
 * between — sessionStorage, not localStorage, so it's cleared
 * automatically when the browser session/tab ends, never persisted
 * long-term.
 */
window.AventrixGeoBridge = (function () {
    const KEY = "aventrix_geo_session";

    function readSession() {
        try {
            const raw = sessionStorage.getItem(KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function writeSession(state) {
        try {
            sessionStorage.setItem(KEY, JSON.stringify(state));
        } catch {
            // sessionStorage unavailable (private mode, quota, etc.) —
            // fail silently; the page keeps working, it just means a
            // fresh request happens again on the next page too.
        }
    }

    // request({ onGranted(lat, lng), onUnavailable(message, kind) }, opts)
    //
    // By default (opts.forceRefresh not set), if this session has already
    // resolved — granted, denied, or unavailable, on this page or an
    // earlier one — this resolves immediately from the stored result and
    // never calls the browser API again, so the native PERMISSION PROMPT
    // can only ever appear once per session and navigating between pages
    // never re-triggers it. This is what js/near-me.js and index.html's
    // load-time prompt use.
    //
    // opts.forceRefresh: true skips that cache whenever permission was
    // already granted, and asks the browser for a brand-new position
    // instead of replaying the first one it ever got. This does NOT
    // re-show the native permission dialog — once a site is granted
    // access, the browser answers getCurrentPosition() silently again —
    // it only guarantees the coordinates themselves are live. Use this
    // for anything the person can invoke repeatedly expecting it to
    // reflect where they are RIGHT NOW (the Map View "Current Location"
    // button): replaying a hours-old cached fix there would silently
    // recenter the map on a place the visitor already left. A denied or
    // unsupported outcome is still served from cache even with
    // forceRefresh — retrying either one won't succeed until the person
    // changes a browser setting, so there is nothing fresher to fetch.
    //
    // `kind` (second onUnavailable argument, optional to use) is one of
    // "denied" | "unavailable" | "unsupported" — a caller that only
    // wants the ready-made message (e.g. js/near-me.js) can ignore it;
    // a caller that needs to show its own wording per outcome (e.g. the
    // Map View "Current Location" control) can branch on it instead of
    // parsing the message text.
    function request(callbacks, opts) {
        const forceRefresh = !!(opts && opts.forceRefresh);
        const existing = readSession();
        if (existing && !(forceRefresh && existing.status === "granted")) {
            if (existing.status === "granted") {
                callbacks.onGranted(existing.lat, existing.lng);
            } else {
                callbacks.onUnavailable(existing.message || "Location isn't available.", existing.kind || "denied");
            }
            return;
        }

        if (!navigator.geolocation) {
            const message = "Location isn't supported in this browser.";
            writeSession({ status: "unavailable", message, kind: "unsupported" });
            callbacks.onUnavailable(message, "unsupported");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                writeSession({ status: "granted", lat, lng, ts: Date.now() });
                callbacks.onGranted(lat, lng);
            },
            (error) => {
                let message = "Location access was not enabled.";
                let kind = "denied";
                if (error.code === error.TIMEOUT) {
                    message = "Location request timed out.";
                    kind = "unavailable";
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    message = "Your location couldn't be determined right now.";
                    kind = "unavailable";
                }
                writeSession({ status: "denied", message, kind });
                callbacks.onUnavailable(message, kind);
            },
            // forceRefresh also skips the browser's own up-to-5-minute
            // position cache (maximumAge), since replaying a stale native
            // fix has the same problem as replaying our own cached one.
            { enableHighAccuracy: false, timeout: 8000, maximumAge: forceRefresh ? 0 : 300000 }
        );
    }

    return { request };
})();
