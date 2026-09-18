/*
 * AVENTRIX REALTY — "PROPERTIES NEAR ME" DISCOVERY
 * ---------------------------------------------------
 * Runs on properties.html only. Uses the browser's native Geolocation
 * API (never a fake permission dialog) to find properties in nearby
 * Chennai localities.
 *
 * IMPORTANT — architecture note for Phase 2B:
 * Individual properties do NOT yet have their own latitude/longitude
 * (that is a Phase 2B schema change, not made here). This feature
 * therefore approximates "nearby" using a static, hand-maintained
 * reference table of well-known Chennai locality center coordinates
 * (public geography, not property-specific data) matched against each
 * property's existing free-text `location` field. Distance shown is
 * the distance to that locality's approximate center, not to the
 * exact property — this is stated in the UI copy, never presented as
 * precise. Once Phase 2B adds real per-property coordinates, the same
 * sortByDistance()/haversine() functions here can be fed real
 * property coordinates directly — no architecture change needed, only
 * a data source swap.
 *
 * Privacy: the user's coordinates are held in memory only for the
 * current page view. Nothing is written to localStorage, sessionStorage,
 * or Supabase. Reloading the page clears it — the user must opt in again.
 */

(function () {
    const sb = window.supabaseClient;
    const widget = document.getElementById("nearMeWidget");
    const trigger = document.getElementById("nearMeTrigger");
    if (!widget || !trigger) return; // not on properties.html

    // Approximate center coordinates for well-known Chennai localities.
    // Public geographic reference data, not property-specific — see
    // the architecture note above. Matched against `properties.location`
    // via a case-insensitive substring check.
    const CHENNAI_AREAS = [
        { name: "Egmore", lat: 13.0732, lng: 80.2609 },
        { name: "Nungambakkam", lat: 13.0569, lng: 80.2425 },
        { name: "T. Nagar", lat: 13.0418, lng: 80.2341 },
        { name: "T Nagar", lat: 13.0418, lng: 80.2341 },
        { name: "Mylapore", lat: 13.0339, lng: 80.2619 },
        { name: "Royapettah", lat: 13.0524, lng: 80.2636 },
        { name: "Alwarpet", lat: 13.0339, lng: 80.2547 },
        { name: "Chetpet", lat: 13.0714, lng: 80.2422 },
        { name: "Kilpauk", lat: 13.0827, lng: 80.2372 },
        { name: "Kolathur", lat: 13.1189, lng: 80.2196 },
        { name: "Chromepet", lat: 12.9516, lng: 80.1462 },
        { name: "Pallavaram", lat: 12.9675, lng: 80.1491 },
        { name: "Old Pallavaram", lat: 12.9675, lng: 80.1491 },
        { name: "Tambaram", lat: 12.9249, lng: 80.1000 },
        { name: "Velachery", lat: 12.9750, lng: 80.2200 },
        { name: "Guindy", lat: 13.0100, lng: 80.2200 },
        { name: "Adyar", lat: 13.0067, lng: 80.2572 },
        { name: "Medavakkam", lat: 12.9186, lng: 80.1878 },
        { name: "Perungudi", lat: 12.9647, lng: 80.2422 },
        { name: "Thoraipakkam", lat: 12.9401, lng: 80.2377 },
        { name: "Karapakkam", lat: 12.9280, lng: 80.2350 },
        { name: "Sholinganallur", lat: 12.9010, lng: 80.2279 },
        { name: "Navalur", lat: 12.8406, lng: 80.2277 },
        { name: "Siruseri", lat: 12.8236, lng: 80.2270 },
        { name: "Meenambakkam", lat: 12.9950, lng: 80.1700 },
        { name: "Nanganallur", lat: 12.9834, lng: 80.1755 },
        { name: "St. Thomas Mount", lat: 13.0016, lng: 80.1978 },
        { name: "Boat Club Road", lat: 13.0060, lng: 80.2540 },
        { name: "Poes Garden", lat: 13.0402, lng: 80.2495 },
        { name: "R.A. Puram", lat: 13.0330, lng: 80.2570 },
        { name: "Besant Nagar", lat: 12.9990, lng: 80.2668 },
        { name: "Thiruvanmiyur", lat: 12.9830, lng: 80.2593 },
        { name: "Palavakkam", lat: 12.9560, lng: 80.2530 },
        { name: "Neelankarai", lat: 12.9370, lng: 80.2500 },
        { name: "Injambakkam", lat: 12.9130, lng: 80.2470 },
        { name: "Akkarai", lat: 12.9000, lng: 80.2460 },
        { name: "Uthandi", lat: 12.8760, lng: 80.2430 },
        { name: "Kanathur", lat: 12.8580, lng: 80.2410 },
        { name: "Muttukadu", lat: 12.8158, lng: 80.2493 },
        { name: "Maraimalai Nagar", lat: 12.7924, lng: 80.0134 },
        { name: "Urapakkam", lat: 12.8503, lng: 80.0777 },
        { name: "Guduvanchery", lat: 12.8406, lng: 80.0678 },
        { name: "Kundrathur", lat: 13.0006, lng: 80.0894 },
        { name: "Ponmar", lat: 12.8747, lng: 80.1651 },
        { name: "Kelambakkam", lat: 12.7935, lng: 80.2179 },
        { name: "Vandalur", lat: 12.8927, lng: 80.0817 }
    ];

    const RADIUS_OPTIONS = [1, 5, 10, 25];
    let selectedRadius = 10;
    let userCoords = null; // in-memory only, never persisted
    let deniedThisSession = false;

    // ---------------------------------------------------------
    // Haversine distance in km — reusable as-is once real
    // per-property coordinates exist in a future phase.
    // ---------------------------------------------------------
    function haversineKm(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function nearestAreasWithinRadius(lat, lng, radiusKm) {
        return CHENNAI_AREAS
            .map((a) => ({ ...a, distanceKm: haversineKm(lat, lng, a.lat, a.lng) }))
            .filter((a) => a.distanceKm <= radiusKm)
            .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    // ---------------------------------------------------------
    // UI states
    // ---------------------------------------------------------
    function renderCollapsed() {
        widget.innerHTML = `
            <button type="button" class="near-me-trigger" id="nearMeTrigger">
                <i class="fas fa-location-crosshairs" aria-hidden="true"></i>
                <span>Properties Near Me</span>
            </button>`;
        widget.querySelector("#nearMeTrigger").addEventListener("click", renderExplainer);
    }

    function renderExplainer() {
        widget.innerHTML = `
            <div class="near-me-panel">
                <p class="near-me-copy">
                    <i class="fas fa-location-dot" aria-hidden="true"></i>
                    Find properties near your current location.
                </p>
                <div class="near-me-actions">
                    <button type="button" class="near-me-allow-btn" id="nearMeAllowBtn">Allow Location Access</button>
                    <button type="button" class="near-me-cancel-btn" id="nearMeCancelBtn">Cancel</button>
                </div>
            </div>`;
        widget.querySelector("#nearMeAllowBtn").addEventListener("click", requestLocation);
        widget.querySelector("#nearMeCancelBtn").addEventListener("click", renderCollapsed);
    }

    function renderRequesting() {
        widget.innerHTML = `
            <div class="near-me-panel">
                <p class="near-me-copy"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Waiting for location permission…</p>
            </div>`;
    }

    function renderDenied(message) {
        deniedThisSession = true;
        widget.innerHTML = `
            <div class="near-me-panel near-me-fallback">
                <p class="near-me-copy"><i class="fas fa-circle-info" aria-hidden="true"></i> ${escapeHtml(message)}</p>
            </div>`;
        // Collapse back to the plain trigger after a moment, so the
        // fallback message doesn't sit forever — the user can still
        // search by location manually via the existing filters below.
        setTimeout(() => { if (!userCoords) renderCollapsed(); }, 4500);
    }

    async function renderResults() {
        widget.innerHTML = `
            <div class="near-me-panel near-me-results-panel">
                <div class="near-me-results-header">
                    <h3><i class="fas fa-location-crosshairs" aria-hidden="true"></i> Properties Near You</h3>
                    <button type="button" class="near-me-clear-btn" id="nearMeClearBtn">Clear</button>
                </div>
                <div class="near-me-radius-row" id="nearMeRadiusRow">
                    ${RADIUS_OPTIONS.map((r) => `<button type="button" class="near-me-radius-chip${r === selectedRadius ? " active" : ""}" data-radius="${r}">${r} km</button>`).join("")}
                </div>
                <p class="near-me-note">Showing localities within ${selectedRadius} km of your current location. Distance shown is to each locality's centre, not the exact property.</p>
                <div class="near-me-grid" id="nearMeGrid">
                    <div class="near-me-skeleton-row">${skeletonCardsHtml(3)}</div>
                </div>
            </div>`;

        widget.querySelector("#nearMeClearBtn").addEventListener("click", () => {
            userCoords = null;
            renderCollapsed();
        });
        widget.querySelectorAll(".near-me-radius-chip").forEach((chip) => {
            chip.addEventListener("click", () => {
                selectedRadius = parseInt(chip.getAttribute("data-radius"), 10);
                renderResults();
            });
        });

        await loadNearbyProperties();
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

    async function loadNearbyProperties() {
        const gridEl = document.getElementById("nearMeGrid");
        if (!gridEl || !userCoords || !sb) return;

        const nearby = nearestAreasWithinRadius(userCoords.lat, userCoords.lng, selectedRadius);

        if (!nearby.length) {
            gridEl.innerHTML = `<p class="near-me-empty">No known localities within ${selectedRadius} km. Try a larger radius, or search by location manually below.</p>`;
            return;
        }

        // OR filter across every nearby locality name against the
        // existing free-text `location` column — same field the
        // manual Location filter already searches.
        const orClause = nearby.map((a) => `location.ilike.%${a.name}%`).join(",");

        let { data, error } = await sb
            .from("properties")
            .select("*")
            .eq("publish_status", "Published")
            .or(orClause)
            .limit(60);

        if (error || !data || !data.length) {
            gridEl.innerHTML = `<p class="near-me-empty">No published properties found near you yet within ${selectedRadius} km. Try a larger radius, or search by location manually below.</p>`;
            return;
        }

        // Attach each property's nearest matched locality's distance,
        // for sorting and display, then sort by that approximate distance.
        const withDistance = data.map((p) => {
            const match = nearby.find((a) => (p.location || "").toLowerCase().includes(a.name.toLowerCase()));
            return { property: p, distanceKm: match ? match.distanceKm : selectedRadius };
        }).sort((a, b) => a.distanceKm - b.distanceKm);

        gridEl.innerHTML = withDistance.map(({ property, distanceKm }) =>
            (window.AventrixPropertyCard ? window.AventrixPropertyCard(property) : "")
                .replace('class="property-card"', `class="property-card" data-near-distance="${distanceKm.toFixed(1)}"`)
        ).join("");

        // Small "~X km" pill on each card, appended after render so the
        // shared card template itself doesn't need a near-me-specific
        // parameter — keeps that template unchanged.
        gridEl.querySelectorAll(".property-card").forEach((card) => {
            const km = card.getAttribute("data-near-distance");
            if (!km) return;
            const pill = document.createElement("span");
            pill.className = "near-me-distance-pill";
            pill.textContent = `~${km} km`;
            const imageWrap = card.querySelector(".property-image-wrap");
            if (imageWrap) imageWrap.appendChild(pill);
        });

        attachCardListeners(gridEl);
    }

    function attachCardListeners(gridEl) {
        if (!window.AventrixStorage) return;
        gridEl.addEventListener("click", (e) => {
            const saveBtn = e.target.closest(".property-save-btn");
            if (saveBtn) {
                e.preventDefault();
                const slug = saveBtn.getAttribute("data-slug");
                const nowSaved = window.AventrixStorage.wishlist.toggle(slug);
                saveBtn.classList.toggle("saved", nowSaved);
                saveBtn.setAttribute("aria-pressed", nowSaved ? "true" : "false");
                const icon = saveBtn.querySelector("i");
                if (icon) { icon.classList.toggle("fas", nowSaved); icon.classList.toggle("far", !nowSaved); }
                return;
            }
            const shortlistBtn = e.target.closest(".icon-shortlist-btn");
            if (shortlistBtn) {
                e.preventDefault();
                const slug = shortlistBtn.getAttribute("data-slug");
                const nowActive = window.AventrixStorage.shortlist.toggle(slug);
                shortlistBtn.classList.toggle("active", nowActive);
                shortlistBtn.setAttribute("aria-pressed", nowActive ? "true" : "false");
            }
        });
    }

    // ---------------------------------------------------------
    // Geolocation — only ever triggered by the user's own click on
    // "Allow Location Access" above. Never called on page load, and
    // never re-prompted automatically after a denial in this session.
    // ---------------------------------------------------------
    function requestLocation() {
        if (deniedThisSession) return; // don't nag after a denial this session
        if (!("geolocation" in navigator)) {
            renderDenied("Location isn't supported in this browser. You can search by location manually below.");
            return;
        }

        renderRequesting();

        navigator.geolocation.getCurrentPosition(
            (position) => {
                userCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
                selectedRadius = 10;
                renderResults();
            },
            (error) => {
                let message = "Location access was not enabled. You can search by location manually.";
                if (error.code === error.TIMEOUT) {
                    message = "Location request timed out. You can search by location manually.";
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    message = "Your location couldn't be determined right now. You can search by location manually.";
                }
                renderDenied(message);
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
    }

    trigger.addEventListener("click", renderExplainer);
})();
