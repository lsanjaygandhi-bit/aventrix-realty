/*
 * AVENTRIX REALTY — MY SAVED PROPERTIES PAGE
 * ---------------------------------------------
 * Reads slugs from AventrixStorage (localStorage), then fetches the
 * live property rows for those slugs from Supabase — never a cached
 * copy — so saved/recent properties always show current price,
 * status and images. A slug that no longer matches a Published
 * property (unpublished, sold and removed, deleted) is silently
 * skipped rather than shown broken.
 */

(function () {
    const sb = window.supabaseClient;
    const wishlistGrid = document.getElementById("wsWishlistGrid");
    if (!wishlistGrid) return; // not on wishlist.html

    const els = {
        wishlistGrid,
        wishlistEmpty: document.getElementById("wsWishlistEmpty"),
        wishlistCount: document.getElementById("wsWishlistCount"),
        recentGrid: document.getElementById("wsRecentGrid"),
        recentEmpty: document.getElementById("wsRecentEmpty"),
        recentCount: document.getElementById("wsRecentCount"),
        clearRecentBtn: document.getElementById("wsClearRecentBtn")
    };

    const CARD_PHONE_TEL = "+919176887770";
    const CARD_WHATSAPP_URL = "https://wa.me/919176887770";

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }
    function formatBadge(listingType) { return listingType === "lease" ? "FOR LEASE" : "FOR SALE"; }
    function badgeClass(listingType) { return listingType === "lease" ? "badge-lease" : "badge-sale"; }

    function keyDetailsLine(p) {
        const parts = [];
        if (p.bedrooms) parts.push(`${p.bedrooms} Bed${p.bedrooms === 1 ? "" : "s"}`);
        if (p.bathrooms) parts.push(`${p.bathrooms} Bath${p.bathrooms === 1 ? "" : "s"}`);
        if (p.built_up_area) parts.push(p.built_up_area);
        return parts.join(" · ");
    }

    function cardTemplate(p, opts) {
        const image = p.featured_image || (p.images && p.images[0]) || "images/property1.jpg";
        const details = keyDetailsLine(p);
        const saved = opts.list === "wishlist" ? true : window.AventrixStorage.wishlist.has(p.slug);
        return `
            <div class="property-card" data-slug="${escapeHtml(p.slug)}">
                <div class="property-image-wrap">
                    <a href="property.html?id=${encodeURIComponent(p.slug)}" aria-label="View ${escapeHtml(p.title)}">
                        <img src="${escapeHtml(image)}" alt="${escapeHtml(p.title)}" loading="lazy">
                    </a>
                    <span class="property-badge ${badgeClass(p.listing_type)}">${formatBadge(p.listing_type)}</span>
                    <button class="property-save-btn${saved ? " saved" : ""}" aria-label="${saved ? "Remove from Wishlist" : "Save to Wishlist"}" aria-pressed="${saved ? "true" : "false"}" data-slug="${escapeHtml(p.slug)}"><i class="${saved ? "fas" : "far"} fa-heart" aria-hidden="true"></i></button>
                </div>
                <div class="content">
                    <span class="property-location"><i class="fas fa-map-marker-alt" aria-hidden="true"></i> ${escapeHtml(p.location || "")}</span>
                    <h3><a href="property.html?id=${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></h3>
                    ${details ? `<p>${escapeHtml(details)}</p>` : ""}
                    <div class="property-footer">
                        <div class="property-footer-top">
                            <span class="property-price">${escapeHtml(p.price_display || "Contact for Price")}</span>
                            <div class="property-icon-actions">
                                <a href="tel:${CARD_PHONE_TEL}" class="icon-action-btn icon-call-btn" aria-label="Call about ${escapeHtml(p.title)}" title="Call">
                                    <i class="fas fa-phone-alt" aria-hidden="true"></i>
                                </a>
                                <a href="${CARD_WHATSAPP_URL}" class="icon-action-btn icon-whatsapp-btn" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp about ${escapeHtml(p.title)}" title="WhatsApp">
                                    <i class="fab fa-whatsapp" aria-hidden="true"></i>
                                </a>
                            </div>
                        </div>
                        <a href="property.html?id=${encodeURIComponent(p.slug)}" class="view-details-btn">View Details</a>
                    </div>
                </div>
            </div>`;
    }

    async function fetchPropertiesForSlugs(slugs) {
        if (!slugs.length || !sb) return [];
        const { data, error } = await sb
            .from("properties")
            .select("*")
            .eq("publish_status", "Published")
            .in("slug", slugs);
        if (error || !data) return [];
        // Preserve the caller's ordering (Supabase's `in()` does not
        // guarantee result order), and drop any slug that no longer
        // matches a live, published property.
        const bySlug = {};
        data.forEach((p) => { bySlug[p.slug] = p; });
        return slugs.map((s) => bySlug[s]).filter(Boolean);
    }

    async function renderWishlist() {
        const slugs = window.AventrixStorage.wishlist.list().slice().reverse(); // most recently saved first
        const properties = await fetchPropertiesForSlugs(slugs);

        els.wishlistCount.textContent = String(properties.length);

        if (!properties.length) {
            els.wishlistGrid.innerHTML = "";
            els.wishlistEmpty.hidden = false;
            return;
        }

        els.wishlistEmpty.hidden = true;
        els.wishlistGrid.innerHTML = properties.map((p) => cardTemplate(p, { list: "wishlist" })).join("");
    }

    async function renderRecentlyViewed() {
        const entries = window.AventrixStorage.recentlyViewed.list(); // already most-recent-first
        const slugs = entries.map((e) => e.slug);
        const properties = await fetchPropertiesForSlugs(slugs);

        els.recentCount.textContent = String(properties.length);
        els.clearRecentBtn.hidden = properties.length === 0;

        if (!properties.length) {
            els.recentGrid.innerHTML = "";
            els.recentEmpty.hidden = false;
            return;
        }

        els.recentEmpty.hidden = true;
        els.recentGrid.innerHTML = properties.map((p) => cardTemplate(p, { list: "recent" })).join("");
    }

    function wireCardHeartButtons(container) {
        container.addEventListener("click", (e) => {
            const btn = e.target.closest(".property-save-btn");
            if (!btn) return;
            e.preventDefault();
            const slug = btn.getAttribute("data-slug");
            window.AventrixStorage.wishlist.toggle(slug);
        });
    }

    wireCardHeartButtons(els.wishlistGrid);
    wireCardHeartButtons(els.recentGrid);

    els.clearRecentBtn.addEventListener("click", () => {
        window.AventrixStorage.recentlyViewed.clear();
    });

    // A wishlist change can affect the heart icon shown on a Recently
    // Viewed card too, so both sections refresh together.
    window.addEventListener("aventrix:wishlist-changed", () => {
        renderWishlist();
        renderRecentlyViewed();
    });
    window.addEventListener("aventrix:recently-viewed-changed", renderRecentlyViewed);

    renderWishlist();
    renderRecentlyViewed();
})();
