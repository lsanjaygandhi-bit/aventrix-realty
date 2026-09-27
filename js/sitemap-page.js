/*
 * AVENTRIX REALTY — HUMAN-READABLE SITEMAP (sitemap.html)
 * Lists every Published property and insight straight from the CMS,
 * so the sitemap never goes out of date. The static links stay if the
 * database can't be reached.
 */
(function () {
    const sb = window.supabaseClient;
    if (!sb) return;
    function esc(v) {
        return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    const props = document.getElementById("sitemapProperties");
    if (props) {
        sb.from("properties").select("slug,title").eq("publish_status", "Published").order("title").then(({ data }) => {
            if (!data || !data.length) return;
            props.innerHTML = '<li><a href="properties.html">All published properties</a></li>' +
                data.map((p) => `<li><a href="property.html?id=${encodeURIComponent(p.slug)}">${esc(p.title)}</a></li>`).join("");
        });
    }
    const ins = document.getElementById("sitemapInsights");
    if (ins) {
        sb.from("insights").select("slug,title,body").eq("publish_status", "Published").order("display_order").then(({ data }) => {
            if (!data || !data.length) return;
            // Only articles that have a body have their own page (see js/public-insights.js)
            const withBody = data.filter((i) => i.body && String(i.body).trim());
            ins.innerHTML = '<li><a href="insights.html">All insights</a></li>' +
                withBody.map((i) => `<li><a href="insight.html?id=${encodeURIComponent(i.slug)}">${esc(i.title)}</a></li>`).join("");
        });
    }
})();
