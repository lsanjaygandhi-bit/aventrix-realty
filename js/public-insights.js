/*
 * AVENTRIX REALTY — PUBLIC INSIGHTS LOADER
 * ------------------------------------------------
 * Replaces the hardcoded insight cards on insights.html with live,
 * published articles from Supabase. No artificial article limit.
 */

(function () {
    const sb = window.supabaseClient;
    if (!sb) return;

    const grid = document.getElementById("insightGrid");
    if (grid) renderGrid(grid);

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    async function renderGrid(gridEl) {
        const { data } = await sb
            .from("insights")
            .select("*")
            .eq("publish_status", "Published")
            .order("display_order", { ascending: true });

        if (!data || !data.length) return;

        gridEl.innerHTML = data.map((a) => `
            <div class="insight-card">
                <div class="content">
                    <img src="${escapeHtml(a.cover_image_url || "images/insight-1.jpg")}" alt="${escapeHtml(a.title)}">
                    <h3>${escapeHtml(a.title)}</h3>
                    <p>${escapeHtml(a.excerpt || "")}</p>
                    <a href="insight.html?id=${encodeURIComponent(a.slug)}">Read More →</a>
                </div>
            </div>
        `).join("");
    }

    // ---------------------------------------------------------
    // INSIGHT DETAIL PAGE (insight.html?id=<slug>), if present
    // ---------------------------------------------------------
    const titleEl = document.getElementById("insight-title");
    if (titleEl) renderDetail();

    async function renderDetail() {
        const params = new URLSearchParams(window.location.search);
        const slug = params.get("id");
        if (!slug) return;

        const { data: article } = await sb
            .from("insights")
            .select("*")
            .eq("slug", slug)
            .eq("publish_status", "Published")
            .maybeSingle();

        if (!article) return;

        titleEl.textContent = article.title;
        const bodyEl = document.getElementById("insight-body");
        if (bodyEl) bodyEl.innerHTML = article.body || "";
        const coverEl = document.getElementById("insight-cover");
        if (coverEl && article.cover_image_url) coverEl.src = article.cover_image_url;

        if (article.seo_title) document.title = article.seo_title;
        setMeta("description", article.seo_description);
        setMeta("keywords", article.seo_keywords);
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
