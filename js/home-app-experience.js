/*
 * AVENTRIX REALTY — HOMEPAGE APP-STYLE EXPERIENCE
 * -----------------------------------------------------------------
 * Everything new added for the mobile-app-style homepage redesign:
 *   - My Listings / My Searches segmented control
 *   - Recent Searches (real localStorage history of the existing
 *     search form — no fake data)
 *   - Future Properties (real Supabase data, a SEPARATE compact
 *     card renderer — js/public-properties.js's cardTemplate() and
 *     the existing "Our Featured Properties" grid are NOT touched)
 *   - My Listings data (existing Supabase Auth session + the
 *     existing properties.submitted_by column/RLS policy — same
 *     backend the mobile app's My Properties screen already uses;
 *     no new schema, no new auth)
 *   - Bottom nav's Menu button proxies the EXISTING hamburger menu
 *     toggle rather than building a second menu system.
 *
 * Depends on window.supabaseClient (js/supabase-client.js) and
 * window.AventrixStorage (js/aventrix-storage.js) already being
 * loaded first — same convention as every other public-*.js file.
 */
(function () {
    const sb = window.supabaseClient;

    const FALLBACK_IMAGE = "images/property1.jpg";
    // Same real Aventrix Realty office number already used by every
    // Call/WhatsApp icon on properties.html's own cards — matched
    // exactly, not a new/placeholder number.
    const CARD_PHONE_TEL = "+919176887770";
    const CARD_WHATSAPP_URL = "https://wa.me/919176887770";
    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    // ---------------------------------------------------------
    // SEGMENTED CONTROL (My Listings / My Searches)
    // ---------------------------------------------------------
    function initSegments() {
        const wrap = document.getElementById("homeAppSegments");
        if (!wrap) return;
        const buttons = wrap.querySelectorAll(".home-app-segment-btn");
        const panels = {
            listings: document.getElementById("homeAppPanelListings"),
            searches: document.getElementById("homeAppPanelSearches")
        };
        buttons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const target = btn.getAttribute("data-panel");
                buttons.forEach((b) => {
                    const active = b === btn;
                    b.classList.toggle("active", active);
                    b.setAttribute("aria-selected", active ? "true" : "false");
                });
                Object.keys(panels).forEach((key) => {
                    panels[key].hidden = key !== target;
                });
            });
        });
    }

    // ---------------------------------------------------------
    // RECENT SEARCHES — now backed by the shared, fixed
    // js/recent-searches.js module (see that file for the root-cause
    // note on why this previously didn't work for real searches).
    // The homepage hero bar's <form> still gets its own capture here
    // (it has no equivalent in properties-search.js to hook into),
    // normalized through the same record() function and canonical URL
    // shape as every other search.
    // ---------------------------------------------------------
    function initRecentSearches() {
        const RS = window.AventrixRecentSearches;
        if (!RS) return;

        const form = document.querySelector(".property-search-form");
        if (form) {
            form.addEventListener("submit", () => {
                const data = new FormData(form);
                const params = new URLSearchParams();
                const location = (data.get("location") || "").toString().trim();
                const type = (data.get("type") || "").toString();
                const transaction = (data.get("transaction") || "").toString();
                if (location) params.set("location", location);
                if (type) params.set("type", type);
                if (transaction) params.set("transaction", transaction);
                const qs = params.toString();
                if (!qs) return; // nothing entered — not a real search to remember

                const TYPE_LABELS = { apartment: "Apartments", villa: "Villas", plot: "Plots", commercial: "Commercial" };
                const txnLabel = transaction === "buy" ? "Buy" : transaction === "lease" ? "Rent" : "";
                const typeLabel = TYPE_LABELS[type] || "";
                const parts = [];
                if (txnLabel) parts.push(txnLabel); else if (typeLabel) parts.push(typeLabel);
                if (location) parts.push("in " + location); else if (txnLabel && typeLabel) parts.push(typeLabel);

                RS.record({ url: "properties.html?" + qs, label: parts.length ? parts.join(" ") : "All Properties" });
                // Synchronous localStorage write completes before the
                // form's normal navigation to properties.html — no
                // preventDefault, the existing search still runs exactly
                // as before.
            });
        }

        const chipsEl = document.getElementById("recentSearchesChips");
        const panelEl = document.getElementById("myRecentSearchesPanel");
        RS.renderChips(chipsEl);
        RS.renderChips(panelEl);

        const allBtn = document.getElementById("allRecentSearchesBtn");
        const expandedEl = document.getElementById("recentSearchesExpanded");
        let expanded = false;
        if (allBtn && expandedEl) {
            allBtn.addEventListener("click", () => {
                expanded = !expanded;
                expandedEl.hidden = !expanded;
                chipsEl.hidden = expanded;
                if (expanded) RS.renderExpandedList(expandedEl);
                allBtn.textContent = expanded ? "Show Less" : "All Recent Searches";
            });
        }

        document.addEventListener("aventrix:recent-searches-changed", () => {
            RS.renderChips(chipsEl);
            RS.renderChips(panelEl);
        });
    }

    // ---------------------------------------------------------
    // COMPACT PROPERTY CARD — separate from public-properties.js's
    // cardTemplate() on purpose (see file header comment). Reuses
    // the SAME AventrixStorage.wishlist heart toggle so save state
    // stays consistent with the rest of the site.
    // ---------------------------------------------------------
    function compactCardTemplate(p, opts) {
        opts = opts || {};
        const image = p.featured_image || (p.images && p.images[0]) || FALLBACK_IMAGE;
        const saved = window.AventrixStorage && window.AventrixStorage.wishlist.has(p.slug);
        const isLease = p.listing_type === "lease";
        let badgeHtml = `<span class="home-app-card-badge">${isLease ? "FOR RENT" : "FOR SALE"}</span>`;
        if (opts.showApprovalStatus) {
            const pending = p.publish_status !== "Published";
            badgeHtml = `<span class="home-app-card-badge ${pending ? "pending" : "published"}">${pending ? "PENDING APPROVAL" : "PUBLISHED"}</span>`;
        }
        const details = [];
        if (p.bedrooms) details.push(`${p.bedrooms} BHK`);
        if (p.built_up_area) details.push(p.built_up_area);
        const detailsLine = details.length ? details.join(" &bull; ") + (p.price_display ? " &bull; " : "") : "";
        const detailHref = `property.html?id=${encodeURIComponent(p.slug)}`;
        // FUTURE PROPERTIES ONLY (opts.showActions): View Details / Call /
        // WhatsApp row. Reuses the exact same Aventrix Realty office
        // number already used by every other Call/WhatsApp icon on the
        // site (properties.html's own cards) — there is no per-listing
        // phone field in the properties table, so this IS the real,
        // existing contact number, not a placeholder.
        const actionsHtml = opts.showActions
            ? `
                <div class="home-app-card-actions">
                    <a class="home-app-card-view-btn" href="${detailHref}">View Details</a>
                    <a class="home-app-card-icon-btn" href="tel:${CARD_PHONE_TEL}" aria-label="Call about ${escapeHtml(p.title)}" title="Call">
                        <i class="fas fa-phone-alt" aria-hidden="true"></i>
                    </a>
                    <a class="home-app-card-icon-btn" href="${CARD_WHATSAPP_URL}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp about ${escapeHtml(p.title)}" title="WhatsApp">
                        <i class="fab fa-whatsapp" aria-hidden="true"></i>
                    </a>
                </div>`
            : "";
        // Structural note: the card used to be one single <a> wrapping
        // everything. Putting real links (View Details/Call/WhatsApp)
        // inside that would nest <a> inside <a> — invalid HTML with
        // unpredictable click behaviour. Restructured to match the
        // same safe pattern properties.html's own cards already use:
        // only the image/title/location/price area is a link; the
        // action row sits alongside it as independently clickable
        // elements, so Call/WhatsApp/View Details can never trigger
        // the card's own navigation (and vice versa).
        return `
            <div class="home-app-property-card">
                <a class="home-app-card-linkarea" href="${detailHref}">
                    <div class="home-app-card-image-wrap">
                        <img src="${escapeHtml(image)}" alt="${escapeHtml(p.title)}" loading="lazy">
                        ${badgeHtml}
                        ${window.AventrixStorage ? `<button type="button" class="home-app-card-heart${saved ? " saved" : ""}" data-slug="${escapeHtml(p.slug)}" aria-label="${saved ? "Remove from Wishlist" : "Save to Wishlist"}"><i class="${saved ? "fas" : "far"} fa-heart" aria-hidden="true"></i></button>` : ""}
                    </div>
                    <div class="home-app-card-content">
                        <h3>${escapeHtml(p.title)}</h3>
                        <span class="home-app-card-location"><i class="fas fa-map-marker-alt" aria-hidden="true"></i> ${escapeHtml(p.location || "")}</span>
                        <span class="home-app-card-details">${detailsLine}${escapeHtml(p.price_display || "Contact for Price")}</span>
                    </div>
                </a>
                ${actionsHtml}
            </div>`;
    }

    function wireHearts(container) {
        if (!container || !window.AventrixStorage) return;
        container.addEventListener("click", (e) => {
            const btn = e.target.closest(".home-app-card-heart");
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            const slug = btn.getAttribute("data-slug");
            const nowSaved = window.AventrixStorage.wishlist.toggle(slug);
            btn.classList.toggle("saved", nowSaved);
            btn.querySelector("i").className = nowSaved ? "fas fa-heart" : "far fa-heart";
            btn.setAttribute("aria-label", nowSaved ? "Remove from Wishlist" : "Save to Wishlist");
        });
    }

    // ---------------------------------------------------------
    // FUTURE PROPERTIES — real Supabase data, Published only
    // (same public visibility rule as everywhere else on the site).
    // ---------------------------------------------------------
    async function loadFutureProperties() {
        const grid = document.getElementById("futurePropertiesGrid");
        if (!grid || !sb) return;
        grid.innerHTML = '<p class="home-app-loading">Loading properties…</p>';
        const { data, error } = await sb
            .from("properties")
            .select("*")
            .eq("publish_status", "Published")
            .order("is_featured", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(20);
        if (error || !data || data.length === 0) {
            grid.innerHTML = '<p class="home-app-empty">No properties available right now — please check back soon.</p>';
            return;
        }
        grid.innerHTML = data.map((p) => compactCardTemplate(p, { showActions: true })).join("");
        wireHearts(grid);
    }

    // ---------------------------------------------------------
    // MY LISTINGS — existing Supabase Auth session + existing
    // submitted_by column/RLS. No new backend.
    // ---------------------------------------------------------
    async function loadMyListings() {
        const grid = document.getElementById("myListingsGrid");
        if (!grid || !sb) return;
        grid.innerHTML = '<p class="home-app-loading">Loading your listings…</p>';

        const { data: sessionData } = await sb.auth.getSession();
        const userId = sessionData && sessionData.session && sessionData.session.user && sessionData.session.user.id;

        if (!userId) {
            grid.innerHTML = `
                <div class="home-app-signin-prompt">
                    <p>Sign in to see the properties you've listed with Aventrix Realty.</p>
                    <a href="account.html" class="home-app-signin-btn">Sign In / Create Account</a>
                </div>`;
            return;
        }

        const { data, error } = await sb
            .from("properties")
            .select("*")
            .eq("submitted_by", userId)
            .order("created_at", { ascending: false });

        if (error) {
            grid.innerHTML = '<p class="home-app-empty">Couldn\'t load your listings. Please try again shortly.</p>';
            return;
        }
        if (!data || data.length === 0) {
            grid.innerHTML = '<p class="home-app-empty">You haven\'t listed any properties yet.</p>';
            return;
        }
        grid.innerHTML = data.map((p) => compactCardTemplate(p, { showApprovalStatus: true })).join("");
        wireHearts(grid);
    }

    // ---------------------------------------------------------
    // BOTTOM NAV — Menu button proxies the EXISTING hamburger menu
    // toggle instead of a second menu system.
    // ---------------------------------------------------------
    function initBottomNavMenu() {
        const btn = document.getElementById("homeAppMenuBtn");
        const existingToggle = document.getElementById("menuToggle");
        if (btn && existingToggle) {
            btn.addEventListener("click", () => existingToggle.click());
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        initSegments();
        initRecentSearches();
        initBottomNavMenu();
        loadFutureProperties();
        loadMyListings();
    });
})();
