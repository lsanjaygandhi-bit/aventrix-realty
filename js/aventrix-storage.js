/*
 * AVENTRIX REALTY — CLIENT-SIDE + ACCOUNT-AWARE STORAGE LAYER
 * ---------------------------------------------------------------
 * Wishlist, Shortlist, and Recently Viewed.
 *
 * - Anonymous visitor: everything lives in localStorage, exactly as
 *   before this phase. Zero behavior change for anyone not logged in.
 * - Logged-in buyer (Supabase Auth session present): everything
 *   reads/writes the `wishlists` / `shortlists` / `recently_viewed`
 *   tables instead, scoped to that user by the RLS policies already
 *   in place (a user can only ever see/change their own rows).
 *
 * PUBLIC API IS UNCHANGED from the localStorage-only version — every
 * existing call site (property cards, Quick View, property.html,
 * wishlist.html, shortlist.html, the nav badge widget) keeps calling
 * wishlist.list()/.has()/.add()/.remove()/.toggle()/.count(),
 * shortlist.* the same way, and recentlyViewed.list()/.record()/
 * .remove()/.clear() the same way. All of those stay SYNCHRONOUS —
 * they read/return from an in-memory cache instantly, so no call
 * site needed to change into async/await code. Persistence to
 * Supabase happens in the background (fire-and-forget) when logged
 * in, the same way a localStorage write already happens "invisibly"
 * under a synchronous call.
 *
 * The one new thing call sites should use where correctness at
 * first paint matters (e.g. building property cards, so a saved
 * heart shows filled immediately rather than after a network round
 * trip): `await window.AventrixStorage.ready` before reading
 * `.has()`/`.list()` for the first time on a page. Anonymous users
 * resolve this instantly (it's just localStorage); logged-in users
 * resolve it once the one Supabase fetch for their saved data comes
 * back. This is the only call-site change made anywhere in this
 * phase — a handful of one-line `await ...ready` additions, nothing
 * about the method names/signatures/shapes changed.
 *
 * MIGRATION: the first time a browser that already has anonymous
 * Wishlist/Shortlist/Recently-Viewed data logs in, that local data
 * is uploaded (upsert, "ignore duplicates") into that user's
 * Supabase rows once. Nothing is deleted from localStorage — this
 * is additive/non-destructive, and doubles as a harmless fallback
 * if the account data layer is ever unreachable.
 */

