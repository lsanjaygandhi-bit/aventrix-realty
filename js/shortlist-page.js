/*
 * AVENTRIX REALTY — SHORTLIST & COMPARE PAGE
 * -----------------------------------------------
 * Shortlist itself is persisted (AventrixStorage.shortlist,
 * localStorage — same pattern as Wishlist). Which shortlisted items
 * are currently *selected* for comparing/enquiring is a page-session
 * choice only (an in-memory Set), not saved — there's no requirement
 * for that to survive a refresh, and persisting it would just be
 * more surface area for stale state.
 *
 * The enquiry form re-uses the existing generic handler in
 * js/enquiry-supabase.js untouched — it captures every field on
 * whatever <form id="propertyForm"> it finds (including our hidden
 * "Shortlisted Properties" field) into the same `enquiries` table
 * every other form on the site already writes to. No new backend
 * code, no new table.
 */

(function () {
    const sb = window.supabaseClient;
    const grid = document.getElementById("scShortlistGrid");
    if (!grid) return; // not on shortlist.html

    const els = {
        grid,
        empty: document.getElementById("scShortlistEmpty"),
        count: document.getElementById("scShortlistCount"),
        clearShortlistBtn: document.getElementById("scClearShortlistBtn"),
        toolbar: document.getElementById("scToolbar"),
        hint: document.getElementById("scHint"),
        selectAllBtn: document.getElementById("scSelectAllBtn"),
        clearSelectionBtn: document.getElementById("scClearSelectionBtn"),
        compareBtn: document.getElementById("scCompareBtn"),
        compareCount: document.getElementById("scCompareCount"),
        enquireBtn: document.getElementById("scEnquireBtn"),
        enquireCount: document.getElementById("scEnquireCount"),
        compareSection: document.getElementById("scCompareSection"),
        compareTableCount: document.getElementById("scCompareTableCount"),
        compareTable: document.getElementById("scCompareTable"),
        enquirySection: document.getElementById("scEnquirySection"),
        enquirySelectedList: document.getElementById("scEnquirySelectedList"),
        enquiryPropertiesField: document.getElementById("scEnquiryPropertiesField")
    };

    const CARD_PHONE_TEL = "+919176887770";
    const CARD_WHATSAPP_URL = "https://wa.me/919176887770";
    const MAX_COMPARE = 4;
    const MIN_COMPARE = 2;

    let currentProperties = []; // full property rows for the current shortlist, in shortlist order
    const selected = new Set(); // slugs currently checked for Compare/Enquire

    function t(key, fallback) {
        if (document.documentElement.getAttribute("data-avx-translations-loaded") !== "true") {
            return fallback;
        }
        return window.avxI18n ? window.avxI18n.t(key) : fallback;
    }

    function formatMessage(key, fallback, values) {
        return Object.keys(values).reduce((message, name) => {
            return message.replace(new RegExp("\\{" + name + "\\}", "g"), values[name]);
        }, t(key, fallback));
    }

    function formatCountButton(key, fallback, countId, count) {
        const template = t(key, fallback);
        const parts = template.split("{count}");
        return escapeHtml(parts[0]) + `<span id="${countId}">${count}</span>` +
            escapeHtml(parts.slice(1).join("{count}"));
    }

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }
    function formatBadge(listingType) {
        return listingType === "lease"
            ? t("wishlist.badge.lease", "FOR LEASE")
            : t("wishlist.badge.sale", "FOR SALE");
    }
    function badgeClass(listingType) { return listingType === "lease" ? "badge-lease" : "badge-sale"; }

    function keyDetailsLine(p) {
        const parts = [];
        if (p.bedrooms) parts.push(formatMessage("wishlist.details.bedrooms", "{count} bedrooms", { count: p.bedrooms }));
        if (p.bathrooms) parts.push(formatMessage("wishlist.details.bathrooms", "{count} bathrooms", { count: p.bathrooms }));
        if (p.built_up_area) parts.push(p.built_up_area);
        return parts.join(" · ");
    }

    async function fetchPropertiesForSlugs(slugs) {
        if (!slugs.length || !sb) return [];
        const { data, error } = await sb
            .from("properties")
            .select("*")
            .eq("publish_status", "Published")
            .in("slug", slugs);
        if (error || !data) return [];
        const bySlug = {};
        data.forEach((p) => { bySlug[p.slug] = p; });
        return slugs.map((s) => bySlug[s]).filter(Boolean);
    }

    // ---------------------------------------------------------
    // SHORTLIST GRID
    // ---------------------------------------------------------
    function cardTemplate(p) {
        const image = p.featured_image || (p.images && p.images[0]) || "images/property1.jpg";
        const details = keyDetailsLine(p);
        const checked = selected.has(p.slug);
        const viewLabel = formatMessage("wishlist.card.view", "View {title}", { title: p.title });
        const callLabel = formatMessage("wishlist.card.call", "Call about {title}", { title: p.title });
        const whatsappLabel = formatMessage("wishlist.card.whatsapp", "WhatsApp about {title}", { title: p.title });
        return `
            <div class="property-card" data-slug="${escapeHtml(p.slug)}">
                <div class="property-image-wrap">
                    <a href="property.html?id=${encodeURIComponent(p.slug)}" aria-label="${escapeHtml(viewLabel)}">
                        <img src="${escapeHtml(image)}" alt="${escapeHtml(p.title)}" loading="lazy">
                    </a>
                    <span class="property-badge ${badgeClass(p.listing_type)}">${escapeHtml(formatBadge(p.listing_type))}</span>
                    <button class="property-shortlist-remove-btn" aria-label="${escapeHtml(t("shortlist.card.remove", "Remove from Shortlist"))}" data-slug="${escapeHtml(p.slug)}"><i class="fas fa-xmark" aria-hidden="true"></i></button>
                    <label class="sc-select-chip">
                        <input type="checkbox" data-slug="${escapeHtml(p.slug)}" ${checked ? "checked" : ""}>
                        ${escapeHtml(t("shortlist.card.select", "Select"))}
                    </label>
                </div>
                <div class="content">
                    <span class="property-location"><i class="fas fa-map-marker-alt" aria-hidden="true"></i> ${escapeHtml(p.location || "")}</span>
                    <h3><a href="property.html?id=${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></h3>
                    ${details ? `<p>${escapeHtml(details)}</p>` : ""}
                    <div class="property-footer">
                        <div class="property-footer-top">
                            <span class="property-price">${escapeHtml(p.price_display || "Contact for Price")}</span>
                            <div class="property-icon-actions">
                                <a href="tel:${CARD_PHONE_TEL}" data-slug="${escapeHtml(p.slug)}" data-track-event="call_click" class="icon-action-btn icon-call-btn" aria-label="${escapeHtml(callLabel)}" title="${escapeHtml(t("wishlist.card.callTitle", "Call"))}">
                                    <i class="fas fa-phone-alt" aria-hidden="true"></i>
                                </a>
                                <a href="${escapeHtml(window.AventrixTracking ? window.AventrixTracking.whatsappHref(p) : CARD_WHATSAPP_URL)}" data-slug="${escapeHtml(p.slug)}" data-track-event="whatsapp_click" class="icon-action-btn icon-whatsapp-btn" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(whatsappLabel)}" title="${escapeHtml(t("wishlist.card.whatsappTitle", "WhatsApp"))}">
                                    <i class="fab fa-whatsapp" aria-hidden="true"></i>
                                </a>
                            </div>
                        </div>
                        <a href="property.html?id=${encodeURIComponent(p.slug)}" class="view-details-btn">${escapeHtml(t("View Details", "View Details"))}</a>
                    </div>
                </div>
            </div>`;
    }

    async function renderShortlist() {
        await window.AventrixStorage.ready;
        const slugs = window.AventrixStorage.shortlist.list().slice().reverse(); // most recently added first
        currentProperties = await fetchPropertiesForSlugs(slugs);

        // Drop any selection for a slug that's no longer shortlisted/published.
        const validSlugs = new Set(currentProperties.map((p) => p.slug));
        Array.from(selected).forEach((s) => { if (!validSlugs.has(s)) selected.delete(s); });

        els.count.textContent = String(currentProperties.length);
        els.clearShortlistBtn.hidden = currentProperties.length === 0;
        els.toolbar.hidden = currentProperties.length === 0;
        els.hint.hidden = currentProperties.length === 0;

        if (!currentProperties.length) {
            els.grid.innerHTML = "";
            els.empty.hidden = false;
            els.compareSection.hidden = true;
            els.enquirySection.hidden = true;
            return;
        }

        els.empty.hidden = true;
        els.grid.innerHTML = currentProperties.map(cardTemplate).join("");
        updateToolbarState();
    }

    function updateToolbarState() {
        const n = selected.size;
        els.compareCount.textContent = String(n);
        els.enquireCount.textContent = String(n);
        els.compareBtn.innerHTML = formatCountButton(
            "shortlist.compareSelected", "Compare Selected ({count})", "scCompareCount", n
        );
        els.enquireBtn.innerHTML = formatCountButton(
            "shortlist.enquireSelected", "Enquire About Selected ({count})", "scEnquireCount", n
        );
        els.compareBtn.disabled = n < MIN_COMPARE || n > MAX_COMPARE;
        els.enquireBtn.disabled = n < 1;
    }

    els.grid.addEventListener("click", (e) => {
        const removeBtn = e.target.closest(".property-shortlist-remove-btn");
        if (removeBtn) {
            e.preventDefault();
            const slug = removeBtn.getAttribute("data-slug");
            window.AventrixStorage.shortlist.remove(slug);
            return;
        }
    });

    els.grid.addEventListener("change", (e) => {
        const checkbox = e.target.closest('.sc-select-chip input[type="checkbox"]');
        if (!checkbox) return;
        const slug = checkbox.getAttribute("data-slug");
        if (checkbox.checked) selected.add(slug); else selected.delete(slug);
        updateToolbarState();
    });

    els.selectAllBtn.addEventListener("click", () => {
        currentProperties.forEach((p) => selected.add(p.slug));
        els.grid.querySelectorAll('.sc-select-chip input[type="checkbox"]').forEach((cb) => { cb.checked = true; });
        updateToolbarState();
    });

    els.clearSelectionBtn.addEventListener("click", () => {
        selected.clear();
        els.grid.querySelectorAll('.sc-select-chip input[type="checkbox"]').forEach((cb) => { cb.checked = false; });
        updateToolbarState();
    });

    els.clearShortlistBtn.addEventListener("click", () => {
        window.AventrixStorage.shortlist.clear();
        selected.clear();
    });

    window.addEventListener("aventrix:shortlist-changed", renderShortlist);
    document.addEventListener("avx:i18n-ready", () => {
        renderShortlist();
        if (!els.compareSection.hidden) renderCompareTable();
    });

    // ---------------------------------------------------------
    // COMPARE TABLE
    // ---------------------------------------------------------
    const COMPARE_ROWS = [
        { label: "Price", key: "shortlist.compare.price", get: (p) => p.price_display || "Contact for Price" },
        { label: "Location", key: "shortlist.compare.location", get: (p) => p.location || "—" },
        { label: "Property Type", key: "shortlist.compare.propertyType", get: (p) => p.category ? p.category.charAt(0).toUpperCase() + p.category.slice(1) : "—" },
        { label: "Listing Type", key: "shortlist.compare.listingType", get: (p) => formatBadge(p.listing_type) },
        { label: "Bedrooms", key: "shortlist.compare.bedrooms", get: (p) => p.bedrooms ?? "—" },
        { label: "Bathrooms", key: "shortlist.compare.bathrooms", get: (p) => p.bathrooms ?? "—" },
        { label: "Built-up Area", key: "shortlist.compare.builtArea", get: (p) => p.built_up_area || "—" },
        { label: "Land Area", key: "shortlist.compare.landArea", get: (p) => p.land_area || "—" },
        { label: "Furnishing", key: "shortlist.compare.furnishing", get: (p) => p.furnishing || "—" },
        { label: "Availability", key: "shortlist.compare.availability", get: (p) => p.status || "—" },
        { label: "Key Features", key: "shortlist.compare.features", get: (p) => (Array.isArray(p.features) && p.features.length) ? p.features.join(", ") : "—" }
    ];

    function renderCompareTable() {
        const properties = currentProperties.filter((p) => selected.has(p.slug));

        if (properties.length < MIN_COMPARE || properties.length > MAX_COMPARE) {
            els.compareSection.hidden = true;
            return;
        }

        els.compareTableCount.textContent = String(properties.length);

        const headerRow = `
            <tr>
                <th class="sc-attr-col">${escapeHtml(t("shortlist.compare.property", "Property"))}</th>
                ${properties.map((p) => `
                    <th class="sc-compare-col-header">
                        <img src="${escapeHtml(p.featured_image || (p.images && p.images[0]) || "images/property1.jpg")}" alt="${escapeHtml(p.title)}">
                        <h4>${escapeHtml(p.title)}</h4>
                        <a href="property.html?id=${encodeURIComponent(p.slug)}" class="sc-compare-view-link">${escapeHtml(t("View Details", "View Details"))} →</a><br>
                        <button type="button" class="sc-compare-remove" data-slug="${escapeHtml(p.slug)}">${escapeHtml(t("shortlist.card.remove", "Remove"))}</button>
                    </th>`).join("")}
            </tr>`;

        const attrRows = COMPARE_ROWS.map((row) => `
            <tr>
                <td class="sc-attr-col">${escapeHtml(t(row.key, row.label))}</td>
                ${properties.map((p) => `<td>${escapeHtml(String(row.get(p)))}</td>`).join("")}
            </tr>`).join("");

        els.compareTable.innerHTML = `<thead>${headerRow}</thead><tbody>${attrRows}</tbody>`;
        els.compareSection.hidden = false;

        els.compareTable.querySelectorAll(".sc-compare-remove").forEach((btn) => {
            btn.addEventListener("click", () => {
                const slug = btn.getAttribute("data-slug");
                selected.delete(slug);
                const cb = els.grid.querySelector(`.sc-select-chip input[data-slug="${CSS.escape(slug)}"]`);
                if (cb) cb.checked = false;
                updateToolbarState();
                renderCompareTable();
            });
        });
    }

    els.compareBtn.addEventListener("click", () => {
        renderCompareTable();
        els.compareSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    // ---------------------------------------------------------
    // ENQUIRE ABOUT SELECTED
    // ---------------------------------------------------------
    els.enquireBtn.addEventListener("click", () => {
        const properties = currentProperties.filter((p) => selected.has(p.slug));
        if (!properties.length) return;

        const summaryLines = properties.map((p) =>
            `${p.title} — ${p.location || ""} — ${p.price_display || "Contact for Price"} (${p.property_code || p.slug})`
        );

        els.enquirySelectedList.innerHTML = `<strong>${escapeHtml(formatMessage("shortlist.enquiry.selectedCount", "Enquiring about {count} selected properties:", { count: properties.length }))}</strong><br>` +
            summaryLines.map((line) => escapeHtml(line)).join("<br>");

        els.enquiryPropertiesField.value = summaryLines.join(" | ");

        els.enquirySection.hidden = false;
        els.enquirySection.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    renderShortlist();
})();
