/*
 * AVENTRIX REALTY — PROPERTY SEARCH & FILTER ENGINE
 * ---------------------------------------------------
 * Powers properties.html only. Reads/writes the URL query string so
 * a filtered search is shareable and survives Back/Forward.
 *
 * Filtering strategy (server-side where the schema supports it, so
 * it stays fast as the number of listings grows):
 *   - category, listing_type, bedrooms (gte), bathrooms (gte),
 *     price_value (gte/lte), location (ilike) → filtered in the
 *     Supabase query itself.
 *   - Built-up Area (min/max sq.ft) → properties.built_up_area is
 *     free text (e.g. "1,450 sq.ft", matching the rest of the
 *     schema's convention), so there is no numeric column to filter
 *     on in the database. This filter runs client-side against the
 *     leading number in that text after the (already server-narrowed)
 *     result set comes back. A property whose area text has no
 *     parseable number is excluded only when an Area filter is set.
 *
 * price_value is a new, optional numeric column (see
 * sql/schema-search-filter-extension.sql) used only by this filter/
 * sort engine — price_display is still what every card shows.
 */

(function () {
    const sb = window.supabaseClient;

    const grid = document.getElementById("sfResultsGrid");
    if (!grid) return; // not on properties.html

    const CARD_PHONE_TEL = "+919176887770";
    const CARD_WHATSAPP_URL = "https://wa.me/919176887770";
    const RESULT_CAP = 500; // technical safety cap, not a business/display limit

    const els = {
        location: document.getElementById("sfLocation"),
        category: document.getElementById("sfCategory"),
        subType: document.getElementById("sfSubType"),
        listingType: document.getElementById("sfListingType"),
        priceMin: document.getElementById("sfPriceMin"),
        priceMax: document.getElementById("sfPriceMax"),
        bedrooms: document.getElementById("sfBedrooms"),
        bathrooms: document.getElementById("sfBathrooms"),
        areaMin: document.getElementById("sfAreaMin"),
        areaMax: document.getElementById("sfAreaMax"),
        facing: document.getElementById("sfFacing"),
        furnishing: document.getElementById("sfFurnishing"),
        parking: document.getElementById("sfParking"),
        roadWidthMin: document.getElementById("sfRoadWidthMin"),
        sort: document.getElementById("sfSort"),
        resultsCount: document.getElementById("sfResultsCount"),
        resultsGrid: grid,
        emptyState: document.getElementById("sfEmptyState"),
        errorState: document.getElementById("sfErrorState"),
        activeChips: document.getElementById("sfActiveChips"),
        activeCount: document.getElementById("sfActiveCount"),
        clearBtn: document.getElementById("sfClearFilters"),
        emptyClearBtn: document.getElementById("sfEmptyClearBtn"),
        applyBtn: document.getElementById("sfApplyFilters"),
        panel: document.getElementById("sfFilterPanel"),
        mobileToggle: document.getElementById("sfMobileFilterToggle"),
        filterClose: document.getElementById("sfFilterClose"),
        backdrop: document.getElementById("sfBackdrop")
    };

    // Maps the homepage hero search's "Property Type" values onto this
    // page's category values, so the existing hero form keeps working
    // once its action points here. The four legacy values map onto the
    // old category names for backward compatibility with any bookmarked
    // or previously-shared links; the five canonical taxonomy values map
    // onto themselves (identity) since the hero form now uses the same
    // Property Type values as this page.
    const HERO_TYPE_TO_CATEGORY = {
        apartment: "apartments",
        villa: "villas",
        plot: "land",
        commercial: "commercial",
        residential: "residential",
        industrial: "industrial",
        special_purpose: "special_purpose",
        agricultural: "agricultural"
    };

    // Property Type → Sub-Type taxonomy (approved 2026-09). Drives the
    // dependent Sub-Type dropdown on this page and is duplicated (kept
    // in sync intentionally, same as the existing card-template pattern
    // with near-me.js) in admin/js/properties.js for the Admin form's
    // cascade, since these are plain scripts with no shared module.
    const TYPE_SUBTYPES = {
        residential: [
            { value: "apartment_flat", label: "Apartment / Flat" },
            { value: "villa", label: "Villa" },
            { value: "independent_house", label: "Independent House" },
            { value: "duplex", label: "Duplex" },
            { value: "penthouse", label: "Penthouse" },
            { value: "residential_plot", label: "Residential Plot" }
        ],
        commercial: [
            { value: "office_space", label: "Office Space" },
            { value: "shop_retail", label: "Shop / Retail" },
            { value: "showroom", label: "Showroom" },
            { value: "commercial_building", label: "Commercial Building" },
            { value: "commercial_plot", label: "Commercial Plot" }
        ],
        industrial: [
            { value: "factory_manufacturing", label: "Factory / Manufacturing" },
            { value: "warehouse", label: "Warehouse" },
            { value: "industrial_building", label: "Industrial Building" },
            { value: "industrial_plot", label: "Industrial Plot" }
        ],
        special_purpose: [
            { value: "hotel", label: "Hotel" },
            { value: "hospital", label: "Hospital" },
            { value: "school_institution", label: "School / Institution" },
            { value: "resort", label: "Resort" },
            { value: "other_special_purpose", label: "Other Special Purpose" }
        ],
        agricultural: [
            { value: "agricultural_land", label: "Agricultural Land" },
            { value: "farm_land", label: "Farm Land" },
            { value: "plantation_estate", label: "Plantation / Estate" }
        ]
    };

    // Reverse lookup (sub-type value -> owning Property Type) so a deep
    // link carrying only `subtype=` (no `category=`) still resolves to
    // the right Property Type — sub-type values are unique across the
    // whole taxonomy, so this is unambiguous.
    const SUBTYPE_TO_CATEGORY = {};
    Object.keys(TYPE_SUBTYPES).forEach((cat) => {
        TYPE_SUBTYPES[cat].forEach((s) => { SUBTYPE_TO_CATEGORY[s.value] = cat; });
    });

    // Rebuilds the Sub-Type dropdown for the given Property Type, keeping
    // `selectedValue` selected only when it's actually valid for that
    // type (otherwise resets to "Any Sub-Type"). Disabled when no
    // Property Type is chosen, matching the Admin form's cascade.
    function populateSubTypeOptions(category, selectedValue) {
        const list = TYPE_SUBTYPES[category] || [];
        els.subType.innerHTML = '<option value="">Any Sub-Type</option>' +
            list.map((s) => `<option value="${s.value}">${escapeHtml(s.label)}</option>`).join("");
        els.subType.disabled = list.length === 0;
        els.subType.value = list.some((s) => s.value === selectedValue) ? selectedValue : "";
    }

    const FIELD_LABELS = {
        location: "Location",
        category: "Type",
        subType: "Sub-Type",
        listingType: "",
        priceMin: "Price",
        bedrooms: "Beds",
        bathrooms: "Baths",
        areaMin: "Area"
    };

    function readStateFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const subType = params.get("subtype") || "";
        const category = params.get("category") || HERO_TYPE_TO_CATEGORY[params.get("type")] ||
            (subType && SUBTYPE_TO_CATEGORY[subType]) || "";
        return {
            location: params.get("location") || "",
            category: category,
            subType: subType,
            listingType: params.get("listingType") ||
                (params.get("transaction") === "buy" ? "sale" :
                 params.get("transaction") === "lease" ? "lease" : ""),
            priceMin: params.get("priceMin") || "",
            priceMax: params.get("priceMax") || "",
            bedrooms: params.get("beds") || "",
            bathrooms: params.get("baths") || "",
            areaMin: params.get("areaMin") || "",
            areaMax: params.get("areaMax") || "",
            facing: params.get("facing") || "",
            furnishing: params.get("furnishing") || "",
            parking: params.get("parking") || "",
            roadWidthMin: params.get("roadWidthMin") || "",
            sort: params.get("sort") || "recommended"
        };
    }

    function applyStateToInputs(state) {
        els.location.value = state.location;
        els.category.value = state.category;
        populateSubTypeOptions(state.category, state.subType);
        els.listingType.value = state.listingType;
        els.priceMin.value = state.priceMin;
        els.priceMax.value = state.priceMax;
        els.bedrooms.value = state.bedrooms;
        els.bathrooms.value = state.bathrooms;
        els.areaMin.value = state.areaMin;
        els.areaMax.value = state.areaMax;
        els.facing.value = state.facing;
        els.furnishing.value = state.furnishing;
        els.parking.value = state.parking;
        els.roadWidthMin.value = state.roadWidthMin;
        els.sort.value = state.sort;
    }

    function readStateFromInputs() {
        return {
            location: els.location.value.trim(),
            category: els.category.value,
            subType: els.subType.value,
            listingType: els.listingType.value,
            priceMin: els.priceMin.value,
            priceMax: els.priceMax.value,
            bedrooms: els.bedrooms.value,
            bathrooms: els.bathrooms.value,
            areaMin: els.areaMin.value,
            areaMax: els.areaMax.value,
            facing: els.facing.value,
            furnishing: els.furnishing.value,
            parking: els.parking.value,
            roadWidthMin: els.roadWidthMin.value,
            sort: els.sort.value
        };
    }

    function writeStateToUrl(state, replace) {
        const params = new URLSearchParams();
        if (state.location) params.set("location", state.location);
        if (state.category) params.set("category", state.category);
        if (state.subType) params.set("subtype", state.subType);
        if (state.listingType) params.set("listingType", state.listingType);
        if (state.priceMin) params.set("priceMin", state.priceMin);
        if (state.priceMax) params.set("priceMax", state.priceMax);
        if (state.bedrooms) params.set("beds", state.bedrooms);
        if (state.bathrooms) params.set("baths", state.bathrooms);
        if (state.areaMin) params.set("areaMin", state.areaMin);
        if (state.areaMax) params.set("areaMax", state.areaMax);
        if (state.facing) params.set("facing", state.facing);
        if (state.furnishing) params.set("furnishing", state.furnishing);
        if (state.parking) params.set("parking", state.parking);
        if (state.roadWidthMin) params.set("roadWidthMin", state.roadWidthMin);
        if (state.sort && state.sort !== "recommended") params.set("sort", state.sort);

        const qs = params.toString();
        const url = window.location.pathname + (qs ? "?" + qs : "");
        if (replace) {
            history.replaceState(null, "", url);
        } else {
            history.pushState(null, "", url);
        }
    }

    function skeletonCardsHtml(count) {
        return Array.from({ length: count }).map(() => `
            <div class="skeleton-card" aria-hidden="true">
                <div class="skeleton-image"></div>
                <div class="skeleton-line skeleton-line-short"></div>
                <div class="skeleton-line skeleton-line-long"></div>
                <div class="skeleton-line skeleton-line-medium"></div>
            </div>`).join("");
    }

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    function formatBadge(listingType) {
        return listingType === "lease" ? "FOR LEASE" : "FOR SALE";
    }
    function badgeClass(listingType) {
        return listingType === "lease" ? "badge-lease" : "badge-sale";
    }

    function cardTemplate(p) {
        const image = p.featured_image || (p.images && p.images[0]) || "images/property1.jpg";
        const saved = window.AventrixStorage && window.AventrixStorage.wishlist.has(p.slug);
        const shortlisted = window.AventrixStorage && window.AventrixStorage.shortlist.has(p.slug);
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
                    <p>${escapeHtml(p.short_description || "")}</p>
                    <div class="property-footer">
                        <div class="property-footer-top">
                            <span class="property-price">${escapeHtml(p.price_display || "Contact for Price")}</span>
                            <div class="property-icon-actions">
                                <button type="button" class="icon-action-btn icon-shortlist-btn${shortlisted ? " active" : ""}" aria-label="${shortlisted ? "Remove from Shortlist" : "Add to Shortlist"}" aria-pressed="${shortlisted ? "true" : "false"}" data-slug="${escapeHtml(p.slug)}" title="${shortlisted ? "Shortlisted" : "Add to Shortlist"}">
                                    <i class="fas fa-bookmark" aria-hidden="true"></i>
                                </button>
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

    // Extracts the leading number out of a free-text area field like
    // "1,450 sq.ft" or "2400 sqft" → 1450. Returns null when nothing
    // numeric can be found (so it can be excluded rather than
    // mis-parsed when an Area filter is active).
    function parseAreaNumber(text) {
        if (!text) return null;
        const match = String(text).replace(/,/g, "").match(/(\d+(\.\d+)?)/);
        return match ? parseFloat(match[1]) : null;
    }

    // Fixed-order category/facing labels for a readable Recent Search
    // entry — falls back to the raw value if a mapping isn't found.
    const CATEGORY_LABELS = {
        residential: "Residential", apartments: "Apartments", villas: "Villas",
        commercial: "Commercial", land: "Land & Plots", investment: "Investment",
        industrial: "Industrial", special_purpose: "Special Purpose", agricultural: "Agricultural"
    };

    function recordCurrentSearch(state) {
        if (!window.AventrixRecentSearches) return;

        const hasFilter = state.location || state.category || state.subType || state.listingType ||
            state.priceMin || state.priceMax || state.bedrooms || state.bathrooms ||
            state.areaMin || state.areaMax || state.facing || state.furnishing ||
            state.parking || state.roadWidthMin;
        if (!hasFilter) return; // an empty/default search isn't worth remembering

        const parts = [];
        if (state.bedrooms) parts.push(`${state.bedrooms}+ BHK`);
        parts.push(CATEGORY_LABELS[state.category] || (state.category ? state.category : "Properties"));
        if (state.location) parts.push("in " + state.location);
        if (state.priceMin || state.priceMax) {
            parts.push(state.priceMin && state.priceMax ? `₹${state.priceMin}–₹${state.priceMax}`
                : state.priceMin ? `₹${state.priceMin}+` : `Up to ₹${state.priceMax}`);
        } else if (state.listingType) {
            parts.push(state.listingType === "sale" ? "(Buy)" : "(Lease)");
        }

        window.AventrixRecentSearches.record({
            url: window.location.pathname + window.location.search,
            label: parts.join(" ")
        });

        renderRecentSearchWidget();
    }

    function renderRecentSearchWidget() {
        const RS = window.AventrixRecentSearches;
        if (!RS) return;
        const chipsEl = document.getElementById("sfRecentSearchesChips");
        const expandedEl = document.getElementById("sfRecentSearchesExpanded");
        RS.renderChips(chipsEl);
        if (expandedEl && !expandedEl.hidden) RS.renderExpandedList(expandedEl);
    }

    function initRecentSearchWidget() {
        const RS = window.AventrixRecentSearches;
        const chipsEl = document.getElementById("sfRecentSearchesChips");
        const expandedEl = document.getElementById("sfRecentSearchesExpanded");
        const allBtn = document.getElementById("sfAllRecentSearchesBtn");
        if (!RS || !chipsEl) return;

        RS.renderChips(chipsEl);

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

        document.addEventListener("aventrix:recent-searches-changed", () => RS.renderChips(chipsEl));
    }

    let debounceTimer = null;
    function debounce(fn, delay) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fn, delay);
    }

    async function fetchAndRender(pushHistory) {
        if (window.AventrixStorage) await window.AventrixStorage.ready;

        const state = readStateFromInputs();
        writeStateToUrl(state, !pushHistory);
        updateActiveChips(state);

        els.resultsCount.textContent = "Loading properties…";
        els.errorState.hidden = true;
        els.emptyState.hidden = true;
        els.resultsGrid.innerHTML = skeletonCardsHtml(6);

        if (!sb) {
            els.errorState.hidden = false;
            els.resultsCount.textContent = "";
            return;
        }

        let query = sb.from("properties").select("*").eq("publish_status", "Published");

        // "Residential" widens to also include the legacy "apartments" and
        // "villas" category values, since those are now Residential
        // sub-types in spirit — existing rows are never modified, this
        // only widens what the Residential filter matches. Every other
        // category value (including legacy land/investment reached via
        // an old bookmarked link) still does an exact match, unchanged
        // from before.
        if (state.category) {
            if (state.category === "residential") {
                query = query.in("category", ["residential", "apartments", "villas"]);
            } else {
                query = query.eq("category", state.category);
            }
        }

        // Sub-Type filter. "Apartment / Flat" and "Villa" also match the
        // pre-existing "apartments"/"villas" category rows (which predate
        // the sub_type column and will never have it backfilled
        // automatically), so selecting those sub-types still surfaces the
        // existing inventory. Every other sub-type is a plain column
        // match — only newly-tagged rows will have a value there.
        if (state.subType) {
            if (state.subType === "apartment_flat") {
                query = query.or("sub_type.eq.apartment_flat,category.eq.apartments");
            } else if (state.subType === "villa") {
                query = query.or("sub_type.eq.villa,category.eq.villas");
            } else {
                query = query.eq("sub_type", state.subType);
            }
        }

        if (state.listingType) query = query.eq("listing_type", state.listingType);
        if (state.bedrooms) query = query.gte("bedrooms", parseInt(state.bedrooms, 10));
        if (state.bathrooms) query = query.gte("bathrooms", parseInt(state.bathrooms, 10));
        if (state.priceMin) query = query.gte("price_value", parseFloat(state.priceMin));
        if (state.priceMax) query = query.lte("price_value", parseFloat(state.priceMax));
        if (state.location) query = query.ilike("location", `%${state.location}%`);
        if (state.facing) query = query.eq("facing", state.facing);
        if (state.furnishing) query = query.eq("furnishing", state.furnishing);
        if (state.parking) query = query.gte("parking", parseInt(state.parking, 10));

        if (state.sort === "price_low") {
            query = query.order("price_value", { ascending: true, nullsFirst: false });
        } else if (state.sort === "price_high") {
            query = query.order("price_value", { ascending: false, nullsFirst: false });
        } else if (state.sort === "newest") {
            query = query.order("created_at", { ascending: false });
        } else {
            // Recommended: featured first, then newest
            query = query.order("is_featured", { ascending: false })
                         .order("created_at", { ascending: false });
        }

        query = query.limit(RESULT_CAP);

        let { data, error } = await query;

        if (error) {
            els.errorState.hidden = false;
            els.resultsGrid.innerHTML = "";
            els.emptyState.hidden = true;
            els.resultsCount.textContent = "";
            return;
        }

        let properties = data || [];

        // Client-side Area filter (built_up_area has no numeric column).
        const areaMin = state.areaMin ? parseFloat(state.areaMin) : null;
        const areaMax = state.areaMax ? parseFloat(state.areaMax) : null;
        if (areaMin !== null || areaMax !== null) {
            properties = properties.filter((p) => {
                const val = parseAreaNumber(p.built_up_area);
                if (val === null) return false;
                if (areaMin !== null && val < areaMin) return false;
                if (areaMax !== null && val > areaMax) return false;
                return true;
            });
        }

        // Client-side Road Width filter — same reasoning as Area above:
        // road_width is free text (e.g. "30 ft"), no numeric column exists.
        const roadWidthMin = state.roadWidthMin ? parseFloat(state.roadWidthMin) : null;
        if (roadWidthMin !== null) {
            properties = properties.filter((p) => {
                const val = parseAreaNumber(p.road_width);
                return val !== null && val >= roadWidthMin;
            });
        }

        renderResults(properties);
        recordCurrentSearch(state);
    }

    function renderResults(properties) {
        if (!properties.length) {
            els.resultsGrid.innerHTML = "";
            els.emptyState.hidden = false;
            els.resultsCount.textContent = "0 properties found";
            return;
        }

        els.emptyState.hidden = true;
        els.resultsCount.textContent =
            properties.length === 1 ? "1 property found" : `${properties.length} properties found`;
        els.resultsGrid.innerHTML = properties.map(cardTemplate).join("");
        attachWishlistButtonListeners();
        attachShortlistButtonListeners();
    }

    // ---------------------------------------------------------
    // WISHLIST — heart button on every result card
    // ---------------------------------------------------------
    let wishlistListenerAttached = false;
    function attachWishlistButtonListeners() {
        if (!window.AventrixStorage || wishlistListenerAttached) return;
        wishlistListenerAttached = true;
        els.resultsGrid.addEventListener("click", (e) => {
            const btn = e.target.closest(".property-save-btn");
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            const slug = btn.getAttribute("data-slug");
            const nowSaved = window.AventrixStorage.wishlist.toggle(slug);
            btn.classList.toggle("saved", nowSaved);
            btn.setAttribute("aria-pressed", nowSaved ? "true" : "false");
            btn.setAttribute("aria-label", nowSaved ? "Remove from Wishlist" : "Save to Wishlist");
            const icon = btn.querySelector("i");
            if (icon) {
                icon.classList.toggle("fas", nowSaved);
                icon.classList.toggle("far", !nowSaved);
            }
        });
    }

    // ---------------------------------------------------------
    // SHORTLIST — icon button on every result card
    // ---------------------------------------------------------
    let shortlistListenerAttached = false;
    function attachShortlistButtonListeners() {
        if (!window.AventrixStorage || shortlistListenerAttached) return;
        shortlistListenerAttached = true;
        els.resultsGrid.addEventListener("click", (e) => {
            const btn = e.target.closest(".icon-shortlist-btn");
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            const slug = btn.getAttribute("data-slug");
            const nowActive = window.AventrixStorage.shortlist.toggle(slug);
            btn.classList.toggle("active", nowActive);
            btn.setAttribute("aria-pressed", nowActive ? "true" : "false");
            btn.setAttribute("aria-label", nowActive ? "Remove from Shortlist" : "Add to Shortlist");
            btn.setAttribute("title", nowActive ? "Shortlisted" : "Add to Shortlist");
        });
    }

    function updateActiveChips(state) {
        const chips = [];
        if (state.location) chips.push({ key: "location", label: `Location: ${state.location}` });
        if (state.category) chips.push({ key: "category", label: `Type: ${els.category.options[els.category.selectedIndex].text}` });
        if (state.subType) chips.push({ key: "subType", label: `Sub-Type: ${els.subType.options[els.subType.selectedIndex] ? els.subType.options[els.subType.selectedIndex].text : state.subType}` });
        if (state.listingType) chips.push({ key: "listingType", label: state.listingType === "sale" ? "Buy" : "Rent / Lease" });
        if (state.priceMin || state.priceMax) {
            const label = state.priceMin && state.priceMax ? `₹${state.priceMin} – ₹${state.priceMax}`
                : state.priceMin ? `₹${state.priceMin}+` : `Up to ₹${state.priceMax}`;
            chips.push({ key: "price", label: `Price: ${label}` });
        }
        if (state.bedrooms) chips.push({ key: "bedrooms", label: `${state.bedrooms}+ Beds` });
        if (state.bathrooms) chips.push({ key: "bathrooms", label: `${state.bathrooms}+ Baths` });
        if (state.areaMin || state.areaMax) {
            const label = state.areaMin && state.areaMax ? `${state.areaMin} – ${state.areaMax} sq.ft`
                : state.areaMin ? `${state.areaMin}+ sq.ft` : `Up to ${state.areaMax} sq.ft`;
            chips.push({ key: "area", label: `Area: ${label}` });
        }
        if (state.facing) chips.push({ key: "facing", label: `Facing: ${state.facing}` });
        if (state.furnishing) chips.push({ key: "furnishing", label: state.furnishing });
        if (state.parking) chips.push({ key: "parking", label: `${state.parking}+ Parking` });
        if (state.roadWidthMin) chips.push({ key: "roadWidthMin", label: `Road Width: ${state.roadWidthMin}+ ft` });

        els.activeChips.innerHTML = chips.map((c) =>
            `<button type="button" class="sf-chip" data-clear="${c.key}">${escapeHtml(c.label)} <i class="fas fa-times" aria-hidden="true"></i></button>`
        ).join("");

        if (els.activeCount) {
            if (chips.length) {
                els.activeCount.hidden = false;
                els.activeCount.textContent = String(chips.length);
            } else {
                els.activeCount.hidden = true;
            }
        }

        els.activeChips.querySelectorAll(".sf-chip").forEach((btn) => {
            btn.addEventListener("click", () => {
                clearFilter(btn.getAttribute("data-clear"));
                fetchAndRender(false);
            });
        });
    }

    function clearFilter(key) {
        switch (key) {
            case "location": els.location.value = ""; break;
            case "category": els.category.value = ""; populateSubTypeOptions("", ""); break;
            case "subType": els.subType.value = ""; break;
            case "listingType": els.listingType.value = ""; break;
            case "price": els.priceMin.value = ""; els.priceMax.value = ""; break;
            case "bedrooms": els.bedrooms.value = ""; break;
            case "bathrooms": els.bathrooms.value = ""; break;
            case "area": els.areaMin.value = ""; els.areaMax.value = ""; break;
            case "facing": els.facing.value = ""; break;
            case "furnishing": els.furnishing.value = ""; break;
            case "parking": els.parking.value = ""; break;
            case "roadWidthMin": els.roadWidthMin.value = ""; break;
        }
    }

    function clearAllFilters() {
        els.location.value = "";
        els.category.value = "";
        populateSubTypeOptions("", "");
        els.listingType.value = "";
        els.priceMin.value = "";
        els.priceMax.value = "";
        els.bedrooms.value = "";
        els.bathrooms.value = "";
        els.areaMin.value = "";
        els.areaMax.value = "";
        els.facing.value = "";
        els.furnishing.value = "";
        els.parking.value = "";
        els.roadWidthMin.value = "";
        els.sort.value = "recommended";
        fetchAndRender(false);
    }

    // ---------------------------------------------------------
    // Mobile filter panel (slide-in sheet, matches site branding)
    // ---------------------------------------------------------
    function openPanel() {
        els.panel.classList.add("sf-panel-open");
        els.backdrop.classList.add("sf-backdrop-open");
        document.body.classList.add("sf-panel-locked");
    }
    function closePanel() {
        els.panel.classList.remove("sf-panel-open");
        els.backdrop.classList.remove("sf-backdrop-open");
        document.body.classList.remove("sf-panel-locked");
    }

    if (els.mobileToggle) els.mobileToggle.addEventListener("click", openPanel);
    if (els.filterClose) els.filterClose.addEventListener("click", closePanel);
    if (els.backdrop) els.backdrop.addEventListener("click", closePanel);
    if (els.applyBtn) els.applyBtn.addEventListener("click", () => { closePanel(); fetchAndRender(true); });

    // ---------------------------------------------------------
    // Wire inputs
    // ---------------------------------------------------------
    els.category.addEventListener("change", () => {
        populateSubTypeOptions(els.category.value, "");
        fetchAndRender(true);
    });

    [els.subType, els.listingType, els.bedrooms, els.bathrooms, els.facing, els.furnishing, els.parking, els.sort].forEach((el) => {
        el.addEventListener("change", () => fetchAndRender(true));
    });

    [els.location, els.priceMin, els.priceMax, els.areaMin, els.areaMax, els.roadWidthMin].forEach((el) => {
        el.addEventListener("input", () => debounce(() => fetchAndRender(true), 450));
    });

    els.clearBtn.addEventListener("click", clearAllFilters);
    els.emptyClearBtn.addEventListener("click", clearAllFilters);

    window.addEventListener("popstate", () => {
        applyStateToInputs(readStateFromUrl());
        fetchAndRender(false);
    });

    // ---------------------------------------------------------
    // Initial load — seeded from URL (supports deep links and the
    // homepage hero search form).
    // ---------------------------------------------------------
    // Exposed so js/near-me.js can reuse the exact same card markup for
    // its own "Properties Near You" results rather than duplicating it.
    window.AventrixPropertyCard = cardTemplate;

    initRecentSearchWidget();

    const initialState = readStateFromUrl();
    applyStateToInputs(initialState);
    fetchAndRender(false);
})();
