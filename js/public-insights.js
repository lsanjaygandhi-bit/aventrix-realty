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

    // Only link to an article page when the article actually has body
    // content — never send visitors to an empty page.
    function hasBody(a) {
        return !!String(a.body || "").replace(/<[^>]*>/g, "").trim();
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
                    ${hasBody(a) ? `<a href="insight.html?id=${encodeURIComponent(a.slug)}">Read More →</a>` : ""}
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
        const loadingEl = document.getElementById("insight-loading");
        const missingEl = document.getElementById("insight-missing");
        const contentEl = document.getElementById("insight-content");
        const showMissing = () => {
            if (loadingEl) loadingEl.hidden = true;
            if (missingEl) missingEl.hidden = false;
        };

        const slug = new URLSearchParams(window.location.search).get("id");
        if (!slug) { showMissing(); return; }

        const { data: article, error } = await sb
            .from("insights")
            .select("*")
            .eq("slug", slug)
            .eq("publish_status", "Published")
            .maybeSingle();

        if (error || !article || !hasBody(article)) { showMissing(); return; }

        titleEl.textContent = article.title;
        // Body is admin-authored rich text from the CMS editor. Only
        // admins can write insights (enforced by RLS since the
        // 2026-09-25 security migration).
        const bodyEl = document.getElementById("insight-body");
        if (bodyEl) bodyEl.innerHTML = article.body;
        const metaEl = document.getElementById("insight-meta");
        if (metaEl) {
            const date = article.published_at || article.created_at;
            metaEl.textContent = [article.category, date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : ""].filter(Boolean).join(" · ");
        }
        const coverEl = document.getElementById("insight-cover");
        if (coverEl && article.cover_image_url) {
            coverEl.src = article.cover_image_url;
            coverEl.alt = article.title;
            coverEl.hidden = false;
        }
        if (loadingEl) loadingEl.hidden = true;
        if (contentEl) contentEl.hidden = false;

        document.title = article.seo_title || (article.title + " | Aventrix Realty");
        setMeta("description", article.seo_description || article.excerpt);
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
