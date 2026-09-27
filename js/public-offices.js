/*
 * AVENTRIX REALTY — PUBLIC OFFICE LOCATIONS LOADER (v2, 2026-09-26)
 * ------------------------------------------------
 * Single source for every office/contact detail on the public site:
 * Admin → Office Locations (`office_locations`, Published, by display_order).
 *
 * 1. Office card grids: [data-offices-grid="cards"] and [data-offices-grid="map"]
 *    (homepage "Our Office Locations", Contact page).
 * 2. Head Office contact details wherever they are repeated (footer on every
 *    page, homepage Quick Enquiry, Contact page):
 *      [data-hq="name"]       office name
 *      [data-hq="address"]    address
 *      [data-hq="phones"]     container: its tel: links are rebuilt from the
 *                             office's phone list (comma separated in Admin)
 *      [data-hq="email"]      mailto link (href + text)
 *      [data-hq="maps"]       Google Maps link (href)
 *      [data-hq="map-embed"]  <iframe> map
 * Static HTML stays as the fallback if the database can't be reached.
 *
 * Map embeds: only real embed URLs are used for an <iframe>
 * (google.com/maps/embed… or …output=embed). A share link such as
 * maps.app.goo.gl/… can't be embedded (Google refuses to load it in an
 * iframe), so in that case the map is built from the office address —
 * the same method the footer map has always used.
 */

(function () {
    const sb = window.supabaseClient;
    if (!sb) return;

    const containers = document.querySelectorAll("[data-offices-grid]");
    const hqHooks = document.querySelectorAll("[data-hq]");
    if (!containers.length && !hqHooks.length) return;

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    function telHref(phone) {
        return "tel:" + String(phone || "").replace(/[^\d+]/g, "");
    }

    function phonesOf(o) {
        return String(o.phone || "").split(",").map((p) => p.trim()).filter(Boolean);
    }

    function isEmbeddable(url) {
        return /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/i.test(url || "") || /[?&]output=embed\b/i.test(url || "");
    }

    function embedUrlFor(o) {
        if (isEmbeddable(o.maps_embed_url)) return o.maps_embed_url;
        if (o.address) return "https://www.google.com/maps?q=" + encodeURIComponent(o.address) + "&output=embed";
        return "";
    }
    window.AventrixOffices = { embedUrlFor, isEmbeddable };

    function cardTemplate(o) {
        const badge = o.is_head_office ? `<span class="office-card-badge">Head Office</span>` : "";
        const cardClass = o.is_head_office ? "office-card office-card-head" : "office-card";
        const phoneLines = phonesOf(o)
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
        const embed = embedUrlFor(o);
        const mapBlock = embed
            ? `<iframe class="office-map-embed" src="${escapeHtml(embed)}" width="100%" height="260" style="border:0;" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${escapeHtml(o.name)} Map"></iframe>`
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

    function applyHeadOffice(o) {
        document.querySelectorAll('[data-hq="name"]').forEach((el) => { if (o.name) el.textContent = o.name; });
        document.querySelectorAll('[data-hq="address"]').forEach((el) => { if (o.address) el.textContent = o.address; });
        document.querySelectorAll('[data-hq="email"]').forEach((el) => {
            if (!o.email) return;
            el.setAttribute("href", "mailto:" + o.email);
            const label = el.querySelector("[data-hq-text]");
            if (label) label.textContent = o.email;
            else if (!el.children.length) el.textContent = o.email;
            else el.lastChild.textContent = " " + o.email;
        });
        document.querySelectorAll('[data-hq="maps"]').forEach((el) => { if (o.maps_url) el.setAttribute("href", o.maps_url); });
        document.querySelectorAll('[data-hq="map-embed"]').forEach((el) => {
            const url = embedUrlFor(o);
            if (url && el.getAttribute("src") !== url) el.setAttribute("src", url);
        });
        const phones = phonesOf(o);
        if (phones.length) {
            document.querySelectorAll('[data-hq="phones"]').forEach((box) => {
                const links = Array.from(box.querySelectorAll('a[href^="tel:"]'));
                if (!links.length) return;
                const template = links[0];
                phones.forEach((p) => {
                    const a = template.cloneNode(true);
                    a.setAttribute("href", telHref(p));
                    const icon = a.querySelector("i");
                    // keep any non-number prefix the page uses (e.g. "📞 ")
                    const prefix = icon ? "" : ((template.textContent.match(/^[^+\d]*/) || [""])[0]);
                    a.textContent = "";
                    if (icon) { a.appendChild(icon); a.appendChild(document.createTextNode(" " + p)); }
                    else a.textContent = prefix + p;
                    box.insertBefore(a, template);
                });
                links.forEach((l) => l.remove());
            });
        }
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

            const head = data.find((o) => o.is_head_office) || data[0];
            if (head) applyHeadOffice(head);
        });
})();
