/*
 * AVENTRIX REALTY — PUBLIC PROPERTIES LOADER
 * -------------------------------------------
 * Replaces the old hardcoded property-card HTML (index.html) and the
 * old static `propertyData` object (script.js) with live data from
 * Supabase. Markup produced here matches the ORIGINAL classes/structure
 * exactly, so style.css needs zero changes.
 *
 * Only properties with publish_status = 'Published' are ever shown here.
 */

(function () {
    const sb = window.supabaseClient;
    if (!sb) return;

    function formatBadge(listingType) {
        return listingType === "lease" ? "FOR LEASE" : "FOR SALE";
    }

    function badgeClass(listingType) {
        return listingType === "lease" ? "badge-lease" : "badge-sale";
    }

    // ---------------------------------------------------------
    // HOMEPAGE: #propertyGrid (inside index.html "#properties")
    // ---------------------------------------------------------
    const grid = document.getElementById("propertyGrid");
    if (grid) {
        renderHomepageGrid(grid);
    }

    async function renderHomepageGrid(gridEl) {
        // Featured first; if none marked featured yet, fall back to the
        // most recent published properties so the section is never empty.
        let { data: featured } = await sb
            .from("properties")
            .select("*")
            .eq("publish_status", "Published")
            .eq("is_featured", true)
            .order("created_at", { ascending: false })
            .limit(6);

        let properties = featured;

        if (!properties || properties.length === 0) {
            const { data: recent } = await sb
                .from("properties")
                .select("*")
                .eq("publish_status", "Published")
                .order("created_at", { ascending: false })
                .limit(6);
            properties = recent || [];
        }

        if (properties.length === 0) {
            gridEl.innerHTML = "";
            return;
        }

        gridEl.innerHTML = properties.map(cardTemplate).join("");
    }

    function cardTemplate(p) {
        const image = (p.images && p.images[0]) || "images/property1.jpg";
        return `
            <div class="property-card">
                <div class="property-image-wrap">
                    <img src="${escapeHtml(image)}" alt="${escapeHtml(p.title)}" loading="lazy">
                    <span class="property-badge ${badgeClass(p.listing_type)}">${formatBadge(p.listing_type)}</span>
                    <button class="property-share-btn" aria-label="Share this property"><i class="fas fa-share-alt" aria-hidden="true"></i></button>
                </div>
                <div class="content">
                    <span class="property-location"><i class="fas fa-map-marker-alt" aria-hidden="true"></i> ${escapeHtml(p.location || "")}</span>
                    <h3>${escapeHtml(p.title)}</h3>
                    <p>${escapeHtml(p.short_description || "")}</p>
                    <div class="property-footer">
                        <span class="property-price">${escapeHtml(p.price_display || "Contact for Price")}</span>
                        <a href="property.html?id=${encodeURIComponent(p.slug)}" class="view-details-btn">View Details</a>
                    </div>
                </div>
            </div>`;
    }

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    // ---------------------------------------------------------
    // PROPERTY DETAIL PAGE: property.html
    // ---------------------------------------------------------
    const titleEl = document.getElementById("property-title");
    if (titleEl) {
        renderPropertyDetail();
    }

    async function renderPropertyDetail() {
        const params = new URLSearchParams(window.location.search);
        const slug = params.get("id");

        let property = null;

        if (slug) {
            const { data } = await sb
                .from("properties")
                .select("*")
                .eq("slug", slug)
                .eq("publish_status", "Published")
                .maybeSingle();
            property = data;
        }

        // Graceful fallback so old shared links never show a broken page.
        if (!property) {
            const { data: fallback } = await sb
                .from("properties")
                .select("*")
                .eq("publish_status", "Published")
                .order("created_at", { ascending: false })
                .limit(1);
            property = fallback && fallback[0];
        }

        if (!property) return; // no properties in the system yet

        titleEl.textContent = property.title;

        const priceEl = document.getElementById("property-price");
        if (priceEl) priceEl.textContent = property.price_display || "Contact for Price";

        const locationEl = document.getElementById("property-location");
        if (locationEl) locationEl.textContent = "📍 " + (property.location || "");

        const imageEl = document.getElementById("property-image");
        if (imageEl) {
            const image = (property.images && property.images[0]) || "images/property1.jpg";
            imageEl.style.backgroundImage =
                `linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)), url("${image}")`;
        }

        const descriptionEl = document.getElementById("property-description");
        if (descriptionEl) descriptionEl.textContent = property.description || "";

        const featuresEl = document.getElementById("property-features");
        if (featuresEl && Array.isArray(property.features)) {
            featuresEl.innerHTML = "";
            property.features.forEach((feature) => {
                const li = document.createElement("li");
                li.textContent = feature;
                featuresEl.appendChild(li);
            });
        }

        // SEO — updates <title> and meta description/keywords without
        // touching any visible layout.
        if (property.seo_title) document.title = property.seo_title;
        setMeta("description", property.seo_description);
        setMeta("keywords", property.seo_keywords);
    }

    function setMeta(name, content) {
        if (!content) return;
        let tag = document.querySelector(`meta[name="${name}"]`);
        if (!tag) {
            tag = document.createElement("meta");
            tag.setAttribute("name", name);
            document.head.appendChild(tag);
        }
        tag.setAttribute("content", content);
    }
})();
