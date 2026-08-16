/*
 * AVENTRIX REALTY — PUBLIC PAGE CONTENT LOADER
 * ------------------------------------------------
 * Reads the `pages` table row matching this page's data-page-key and
 * applies it to the existing DOM. Safe to include on every page —
 * silently does nothing if the page has no data-page-key or no
 * matching hooks are present.
 *
 * HERO hooks (structured fields):
 *   [data-page-hero-eyebrow]  -> textContent = hero_eyebrow
 *   [data-page-hero-title]    -> innerHTML   = hero_title
 *   [data-page-hero-subtitle] -> innerHTML   = hero_subtitle
 *   [data-page-hero-button]   -> textContent = hero_button_text, href = hero_button_link
 *
 * SECTION hooks (one rich-text block per section):
 *   [data-cms-section="key"]
 *     > [data-cms-eyebrow]  -> textContent = section.eyebrow
 *     > [data-cms-heading]  -> textContent = section.heading
 *     > [data-cms-content]  -> innerHTML   = section.html
 */

(function () {
    const sb = window.supabaseClient;
    if (!sb) return;

    const pageKey = document.body.getAttribute("data-page-key");
    if (!pageKey) return;

    sb.from("pages")
        .select("*")
        .eq("page_key", pageKey)
        .eq("publish_status", "Published")
        .maybeSingle()
        .then(({ data }) => {
            if (!data) return;
            applyHero(data);
            applySections(data.sections || []);
            applySeo(data);
        });

    function applyHero(p) {
        setText("[data-page-hero-eyebrow]", p.hero_eyebrow);
        setHtml("[data-page-hero-title]", p.hero_title);
        setHtml("[data-page-hero-subtitle]", p.hero_subtitle);

        if (p.hero_button_text) {
            document.querySelectorAll("[data-page-hero-button]").forEach((el) => {
                el.textContent = p.hero_button_text;
                if (p.hero_button_link) el.setAttribute("href", p.hero_button_link);
            });
        }
    }

    function applySections(sections) {
        let faqTouched = false;

        sections.forEach((s) => {
            const wrap = document.querySelector(`[data-cms-section="${cssEscape(s.key)}"]`);
            if (!wrap) return;

            const eyebrowEl = wrap.querySelector("[data-cms-eyebrow]");
            if (eyebrowEl && s.eyebrow) eyebrowEl.textContent = s.eyebrow;

            const headingEl = wrap.querySelector("[data-cms-heading]");
            if (headingEl && s.heading) headingEl.textContent = s.heading;

            const contentEl = wrap.querySelector("[data-cms-content]");
            if (contentEl && s.html) {
                contentEl.innerHTML = s.html;
                if (wrap.id === "faqSectionWrap" || s.key === "faq") faqTouched = true;
            }
        });

        // The FAQ accordion binds click listeners at script.js load time;
        // re-bind now that the questions/answers have been replaced with
        // CMS content, so the existing open/close behaviour keeps working.
        if (faqTouched && typeof window.initFaqAccordion === "function") {
            window.initFaqAccordion();
        }
    }

    function applySeo(p) {
        if (p.seo_title) document.title = p.seo_title;
        setMeta("description", p.seo_description);
        setMeta("keywords", p.seo_keywords);
        if (p.og_image_url) setMeta("og:image", p.og_image_url, "property");
    }

    function setText(selector, value) {
        if (!value) return;
        document.querySelectorAll(selector).forEach((el) => (el.textContent = value));
    }

    function setHtml(selector, value) {
        if (!value) return;
        document.querySelectorAll(selector).forEach((el) => (el.innerHTML = value));
    }

    function setMeta(name, content, attr = "name") {
        if (!content) return;
        let tag = document.querySelector(`meta[${attr}="${name}"]`);
        if (!tag) {
            tag = document.createElement("meta");
            tag.setAttribute(attr, name);
            document.head.appendChild(tag);
        }
        tag.setAttribute("content", content);
    }

    function cssEscape(str) {
        return String(str).replace(/["\\]/g, "\\$&");
    }
})();