(function () {
    const WISHLIST_KEY = "aventrix:wishlist";           // JSON array of slugs, most-recently-added last
    const RECENT_KEY = "aventrix:recentlyViewed";        // JSON array of { slug, viewedAt }, most-recent first
    const SHORTLIST_KEY = "aventrix:shortlist";          // JSON array of slugs, most-recently-added last
    const RECENT_CAP = 60; // generous technical cap so the list can't grow forever in one browser; not a business limit
    const MIGRATED_KEY_PREFIX = "aventrix:migratedToAccount:"; // + user id

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

    const sb = window.supabaseClient;

    // ---------------------------------------------------------
    // ACCOUNT STATE
    // ---------------------------------------------------------
    let currentUserId = null;          // null = anonymous / logged out
    let resolveReady = null;
    let ready = new Promise((res) => { resolveReady = res; });

    // In-memory cache — the single source of truth every synchronous
    // method below reads from. Loaded from localStorage immediately
    // (so anonymous visitors work exactly as before with zero delay),
    // then replaced with Supabase data if/once a logged-in session is
    // confirmed.
    const cache = {
        wishlist: safeGet(WISHLIST_KEY) || [],
        shortlist: safeGet(SHORTLIST_KEY) || [],
        recentlyViewed: safeGet(RECENT_KEY) || []
    };

    function localKeyFor(kind) {
        return kind === "wishlist" ? WISHLIST_KEY : kind === "shortlist" ? SHORTLIST_KEY : RECENT_KEY;
    }
    function tableFor(kind) {
        return kind === "wishlist" ? "wishlists" : kind === "shortlist" ? "shortlists" : "recently_viewed";
    }

    function persistLocal(kind) {
        safeSet(localKeyFor(kind), cache[kind]);
    }

    // Fire-and-forget Supabase write — callers stay synchronous.
    // Errors are logged, not surfaced, and the optimistic in-memory
    // change is NOT rolled back (avoids UI flicker); worst case the
    // next full reload re-syncs from the server as the source of
    // truth.
    function persistRemote(kind, op, row) {
        if (!sb || !currentUserId) return;
        const table = tableFor(kind);
        let query;
        if (op === "upsert") {
            query = sb.from(table).upsert(row, { onConflict: "user_id,property_slug" });
        } else if (op === "delete") {
            query = sb.from(table).delete().eq("user_id", currentUserId).eq("property_slug", row.property_slug);
        } else if (op === "clear") {
            query = sb.from(table).delete().eq("user_id", currentUserId);
        }
        if (query) {
            query.then(({ error }) => {
                if (error) console.error(`Aventrix: failed to sync ${kind} (${op}) to account`, error);
            });
        }
    }

    // ---------------------------------------------------------
    // WISHLIST
    // ---------------------------------------------------------
    const wishlist = {
        list() {
            return cache.wishlist.slice();
        },
        has(slug) {
            return cache.wishlist.indexOf(slug) !== -1;
        },
        count() {
            return cache.wishlist.length;
        },
        add(slug) {
            if (!slug || wishlist.has(slug)) return;
            cache.wishlist.push(slug);
            persistLocal("wishlist");
            persistRemote("wishlist", "upsert", { user_id: currentUserId, property_slug: slug });
            emit("aventrix:wishlist-changed", { slug, action: "add", count: cache.wishlist.length });
        },
        remove(slug) {
            if (!slug) return;
            cache.wishlist = cache.wishlist.filter((s) => s !== slug);
            persistLocal("wishlist");
            persistRemote("wishlist", "delete", { property_slug: slug });
            emit("aventrix:wishlist-changed", { slug, action: "remove", count: cache.wishlist.length });
        },
        toggle(slug) {
            if (wishlist.has(slug)) { wishlist.remove(slug); return false; }
            wishlist.add(slug);
            return true;
        }
    };

    // ---------------------------------------------------------
    // SHORTLIST
    // ---------------------------------------------------------
    const shortlist = {
        list() {
            return cache.shortlist.slice();
        },
        has(slug) {
            return cache.shortlist.indexOf(slug) !== -1;
        },
        count() {
            return cache.shortlist.length;
        },
        add(slug) {
            if (!slug || shortlist.has(slug)) return;
            cache.shortlist.push(slug);
            persistLocal("shortlist");
            persistRemote("shortlist", "upsert", { user_id: currentUserId, property_slug: slug });
            emit("aventrix:shortlist-changed", { slug, action: "add", count: cache.shortlist.length });
        },
        remove(slug) {
            if (!slug) return;
            cache.shortlist = cache.shortlist.filter((s) => s !== slug);
            persistLocal("shortlist");
            persistRemote("shortlist", "delete", { property_slug: slug });
            emit("aventrix:shortlist-changed", { slug, action: "remove", count: cache.shortlist.length });
        },
        toggle(slug) {
            if (shortlist.has(slug)) { shortlist.remove(slug); return false; }
            shortlist.add(slug);
            return true;
        },
        clear() {
            cache.shortlist = [];
            persistLocal("shortlist");
            persistRemote("shortlist", "clear", {});
            emit("aventrix:shortlist-changed", { action: "clear", count: 0 });
        }
    };

    // ---------------------------------------------------------
    // RECENTLY VIEWED
    // ---------------------------------------------------------
    const recentlyViewed = {
        list() {
            return cache.recentlyViewed.slice();
        },
        record(slug) {
            if (!slug) return;
            cache.recentlyViewed = cache.recentlyViewed.filter((entry) => entry.slug !== slug);
            const viewedAt = new Date().toISOString();
            cache.recentlyViewed.unshift({ slug, viewedAt });
            if (cache.recentlyViewed.length > RECENT_CAP) cache.recentlyViewed = cache.recentlyViewed.slice(0, RECENT_CAP);
            persistLocal("recentlyViewed");
            persistRemote("recentlyViewed", "upsert", { user_id: currentUserId, property_slug: slug, viewed_at: viewedAt });
            emit("aventrix:recently-viewed-changed", { slug, action: "record", count: cache.recentlyViewed.length });
        },
        remove(slug) {
            cache.recentlyViewed = cache.recentlyViewed.filter((entry) => entry.slug !== slug);
            persistLocal("recentlyViewed");
            persistRemote("recentlyViewed", "delete", { property_slug: slug });
            emit("aventrix:recently-viewed-changed", { slug, action: "remove", count: cache.recentlyViewed.length });
        },
        clear() {
            cache.recentlyViewed = [];
            persistLocal("recentlyViewed");
            persistRemote("recentlyViewed", "clear", {});
            emit("aventrix:recently-viewed-changed", { action: "clear", count: 0 });
        }
    };

    // ---------------------------------------------------------
    // ACCOUNT SYNC — runs once on load, and again on login/logout
    // ---------------------------------------------------------
    async function migrateLocalDataToAccount(userId) {
        const flagKey = MIGRATED_KEY_PREFIX + userId;
        if (safeGet(flagKey)) return; // already migrated this browser's local data for this user before

        const localWishlist = safeGet(WISHLIST_KEY) || [];
        const localShortlist = safeGet(SHORTLIST_KEY) || [];
        const localRecent = safeGet(RECENT_KEY) || [];

        const jobs = [];
        if (localWishlist.length) {
            jobs.push(sb.from("wishlists").upsert(
                localWishlist.map((slug) => ({ user_id: userId, property_slug: slug })),
                { onConflict: "user_id,property_slug", ignoreDuplicates: true }
            ));
        }
        if (localShortlist.length) {
            jobs.push(sb.from("shortlists").upsert(
                localShortlist.map((slug) => ({ user_id: userId, property_slug: slug })),
                { onConflict: "user_id,property_slug", ignoreDuplicates: true }
            ));
        }
        if (localRecent.length) {
            jobs.push(sb.from("recently_viewed").upsert(
                localRecent.map((entry) => ({ user_id: userId, property_slug: entry.slug, viewed_at: entry.viewedAt })),
                { onConflict: "user_id,property_slug", ignoreDuplicates: true }
            ));
        }

        if (jobs.length) {
            const results = await Promise.all(jobs);
            const failed = results.find((r) => r.error);
            if (failed) {
                console.error("Aventrix: local-to-account migration had an error (local data was NOT deleted, safe to retry next load)", failed.error);
                return; // don't set the migrated flag — try again next load
            }
        }

        safeSet(flagKey, true);
    }

    async function fetchAccountState(userId) {
        const [wishlistRes, shortlistRes, recentRes] = await Promise.all([
            sb.from("wishlists").select("property_slug, created_at").eq("user_id", userId).order("created_at", { ascending: true }),
            sb.from("shortlists").select("property_slug, created_at").eq("user_id", userId).order("created_at", { ascending: true }),
            sb.from("recently_viewed").select("property_slug, viewed_at").eq("user_id", userId).order("viewed_at", { ascending: false })
        ]);

        if (!wishlistRes.error && wishlistRes.data) {
            cache.wishlist = wishlistRes.data.map((r) => r.property_slug);
        }
        if (!shortlistRes.error && shortlistRes.data) {
            cache.shortlist = shortlistRes.data.map((r) => r.property_slug);
        }
        if (!recentRes.error && recentRes.data) {
            let rows = recentRes.data;
            if (rows.length > RECENT_CAP) {
                const excess = rows.slice(RECENT_CAP);
                rows = rows.slice(0, RECENT_CAP);
                // Best-effort tidy-up of old rows beyond the cap — not
                // required for correctness, just keeps the table small.
                excess.forEach((r) => {
                    sb.from("recently_viewed").delete().eq("user_id", userId).eq("property_slug", r.property_slug)
                        .then(() => {});
                });
            }
            cache.recentlyViewed = rows.map((r) => ({ slug: r.property_slug, viewedAt: r.viewed_at }));
        }

        emit("aventrix:wishlist-changed", { action: "sync", count: cache.wishlist.length });
        emit("aventrix:shortlist-changed", { action: "sync", count: cache.shortlist.length });
        emit("aventrix:recently-viewed-changed", { action: "sync", count: cache.recentlyViewed.length });
    }

    async function switchToAccount(userId) {
        currentUserId = userId;
        try {
            await migrateLocalDataToAccount(userId);
            await fetchAccountState(userId);
        } catch (err) {
            console.error("Aventrix: could not load account data, staying on local data for this session", err);
            currentUserId = null;
        }
    }

    function switchToAnonymous() {
        currentUserId = null;
        cache.wishlist = safeGet(WISHLIST_KEY) || [];
        cache.shortlist = safeGet(SHORTLIST_KEY) || [];
        cache.recentlyViewed = safeGet(RECENT_KEY) || [];
        emit("aventrix:wishlist-changed", { action: "sync", count: cache.wishlist.length });
        emit("aventrix:shortlist-changed", { action: "sync", count: cache.shortlist.length });
        emit("aventrix:recently-viewed-changed", { action: "sync", count: cache.recentlyViewed.length });
    }

    async function init() {
        if (!sb) { resolveReady(); return; }
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (session && session.user) {
                await switchToAccount(session.user.id);
            }
        } catch (err) {
            console.error("Aventrix: auth check failed, continuing with local data", err);
        }
        resolveReady();

        sb.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" && session && session.user && session.user.id !== currentUserId) {
                switchToAccount(session.user.id);
            } else if (event === "SIGNED_OUT") {
                switchToAnonymous();
            }
        });
    }

    init();

    window.AventrixStorage = { wishlist, shortlist, recentlyViewed, ready };
})();
