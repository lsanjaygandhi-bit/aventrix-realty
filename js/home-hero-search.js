/*
 * AVENTRIX REALTY — HOMEPAGE HERO QUICK SEARCH
 * ---------------------------------------------
 * An entry point to the EXISTING search on properties.html, not a
 * search system of its own. It only:
 *   - keeps the Buy / Rent & Lease / All tabs in sync with the
 *     hidden listingType field and swaps the price presets
 *     (sale prices vs. monthly rent);
 *   - fills Property Sub-Type from the shared taxonomy
 *     (js/property-taxonomy.js) when a Property Type is chosen;
 *   - opens/closes Advanced Filters and counts how many are set;
 *   - on submit, sends the user to properties.html with the same
 *     query parameters, in the same order, that properties-search.js
 *     reads and writes (writeStateToUrl) -- empty fields omitted.
 * properties.html then runs the real query, shows the chips, sorting
 * and results, and records the Recent Search itself.
 * Without JavaScript the form still submits to properties.html with
 * the same field names.
 */
(function () {
    const form = document.getElementById("heroSearchForm");
    if (!form) return;

    const $ = (id) => document.getElementById(id);
    const els = {
        listingType: $("hsListingType"),
        location: $("hsLocation"),
        category: $("hsCategory"),
        subType: $("hsSubType"),
        priceMin: $("hsPriceMin"),
        priceMax: $("hsPriceMax"),
        priceLabel: $("hsPriceLabel"),
        beds: $("hsBeds"),
        baths: $("hsBaths"),
        areaMin: $("hsAreaMin"),
        areaMax: $("hsAreaMax"),
        facing: $("hsFacing"),
        furnishing: $("hsFurnishing"),
        parking: $("hsParking"),
        roadWidth: $("hsRoadWidth"),
        advanced: $("hsAdvanced"),
        advToggle: $("hsAdvToggle"),
        advCount: $("hsAdvCount"),
        reset: $("hsReset")
    };
    const tabs = Array.from(document.querySelectorAll(".hh-tab"));

    // ---------------------------------------------------------
    // Price presets. Values are plain rupees, exactly what
    // properties.html's Price Min/Max inputs take (compared against
    // properties.price_value). Rent listings store the monthly rent.
    // ---------------------------------------------------------
    const L = 100000, CR = 10000000;
    const SALE_PRICES = [
        [10 * L, "₹10 L"], [25 * L, "₹25 L"], [50 * L, "₹50 L"], [75 * L, "₹75 L"],
        [1 * CR, "₹1 Cr"], [2 * CR, "₹2 Cr"], [3 * CR, "₹3 Cr"], [5 * CR, "₹5 Cr"],
        [10 * CR, "₹10 Cr"], [25 * CR, "₹25 Cr"], [50 * CR, "₹50 Cr"]
    ];
    const RENT_PRICES = [
        [10000, "₹10 K"], [25000, "₹25 K"], [50000, "₹50 K"], [1 * L, "₹1 L"],
        [2 * L, "₹2 L"], [5 * L, "₹5 L"], [10 * L, "₹10 L"]
    ];

    function fillPriceOptions() {
        const isRent = els.listingType.value === "lease";
        const list = isRent ? RENT_PRICES : SALE_PRICES;
        [els.priceMin, els.priceMax].forEach((sel, i) => {
            sel.innerHTML = `<option value="">${i === 0 ? "Min" : "Max"}</option>` +
                list.map(([v, label]) => `<option value="${v}">${label}</option>`).join("");
            sel.value = "";
        });
        els.priceLabel.textContent = isRent ? "Monthly Rent (₹)" : "Price Range (₹)";
    }

    function setListingType(value) {
        const changed = els.listingType.value !== value;
        els.listingType.value = value;
        tabs.forEach((t) => {
            const on = t.dataset.listing === value;
            t.classList.toggle("is-active", on);
            t.setAttribute("aria-checked", on ? "true" : "false");
            t.tabIndex = on ? 0 : -1;
        });
        // Price scales differ (sale price vs monthly rent), so only
        // rebuild when switching between the two scales.
        if (changed) fillPriceOptions();
    }

    tabs.forEach((tab, i) => {
        tab.addEventListener("click", () => setListingType(tab.dataset.listing));
        // Arrow-key movement within the radio group.
        tab.addEventListener("keydown", (e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
            next.focus();
            setListingType(next.dataset.listing);
        });
    });

    // ---------------------------------------------------------
    // Property Type -> Sub-Type cascade (same behaviour as
    // properties.html: disabled until a type is chosen).
    // ---------------------------------------------------------
    const TYPE_SUBTYPES = (window.AventrixPropertyTaxonomy && window.AventrixPropertyTaxonomy.TYPE_SUBTYPES) || {};

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    function fillSubTypes() {
        const list = TYPE_SUBTYPES[els.category.value] || [];
        els.subType.innerHTML = '<option value="">' + (list.length ? "Any Sub-Type" : "Choose a Property Type first") + "</option>" +
            list.map((s) => `<option value="${s.value}">${escapeHtml(s.label)}</option>`).join("");
        els.subType.disabled = list.length === 0;
        updateAdvCount();
    }
    els.category.addEventListener("change", fillSubTypes);

    // ---------------------------------------------------------
    // Advanced Filters panel
    // ---------------------------------------------------------
    const ADVANCED_FIELDS = ["subType", "baths", "areaMin", "areaMax", "facing", "furnishing", "parking", "roadWidth"];

    function updateAdvCount() {
        let n = ADVANCED_FIELDS.filter((k) => els[k].value && !els[k].disabled).length;
        // Area min + max count as one filter.
        if (els.areaMin.value && els.areaMax.value) n -= 1;
        els.advCount.textContent = String(n);
        els.advCount.hidden = n === 0;
    }
    ADVANCED_FIELDS.forEach((k) => {
        els[k].addEventListener("change", updateAdvCount);
        els[k].addEventListener("input", updateAdvCount);
    });

    function setAdvancedOpen(open) {
        els.advanced.hidden = !open;
        els.advToggle.setAttribute("aria-expanded", open ? "true" : "false");
        els.advToggle.classList.toggle("is-open", open);
    }
    els.advToggle.addEventListener("click", () => {
        const open = els.advanced.hidden;
        setAdvancedOpen(open);
        if (open) els.subType.disabled ? els.baths.focus() : els.subType.focus();
    });

    els.reset.addEventListener("click", () => {
        form.reset();
        setListingType("sale");
        fillPriceOptions();
        fillSubTypes();
        els.location.focus();
    });

    // ---------------------------------------------------------
    // Submit -> properties.html (canonical parameter names/order,
    // matching properties-search.js writeStateToUrl()).
    // ---------------------------------------------------------
    function num(v) {
        const n = parseFloat(v);
        return isFinite(n) && n >= 0 ? String(n) : "";
    }

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        let priceMin = els.priceMin.value, priceMax = els.priceMax.value;
        if (priceMin && priceMax && Number(priceMin) > Number(priceMax)) {
            [priceMin, priceMax] = [priceMax, priceMin];
        }
        let areaMin = num(els.areaMin.value), areaMax = num(els.areaMax.value);
        if (areaMin && areaMax && Number(areaMin) > Number(areaMax)) {
            [areaMin, areaMax] = [areaMax, areaMin];
        }

        const pairs = [
            ["location", els.location.value.trim()],
            ["category", els.category.value],
            ["subtype", els.subType.disabled ? "" : els.subType.value],
            ["listingType", els.listingType.value],
            ["priceMin", priceMin],
            ["priceMax", priceMax],
            ["beds", els.beds.value],
            ["baths", els.baths.value],
            ["areaMin", areaMin],
            ["areaMax", areaMax],
            ["facing", els.facing.value],
            ["furnishing", els.furnishing.value],
            ["parking", els.parking.value],
            ["roadWidthMin", num(els.roadWidth.value)]
        ];
        const params = new URLSearchParams();
        pairs.forEach(([k, v]) => { if (v) params.set(k, v); });

        const qs = params.toString();
        window.location.href = "properties.html" + (qs ? "?" + qs : "");
    });

    // Initial state. Browsers can restore form values on Back, so
    // re-sync the tabs/price labels from whatever the fields hold.
    function init() {
        const restoredMin = els.priceMin.value, restoredMax = els.priceMax.value;
        const restoredListing = els.listingType.value;
        els.listingType.value = "__init__";
        setListingType(restoredListing === "lease" || restoredListing === "" ? restoredListing : "sale");
        if (restoredMin) els.priceMin.value = restoredMin;
        if (restoredMax) els.priceMax.value = restoredMax;
        const restoredSub = els.subType.value;
        fillSubTypes();
        if (restoredSub) els.subType.value = restoredSub;
        updateAdvCount();
        if (!els.advCount.hidden) setAdvancedOpen(true);
    }
    init();
    window.addEventListener("pageshow", (e) => { if (e.persisted) init(); });
})();
