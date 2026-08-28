/*
 * AVENTRIX REALTY — CLIENT-SIDE STORAGE LAYER
 * ---------------------------------------------
 * Wishlist + Recently Viewed, backed by localStorage. There is no
 * buyer authentication yet, so this is deliberately scoped to a
 * single browser/device — it is NOT a substitute for server-side
 * user storage.
 *
 * WHY IT'S SHAPED THIS WAY (for the future Supabase migration):
 * Every read/write goes through the four methods below
 * (wishlist.list/has/add/remove, recentlyViewed.list/record/remove/
 * clear) rather than any UI code touching localStorage directly.
 * When buyer accounts exist, only the *inside* of these methods
 * needs to change (swap localStorage calls for Supabase queries
 * against a `wishlists` / `recently_viewed` table keyed by
 * auth.uid()) — every call site in public-properties.js,
 * properties-search.js, property.html and wishlist.html stays
 * identical. Both objects also emit the same two events either way,
 * so UI code never needs to know which backend is active.
 *
 * Only stores property `slug` (the existing unique identifier) —
 * never a copy of property data — so it can never go stale or
 * show fake/outdated info. Live details are always re-fetched from
 * Supabase when actually displaying a saved/recent property.
 */

(function () {
    const WISHLIST_KEY = "aventrix:wishlist";           // JSON array of slugs, most-recently-added last
    const RECENT_KEY = "aventrix:recentlyViewed";        // JSON array of { slug, viewedAt }, most-recent first
    const RECENT_CAP = 60; // generous technical cap so the list can't grow forever in one browser; not a business limit

    function safeGet(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            return null; // localStorage unavailable (private browsing, disabled, quota, corrupt JSON)
        }
    }

    function safeSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (err) {
            return false;
        }
    }

    function emit(name, detail) {
        try {
            window.dispatchEvent(new CustomEvent(name, { detail: detail }));
        } catch (err) { /* older browsers without CustomEvent — degrade silently */ }
    }

    // ---------------------------------------------------------
    // WISHLIST
    // ---------------------------------------------------------
    const wishlist = {
        list() {
            return safeGet(WISHLIST_KEY) || [];
        },
        has(slug) {
            return wishlist.list().indexOf(slug) !== -1;
        },
        count() {
            return wishlist.list().length;
        },
        add(slug) {
            if (!slug) return;
            const current = wishlist.list();
            if (current.indexOf(slug) !== -1) return; // no duplicates
            current.push(slug);
            safeSet(WISHLIST_KEY, current);
            emit("aventrix:wishlist-changed", { slug, action: "add", count: current.length });
        },
        remove(slug) {
            if (!slug) return;
            const current = wishlist.list().filter((s) => s !== slug);
            safeSet(WISHLIST_KEY, current);
            emit("aventrix:wishlist-changed", { slug, action: "remove", count: current.length });
        },
        toggle(slug) {
            if (wishlist.has(slug)) {
                wishlist.remove(slug);
                return false; // now not saved
            }
            wishlist.add(slug);
            return true; // now saved
        }
    };

    // ---------------------------------------------------------
    // RECENTLY VIEWED
    // ---------------------------------------------------------
    const recentlyViewed = {
        list() {
            return safeGet(RECENT_KEY) || [];
        },
        record(slug) {
            if (!slug) return;
            let current = recentlyViewed.list().filter((entry) => entry.slug !== slug); // drop existing entry for this property...
            current.unshift({ slug, viewedAt: new Date().toISOString() }); // ...then re-add it at the front (prevents duplicate entries, keeps it fresh)
            if (current.length > RECENT_CAP) current = current.slice(0, RECENT_CAP);
            safeSet(RECENT_KEY, current);
            emit("aventrix:recently-viewed-changed", { slug, action: "record", count: current.length });
        },
        remove(slug) {
            const current = recentlyViewed.list().filter((entry) => entry.slug !== slug);
            safeSet(RECENT_KEY, current);
            emit("aventrix:recently-viewed-changed", { slug, action: "remove", count: current.length });
        },
        clear() {
            safeSet(RECENT_KEY, []);
            emit("aventrix:recently-viewed-changed", { action: "clear", count: 0 });
        }
    };

    // ---------------------------------------------------------
    // SHORTLIST (separate from Wishlist — this is the "select a few
    // properties, compare them, enquire about them together" list)
    // ---------------------------------------------------------
    const SHORTLIST_KEY = "aventrix:shortlist"; // JSON array of slugs, most-recently-added last

    const shortlist = {
        list() {
            return safeGet(SHORTLIST_KEY) || [];
        },
        has(slug) {
            return shortlist.list().indexOf(slug) !== -1;
        },
        count() {
            return shortlist.list().length;
        },
        add(slug) {
            if (!slug) return;
            const current = shortlist.list();
            if (current.indexOf(slug) !== -1) return; // no duplicates
            current.push(slug);
            safeSet(SHORTLIST_KEY, current);
            emit("aventrix:shortlist-changed", { slug, action: "add", count: current.length });
        },
        remove(slug) {
            if (!slug) return;
            const current = shortlist.list().filter((s) => s !== slug);
            safeSet(SHORTLIST_KEY, current);
            emit("aventrix:shortlist-changed", { slug, action: "remove", count: current.length });
        },
        toggle(slug) {
            if (shortlist.has(slug)) {
                shortlist.remove(slug);
                return false;
            }
            shortlist.add(slug);
            return true;
        },
        clear() {
            safeSet(SHORTLIST_KEY, []);
            emit("aventrix:shortlist-changed", { action: "clear", count: 0 });
        }
    };

    window.AventrixStorage = { wishlist, recentlyViewed, shortlist };
})();
