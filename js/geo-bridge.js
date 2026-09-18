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

    // request({ onGranted(lat, lng), onUnavailable(message) })
    //
    // If this session has already resolved (granted, denied, or
    // unavailable — on this page or an earlier one), resolves
    // immediately from the stored result and never calls the browser
    // API again, so the native prompt can only ever appear once per
    // session and navigating between pages never re-triggers it.
    function request(callbacks) {
        const existing = readSession();
        if (existing) {
            if (existing.status === "granted") {
                callbacks.onGranted(existing.lat, existing.lng);
            } else {
                callbacks.onUnavailable(existing.message || "Location isn't available.");
            }
            return;
        }

        if (!("geolocation" in navigator)) {
            const message = "Location isn't supported in this browser.";
            writeSession({ status: "unavailable", message });
            callbacks.onUnavailable(message);
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
                if (error.code === error.TIMEOUT) {
                    message = "Location request timed out.";
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    message = "Your location couldn't be determined right now.";
                }
                writeSession({ status: "denied", message });
                callbacks.onUnavailable(message);
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
    }

    return { request };
})();
