/*
 * AVENTRIX REALTY — PUBLIC OFFICE LOCATIONS LOADER
 * ------------------------------------------------
 * Reads `office_locations` (ordered by display_order) and renders
 * office cards into any container with [data-offices-grid] on the
 * page — used by both the homepage "Our Office Locations" section
 * and the Contact page "Locate Our Offices" section. Head Office
 * always appears before branch offices per display_order (0, 1, ...),
 * so on desktop Head Office is left / Adyar Branch is right, and the
 * existing CSS grid stacks them naturally on mobile — no CSS changes
 * needed.
 *
 * Two render modes, chosen automatically per container:
 *   - "cards"  -> the office-card markup used on the homepage and
 *                 the Contact page's first "Our Offices" section
 *   - "map"    -> the office-card + embedded Google Map markup used
 *                 on the Contact page's "Locate Our Offices" section
 * Pick the mode with [data-offices-grid="cards"] or
 * [data-offices-grid="map"] on the container.
 */

(function () {
    const sb = window.supabaseClient;
    if (!sb) return;

    const containers = document.querySelectorAll("[data-offices-grid]");
    if (!containers.length) return;

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    function telHref(phone) {
        return "tel:" + String(phone || "").replace(/\s+/g, "");
    }

    function cardTemplate(o) {
        const badge = o.is_head_office ? `<span class="office-card-badge">Head Office</span>` : "";
        const cardClass = o.is_head_office ? "office-card office-card-head" : "office-card";
        const phoneLines = String(o.phone || "")
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => `<a href="${telHref(p)}" class="office-card-phone"><i class="fas fa-phone-alt" aria-hidden="true"></i> ${escapeHtml(p)}</a>`)
            .join("");
        const emailLine = o.email
            ? `<a href="mailto:${escapeHtml(o.email)}" class="office-card-phone"><i class="fas fa-envelope" aria-hidden="true"></i> ${escapeHtml(o.email)}</a>`
            : "";
        const mapsLinks = o.maps_url
            ? `<div class="qe-office-links">
                    <a href="${escapeHtml(o.maps_url)}" target="_blank" rel="noopener noreferrer" class="map-btn">View on Google Maps</a>
                    <a href="${escapeHtml(o.maps_url)}" target="_blank" rel="noopener noreferrer" class="get-directions-btn">
                        <i class="fas fa-diamond-turn-right" aria-hidden="true"></i> Get Directions
                    </a>
               </div>`
            : "";

        return `
            <div class="${cardClass}">
                ${badge}
                <h3 class="office-card-name">${escapeHtml(o.name)}</h3>
                <p class="office-card-address">${escapeHtml(o.address)}</p>
                ${phoneLines}
                ${emailLine}
                ${mapsLinks}
            </div>`;
    }

    function mapCardTemplate(o) {
        const mapBlock = o.maps_embed_url
            ? `<iframe class="office-map-embed" src="${escapeHtml(o.maps_embed_url)}" width="100%" height="260" style="border:0;" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${escapeHtml(o.name)} Map"></iframe>`
            : (o.maps_url
                ? `<a href="${escapeHtml(o.maps_url)}" target="_blank" rel="noopener noreferrer" class="office-map-btn"><i class="fas fa-map-marker-alt" aria-hidden="true"></i> View on Google Maps</a>`
                : `<p class="office-locations-status office-card-pending">Google Maps Location Coming Soon</p>`);

        return `
            <div class="office-card">
                <h3 class="office-card-name">${escapeHtml(o.name)}</h3>
                <p class="office-card-address">${escapeHtml(o.address)}</p>
                ${mapBlock}
            </div>`;
    }

    sb.from("office_locations")
        .select("*")
        .eq("publish_status", "Published")
        .order("display_order", { ascending: true })
        .then(({ data }) => {
            if (!data || !data.length) return; // keep existing static markup rather than show a broken state

            containers.forEach((container) => {
                const mode = container.getAttribute("data-offices-grid");
                container.innerHTML = data
                    .map((o) => (mode === "map" ? mapCardTemplate(o) : cardTemplate(o)))
                    .join("");
            });
        });
})();
