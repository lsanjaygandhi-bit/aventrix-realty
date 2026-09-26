/*
 * AVENTRIX REALTY — PROPERTY INTERACTION TRACKING + WHATSAPP MESSAGES
 * ------------------------------------------------------------------
 * 1) Property-specific WhatsApp message, one place for every button:
 *      "Hi Aventrix Realty, I am interested in AVX-000125 – 2 BHK
 *       Apartment in Medavakkam. <link>"
 *    Only public listing data (code, title, location, public URL) is
 *    ever put in the message.
 *
 * 2) Real interaction analytics for the Admin dashboard. Calls the
 *    database function track_property_event(slug, type, visitor_key)
 *    (sql/migration-2026-09-25-02-…), which:
 *      - only accepts published properties and known event types,
 *      - records each action once per visitor / property / day,
 *      - ignores admin & realtor activity.
 *    The visitor key is a random ID stored in this browser — no name,
 *    phone, email or location is ever sent. If the database call
 *    fails, the site behaves exactly as before (fire-and-forget).
 *
 * Wiring: any clickable element with data-track-event="<type>"
 * inside an element carrying data-slug is tracked automatically.
 * Wishlist/Shortlist adds are picked up from the existing
 * aventrix:wishlist-changed / aventrix:shortlist-changed events.
 */
(function () {
    const VISITOR_KEY = "aventrix:visitorKey";
    const DEFAULT_WHATSAPP = "919176887770";
    const SITE_ORIGIN = "https://aventrixrealty.com";

    function visitorKey() {
        try {
            let k = localStorage.getItem(VISITOR_KEY);
            if (!k) {
                k = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
                    : "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
                localStorage.setItem(VISITOR_KEY, k);
            }
            return k;
        } catch (err) {
            // Storage blocked: use a per-page key (still deduped per page view).
            if (!window.__aventrixVisitorKey) window.__aventrixVisitorKey = "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
            return window.__aventrixVisitorKey;
        }
    }

    const sentThisPage = new Set();

    function track(slug, eventType) {
        const sb = window.supabaseClient;
        if (!sb || !slug || !eventType) return;
        const key = slug + "|" + eventType;
        if (sentThisPage.has(key)) return;
        sentThisPage.add(key);
        try {
            sb.rpc("track_property_event", { p_slug: slug, p_event_type: eventType, p_visitor_key: visitorKey() })
                .then(({ error }) => { if (error) console.debug("Aventrix tracking skipped:", error.message); });
        } catch (err) { /* never break the page for analytics */ }
    }

    function propertyUrl(slug) {
        const origin = /aventrixrealty\.com$/.test(window.location.hostname) ? window.location.origin : SITE_ORIGIN;
        return origin + "/property.html?id=" + encodeURIComponent(slug);
    }

    // p: { property_code, title, location, slug }
    function whatsappMessage(p) {
        if (!p) return "Hi Aventrix Realty, I would like to know more about your properties.";
        const code = p.property_code ? p.property_code + " – " : "";
        const title = (p.title || "a property").trim();
        const loc = p.location && title.toLowerCase().indexOf(String(p.location).toLowerCase()) === -1 ? " in " + p.location : "";
        const link = p.slug ? "\n" + propertyUrl(p.slug) : "";
        return `Hi Aventrix Realty, I am interested in ${code}${title}${loc}. Please share more details.${link}`;
    }

    function whatsappHref(p, digits) {
        const num = String(digits || DEFAULT_WHATSAPP).replace(/\D/g, "") || DEFAULT_WHATSAPP;
        return `https://wa.me/${num}?text=${encodeURIComponent(whatsappMessage(p))}`;
    }

    // Delegated click tracking
    document.addEventListener("click", (e) => {
        const el = e.target.closest("[data-track-event]");
        if (!el) return;
        const holder = el.closest("[data-slug]");
        const slug = el.getAttribute("data-slug") || (holder && holder.getAttribute("data-slug"));
        track(slug, el.getAttribute("data-track-event"));
    }, true);

    window.addEventListener("aventrix:wishlist-changed", (e) => {
        if (e.detail && e.detail.action === "add") track(e.detail.slug, "wishlist_add");
    });
    window.addEventListener("aventrix:shortlist-changed", (e) => {
        if (e.detail && e.detail.action === "add") track(e.detail.slug, "shortlist_add");
    });

    window.AventrixTracking = { track, visitorKey, whatsappMessage, whatsappHref, propertyUrl };
})();
