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
            .limit(100);

        let properties = featured;

        if (!properties || properties.length === 0) {
            const { data: recent } = await sb
                .from("properties")
                .select("*")
                .eq("publish_status", "Published")
                .order("created_at", { ascending: false })
                .limit(100);
            properties = recent || [];
        }

        if (properties.length === 0) {
            gridEl.innerHTML = "";
            return;
        }

        gridEl.innerHTML = properties.map(cardTemplate).join("");

        properties.forEach((p) => { propertiesBySlug[p.slug] = p; });

        attachScrollSaveListeners(gridEl);
        attachQuickViewListeners(gridEl);
        restoreScrollIfReturning();
    }

    // ---------------------------------------------------------
    // BACK NAVIGATION / SCROLL POSITION
    // Lets a user who opens a property from the grid, then presses
    // Back, land on this same scroll position instead of the top of
    // the homepage. See js/public-properties.js + script.js together.
    // ---------------------------------------------------------
    const SCROLL_KEY = "aventrix:lastScrollY";
    const SCROLL_PAGE_KEY = "aventrix:lastScrollPage";

    function currentPageKey() {
        return location.pathname + location.search + location.hash;
    }

    function attachScrollSaveListeners(gridEl) {
        // Delegated so it keeps working after the grid re-renders.
        gridEl.addEventListener("click", (e) => {
            const link = e.target.closest('a[href^="property.html"]');
            if (!link) return;
            try {
                sessionStorage.setItem(SCROLL_KEY, String(window.scrollY || window.pageYOffset || 0));
                sessionStorage.setItem(SCROLL_PAGE_KEY, currentPageKey());
            } catch (err) { /* sessionStorage unavailable — degrade silently */ }
        });
    }

    function cameFromBackForward() {
        try {
            const nav = performance.getEntriesByType &&
                performance.getEntriesByType("navigation")[0];
            if (nav) return nav.type === "back_forward";
        } catch (err) { /* fall through */ }
        // Fallback for browsers without the Navigation Timing API.
        return document.referrer.indexOf("property.html") !== -1;
    }

    function restoreScrollIfReturning() {
        let savedY, savedPage;
        try {
            savedY = sessionStorage.getItem(SCROLL_KEY);
            savedPage = sessionStorage.getItem(SCROLL_PAGE_KEY);
        } catch (err) {
            return;
        }
        if (savedY === null || savedPage !== currentPageKey()) return;
        if (!cameFromBackForward()) return;

        // Wait for images inside the just-rendered grid to lay out
        // before restoring, so the position doesn't get restored and
        // then immediately jump as lazy content finishes loading.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                window.scrollTo(0, parseInt(savedY, 10) || 0);
            });
        });
    }

    // Shared contact number for the Call / WhatsApp quick-action buttons
    // on every property card.
    const CARD_PHONE_TEL = "+919176887770";
    const CARD_WHATSAPP_URL = "https://wa.me/919176887770";

    // Populated as each grid renders so the Quick View overlay can look
    // a property up by slug without a second network round-trip.
    const propertiesBySlug = {};

    function cardTemplate(p) {
        const image = p.featured_image || (p.images && p.images[0]) || "images/property1.jpg";
        return `
            <div class="property-card" data-slug="${escapeHtml(p.slug)}">
                <div class="property-image-wrap">
                    <img src="${escapeHtml(image)}" alt="${escapeHtml(p.title)}" loading="lazy">
                    <span class="property-badge ${badgeClass(p.listing_type)}">${formatBadge(p.listing_type)}</span>
                    <button class="property-share-btn" aria-label="Share this property"><i class="fas fa-share-alt" aria-hidden="true"></i></button>
                    <button type="button" class="qv-hover-cta" aria-label="Quick view ${escapeHtml(p.title)}">Quick View</button>
                </div>
                <div class="content">
                    <span class="property-location"><i class="fas fa-map-marker-alt" aria-hidden="true"></i> ${escapeHtml(p.location || "")}</span>
                    <h3>${escapeHtml(p.title)}</h3>
                    <p>${escapeHtml(p.short_description || "")}</p>
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

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    // ---------------------------------------------------------
    // PROPERTY QUICK VIEW OVERLAY
    // Opened by tapping/clicking a property card. property.html
    // itself is never touched — this only changes the card's
    // interaction layer, per spec.
    // ---------------------------------------------------------
    let qvSiteSettings = null; // { phone, whatsapp, reraNo } — fetched once, lazily
    let qvOverlayEl = null;
    let qvScrollY = 0;
    let qvHistoryPushed = false;
    let qvCurrentProperty = null;
    let qvGalleryImages = [];
    let qvGalleryIndex = 0;

    async function getSiteSettingsForQuickView() {
        if (qvSiteSettings) return qvSiteSettings;
        let data = null;
        try {
            const res = await sb.from("site_settings")
                .select("realtor_phone_1, whatsapp_number, rera_registration_no")
                .eq("id", 1)
                .maybeSingle();
            data = res.data;
        } catch (err) { /* fall back to card defaults below */ }

        qvSiteSettings = {
            phone: (data && data.realtor_phone_1) || CARD_PHONE_TEL,
            whatsapp: (data && data.whatsapp_number) || "919176887770",
            reraNo: (data && data.rera_registration_no) || "TN/Agent/0284/2026"
        };
        return qvSiteSettings;
    }

    function attachQuickViewListeners(gridEl) {
        gridEl.addEventListener("click", (e) => {
            // Let the card's own quick-action links behave normally —
            // Call, WhatsApp, and the share button aren't part of the
            // Quick View flow.
            if (e.target.closest(".icon-action-btn") || e.target.closest(".property-share-btn")) {
                return;
            }
            const card = e.target.closest(".property-card");
            if (!card) return;

            e.preventDefault();
            const slug = card.getAttribute("data-slug");
            const property = propertiesBySlug[slug];
            if (property) openQuickView(property);
        });
    }

    function buildQuickViewMarkup() {
        if (qvOverlayEl) return qvOverlayEl;

        const el = document.createElement("div");
        el.className = "qv-overlay";
        el.id = "qvOverlay";
        el.innerHTML = `
            <div class="qv-backdrop"></div>
            <div class="qv-sheet" role="dialog" aria-modal="true" aria-label="Property quick view">
                <button type="button" class="qv-close" aria-label="Close">&times;</button>
                <div class="qv-gallery">
                    <div class="qv-gallery-track"></div>
                    <div class="qv-gallery-dots"></div>
                    <div class="qv-gallery-count"></div>
                </div>
                <div class="qv-body">
                    <span class="qv-badge"></span>
                    <h2 class="qv-title"></h2>
                    <p class="qv-location"></p>
                    <div class="qv-price"></div>
                    <div class="qv-stats"></div>
                    <div class="qv-section qv-overview">
                        <h3>Property Overview</h3>
                        <p class="qv-desc"></p>
                        <button type="button" class="qv-readmore" hidden>Read More</button>
                    </div>
                    <div class="qv-section qv-features" hidden>
                        <h3>Key Features</h3>
                        <ul></ul>
                    </div>
                    <div class="qv-section qv-brokerage" hidden>
                        <h3>Brokerage</h3>
                        <p></p>
                    </div>
                    <div class="qv-section qv-rera">
                        <h3>RERA Registered Real Estate Agent</h3>
                        <p class="qv-rera-authority">Tamil Nadu Real Estate Regulatory Authority</p>
                        <p class="qv-rera-no">Registration No. <strong></strong></p>
                    </div>
                </div>
                <div class="qv-actions">
                    <a href="#" class="qv-call" aria-label="Call"><i class="fas fa-phone-alt" aria-hidden="true"></i> Call</a>
                    <a href="#" class="qv-whatsapp" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><i class="fab fa-whatsapp" aria-hidden="true"></i> WhatsApp</a>
                </div>
            </div>`;

        document.body.appendChild(el);
        qvOverlayEl = el;
        wireQuickViewControls(el);
        return el;
    }

    function wireQuickViewControls(el) {
        el.querySelector(".qv-close").addEventListener("click", () => closeQuickView());
        el.querySelector(".qv-backdrop").addEventListener("click", () => closeQuickView());

        el.querySelector(".qv-readmore").addEventListener("click", (e) => {
            const desc = el.querySelector(".qv-desc");
            const expanded = desc.classList.toggle("expanded");
            e.target.textContent = expanded ? "Read Less" : "Read More";
        });

        const track = el.querySelector(".qv-gallery-track");
        track.addEventListener("scroll", () => {
            if (!qvGalleryImages.length) return;
            const idx = Math.round(track.scrollLeft / track.clientWidth);
            updateGalleryDots(Math.min(idx, qvGalleryImages.length - 1));
        }, { passive: true });

        window.addEventListener("popstate", () => {
            if (qvOverlayEl && qvOverlayEl.classList.contains("active")) {
                closeQuickView(true);
            }
        });
    }

    function lockScrollForQuickView() {
        qvScrollY = window.scrollY || window.pageYOffset || 0;
        document.body.classList.add("qv-open");
        document.body.style.top = "-" + qvScrollY + "px";
    }

    function unlockScrollForQuickView() {
        document.body.classList.remove("qv-open");
        document.body.style.top = "";
        window.scrollTo(0, qvScrollY);
    }

    async function openQuickView(property) {
        const el = buildQuickViewMarkup();
        qvCurrentProperty = property;
        populateQuickView(el, property);

        const settings = await getSiteSettingsForQuickView();
        const phoneDigits = settings.phone.replace(/\s+/g, "");
        el.querySelector(".qv-call").setAttribute("href", "tel:" + phoneDigits);
        const waMessage = encodeURIComponent(
            `Hi Aventrix Realty, I am interested in ${property.title}. Please share more details.`
        );
        el.querySelector(".qv-whatsapp").setAttribute(
            "href", `https://wa.me/${settings.whatsapp}?text=${waMessage}`
        );
        el.querySelector(".qv-rera-no strong").textContent = settings.reraNo;

        lockScrollForQuickView();
        el.classList.add("active");
        history.pushState({ quickView: true }, "");
        qvHistoryPushed = true;
    }

    function closeQuickView(fromPopState) {
        if (!qvOverlayEl || !qvOverlayEl.classList.contains("active")) return;
        qvOverlayEl.classList.remove("active");
        unlockScrollForQuickView();
        qvCurrentProperty = null;

        if (qvHistoryPushed && !fromPopState) {
            qvHistoryPushed = false;
            history.back();
        } else {
            qvHistoryPushed = false;
        }
    }

    function populateQuickView(el, p) {
        // Gallery
        qvGalleryImages = (p.images && p.images.length ? p.images : null) ||
            (p.featured_image ? [p.featured_image] : ["images/property1.jpg"]);
        qvGalleryIndex = 0;
        const track = el.querySelector(".qv-gallery-track");
        track.scrollLeft = 0;
        track.innerHTML = qvGalleryImages.map((src) =>
            `<img src="${escapeHtml(src)}" alt="${escapeHtml(p.title)}" loading="lazy">`
        ).join("");

        const dotsWrap = el.querySelector(".qv-gallery-dots");
        const countEl = el.querySelector(".qv-gallery-count");
        if (qvGalleryImages.length > 1) {
            dotsWrap.style.display = "flex";
            dotsWrap.innerHTML = qvGalleryImages.map((_, i) =>
                `<span class="${i === 0 ? "active" : ""}"></span>`
            ).join("");
            countEl.style.display = "block";
            countEl.textContent = `1 / ${qvGalleryImages.length}`;
        } else {
            dotsWrap.style.display = "none";
            countEl.style.display = "none";
        }

        // Listing type / badge
        el.querySelector(".qv-badge").textContent = formatBadge(p.listing_type);

        // Title / location / price
        el.querySelector(".qv-title").textContent = p.title || "";
        const locationEl = el.querySelector(".qv-location");
        if (p.location) {
            locationEl.textContent = "📍 " + p.location;
            locationEl.hidden = false;
        } else {
            locationEl.hidden = true;
        }
        el.querySelector(".qv-price").textContent = p.price_display || "Contact for Price";

        // Stats — only fields that actually have a value are shown.
        const statDefs = [
            { value: p.bedrooms, label: p.bedrooms === 1 ? "Bed" : "Beds" },
            { value: p.bathrooms, label: p.bathrooms === 1 ? "Bath" : "Baths" },
            { value: p.parking, label: "Parking" },
            { value: p.floors, label: p.floors === 1 ? "Floor" : "Floors" },
            { value: p.built_up_area, label: "Built-up Area" },
            { value: p.land_area, label: "Land Area" },
            { value: p.road_width, label: "Road Width" },
            { value: p.rental_income, label: "Rental Income" }
        ].filter((s) => s.value !== null && s.value !== undefined && s.value !== "");

        const statsEl = el.querySelector(".qv-stats");
        if (statDefs.length) {
            statsEl.style.display = "grid";
            statsEl.innerHTML = statDefs.map((s) => `
                <div class="qv-stat">
                    <span class="qv-stat-value">${escapeHtml(String(s.value))}</span>
                    <span class="qv-stat-label">${escapeHtml(s.label)}</span>
                </div>`).join("");
        } else {
            statsEl.style.display = "none";
            statsEl.innerHTML = "";
        }

        // Overview
        const descEl = el.querySelector(".qv-desc");
        const readMoreBtn = el.querySelector(".qv-readmore");
        const description = p.description || p.short_description || "";
        descEl.textContent = description;
        descEl.classList.remove("expanded");
        readMoreBtn.textContent = "Read More";
        // Only offer Read More once we know the text is long enough to
        // realistically be clamped (avoids showing it for short blurbs).
        readMoreBtn.hidden = description.length < 220;

        // Key features
        const featuresSection = el.querySelector(".qv-features");
        const featuresList = featuresSection.querySelector("ul");
        if (Array.isArray(p.features) && p.features.length) {
            featuresSection.hidden = false;
            featuresList.innerHTML = p.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("");
        } else {
            featuresSection.hidden = true;
            featuresList.innerHTML = "";
        }

        // Brokerage — only when configured
        const brokerageSection = el.querySelector(".qv-brokerage");
        if (p.brokerage) {
            brokerageSection.hidden = false;
            brokerageSection.querySelector("p").textContent = p.brokerage;
        } else {
            brokerageSection.hidden = true;
        }
    }

    function updateGalleryDots(index) {
        if (!qvOverlayEl) return;
        qvGalleryIndex = index;
        qvOverlayEl.querySelectorAll(".qv-gallery-dots span").forEach((dot, i) => {
            dot.classList.toggle("active", i === index);
        });
        const countEl = qvOverlayEl.querySelector(".qv-gallery-count");
        if (countEl) countEl.textContent = `${index + 1} / ${qvGalleryImages.length}`;
    }

    // ---------------------------------------------------------
    // PROPERTY DETAIL PAGE: property.html
    // ---------------------------------------------------------
    const titleEl = document.getElementById("property-title");
    if (titleEl) {
        // Defensive reset: property.html must always render as a
        // completely normal, independent full page — never a leftover
        // Quick View overlay/modal state (e.g. from a bfcache restore
        // edge case). This is a no-op in the normal case since this
        // document never creates Quick View markup of its own.
        document.body.classList.remove("qv-open", "mobile-menu-open");
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        const strayOverlay = document.getElementById("qvOverlay");
        if (strayOverlay) strayOverlay.remove();

        renderPropertyDetail();
        wireBackNav();
        wireReadMore();
    }

    function wireReadMore() {
        const btn = document.getElementById("pdReadMoreBtn");
        const desc = document.getElementById("property-description");
        if (!btn || !desc) return;
        btn.addEventListener("click", () => {
            const expanded = desc.classList.toggle("expanded");
            btn.textContent = expanded ? "Read Less" : "Read More";
        });
    }

    // The Back to Properties control is always visible. When there's a
    // real internal listing page to return to, clicking it uses the
    // browser's own Back navigation (so the existing scroll-restore
    // logic on the listing page kicks in); otherwise — a property page
    // opened directly from Google/WhatsApp/an external link/bookmark —
    // it falls back to its plain href straight to the listing section.
    function wireBackNav() {
        const backNav = document.getElementById("propertyBackNav");
        if (!backNav) return;
        const cameFromSameSite = document.referrer &&
            document.referrer.indexOf(location.origin) === 0;
        const hasInternalHistory = window.history.length > 1 && cameFromSameSite;
        if (hasInternalHistory) {
            backNav.addEventListener("click", (e) => {
                e.preventDefault();
                history.back();
            });
        }
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

        const badgeEl = document.getElementById("pdBadge");
        if (badgeEl) badgeEl.textContent = formatBadge(property.listing_type);

        const priceEl = document.getElementById("property-price");
        if (priceEl) priceEl.textContent = property.price_display || "Contact for Price";

        const locationEl = document.getElementById("property-location");
        if (locationEl) {
            if (property.location) {
                locationEl.textContent = "📍 " + property.location;
                locationEl.style.display = "";
            } else {
                locationEl.style.display = "none";
            }
        }

        renderPropertyGallery(property);
        renderPropertySpecs(property);
        wirePropertyContactButtons(property);

        const descriptionEl = document.getElementById("property-description");
        const readMoreBtn = document.getElementById("pdReadMoreBtn");
        if (descriptionEl) {
            const description = property.description || "";
            descriptionEl.textContent = description;
            descriptionEl.classList.remove("expanded");
            if (readMoreBtn) {
                readMoreBtn.textContent = "Read More";
                readMoreBtn.hidden = description.length < 320;
            }
        }

        const featuresSection = document.getElementById("pdFeaturesSection");
        const featuresEl = document.getElementById("property-features");
        if (featuresEl && featuresSection) {
            if (Array.isArray(property.features) && property.features.length) {
                featuresSection.style.display = "";
                featuresEl.innerHTML = property.features.map((feature) => `
                    <li>
                        <span class="pd-feature-icon"><i class="fas ${featureIcon(feature)}" aria-hidden="true"></i></span>
                        <span class="pd-feature-label">${escapeHtml(feature)}</span>
                    </li>`).join("");
            } else {
                featuresSection.style.display = "none";
            }
        }

        const brokerageSection = document.getElementById("pdBrokerageSection");
        const trustRow = document.querySelector(".pd-trust-row");
        if (brokerageSection) {
            if (property.brokerage) {
                brokerageSection.style.display = "";
                document.getElementById("pdBrokerageText").textContent = property.brokerage;
                if (trustRow) trustRow.classList.remove("pd-trust-single");
            } else {
                brokerageSection.style.display = "none";
                if (trustRow) trustRow.classList.add("pd-trust-single");
            }
        }

        const reraNoEl = document.getElementById("pdReraNo");
        if (reraNoEl) {
            const settings = await getSiteSettingsForQuickView();
            reraNoEl.textContent = settings.reraNo;
        }

        // SEO — updates <title> and meta description/keywords without
        // touching any visible layout.
        if (property.seo_title) document.title = property.seo_title;
        setMeta("description", property.seo_description);
        setMeta("keywords", property.seo_keywords);
    }

    // Best-effort icon for a Key Feature, chosen from the feature's own
    // text via simple keyword matching (purely visual — never changes
    // or invents the feature text itself). Falls back to a plain
    // checkmark icon for anything that doesn't match a known keyword.
    function featureIcon(feature) {
        const f = String(feature || "").toLowerCase();
        const rules = [
            [/lift|elevator/, "fa-building"],
            [/cctv|camera|surveillance/, "fa-video"],
            [/security|guard|gated/, "fa-shield-halved"],
            [/modular kitchen|kitchen/, "fa-kitchen-set"],
            [/interior/, "fa-paint-roller"],
            [/wardrobe|closet/, "fa-box-archive"],
            [/metro water|water/, "fa-droplet"],
            [/borewell/, "fa-faucet-drip"],
            [/lighting|light/, "fa-lightbulb"],
            [/pooja/, "fa-place-of-worship"],
            [/terrace|garden|park\b/, "fa-tree"],
            [/parking|car/, "fa-car"],
            [/gym|fitness/, "fa-dumbbell"],
            [/swimming|pool/, "fa-person-swimming"],
            [/clubhouse/, "fa-building-columns"],
            [/power backup|generator/, "fa-bolt"],
            [/cmda|approved|dtcp/, "fa-stamp"],
            [/vaastu|vastu/, "fa-compass"],
            [/wifi|internet/, "fa-wifi"]
        ];
        for (const [pattern, icon] of rules) {
            if (pattern.test(f)) return icon;
        }
        return "fa-circle-check";
    }

    // Clean, text-free image gallery for the top of the Full Property
    // Details page — deliberately separate code from the Quick View's
    // gallery (even though the pattern is similar) so nothing here can
    // ever affect Quick View.
    function renderPropertyGallery(property) {
        const track = document.getElementById("pdGalleryTrack");
        const dotsWrap = document.getElementById("pdGalleryDots");
        const countEl = document.getElementById("pdGalleryCount");
        if (!track) return;

        const images = (property.images && property.images.length ? property.images : null) ||
            (property.featured_image ? [property.featured_image] : ["images/property1.jpg"]);

        track.innerHTML = images.map((src) =>
            `<img src="${escapeHtml(src)}" alt="${escapeHtml(property.title)}" loading="lazy">`
        ).join("");

        if (images.length > 1) {
            dotsWrap.style.display = "flex";
            dotsWrap.innerHTML = images.map((_, i) =>
                `<span class="${i === 0 ? "active" : ""}"></span>`
            ).join("");
            countEl.style.display = "block";
            countEl.textContent = `1 / ${images.length}`;

            track.addEventListener("scroll", () => {
                const idx = Math.min(
                    Math.round(track.scrollLeft / track.clientWidth),
                    images.length - 1
                );
                dotsWrap.querySelectorAll("span").forEach((dot, i) => {
                    dot.classList.toggle("active", i === idx);
                });
                countEl.textContent = `${idx + 1} / ${images.length}`;
            }, { passive: true });
        } else {
            dotsWrap.style.display = "none";
            countEl.style.display = "none";
        }
    }

    // Structured specification cards — only ever built from fields that
    // actually have a value, so a property missing some data never
    // shows an empty/fake card.
    function renderPropertySpecs(property) {
        const section = document.getElementById("pdSpecsSection");
        const grid = document.getElementById("pdSpecsGrid");
        if (!grid) return;

        const categoryLabels = {
            residential: "Residential",
            commercial: "Commercial",
            land: "Land & Plots",
            villas: "Luxury Villas",
            apartments: "Apartments",
            investment: "Investment"
        };

        const specDefs = [
            { value: categoryLabels[property.category] || property.category, label: "Property Type", icon: "fa-house" },
            { value: formatBadge(property.listing_type), label: "Listing Type", icon: "fa-tag" },
            { value: property.bedrooms, label: "Bedrooms", icon: "fa-bed" },
            { value: property.bathrooms, label: "Bathrooms", icon: "fa-bath" },
            { value: property.built_up_area, label: "Built-up Area", icon: "fa-ruler-combined" },
            { value: property.land_area, label: "Land Area", icon: "fa-tree" },
            { value: property.uds_area, label: "UDS Area", icon: "fa-draw-polygon" },
            { value: property.parking, label: "Parking", icon: "fa-car" },
            { value: property.furnishing, label: "Furnishing", icon: "fa-couch" },
            { value: property.facing, label: "Facing", icon: "fa-compass" },
            { value: property.floors, label: "Floors", icon: "fa-building" },
            { value: property.road_width, label: "Road Width", icon: "fa-road" },
            { value: property.rental_income, label: "Rental Income", icon: "fa-money-bill-wave" }
        ].filter((s) => s.value !== null && s.value !== undefined && s.value !== "");

        if (!specDefs.length) {
            if (section) section.style.display = "none";
            return;
        }

        if (section) section.style.display = "";
        grid.innerHTML = specDefs.map((s) => `
            <div class="pd-spec-card">
                <div class="pd-spec-icon"><i class="fas ${s.icon}" aria-hidden="true"></i></div>
                <div class="pd-spec-text">
                    <span class="pd-spec-label">${escapeHtml(s.label)}</span>
                    <span class="pd-spec-value">${escapeHtml(String(s.value))}</span>
                </div>
            </div>`).join("");
    }

    async function wirePropertyContactButtons(property) {
        const callBtn = document.getElementById("pdCallBtn");
        const waBtn = document.getElementById("pdWhatsappBtn");
        if (!callBtn && !waBtn) return;

        const settings = await getSiteSettingsForQuickView();

        if (callBtn) {
            callBtn.setAttribute("href", "tel:" + settings.phone.replace(/\s+/g, ""));
        }
        if (waBtn) {
            const waMessage = encodeURIComponent(
                `Hi Aventrix Realty, I am interested in ${property.title}. Please share more details.`
            );
            waBtn.setAttribute("href", `https://wa.me/${settings.whatsapp}?text=${waMessage}`);
        }
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
