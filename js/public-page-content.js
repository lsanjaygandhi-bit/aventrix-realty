/*
 * AVENTRIX REALTY — PUBLIC PAGE CONTENT LOADER (v2, 2026-09-26)
 * ------------------------------------------------
 * Reads the `pages` row for this page's <body data-page-key> and applies
 * it to the existing DOM. The static HTML stays as the fallback: a value
 * only replaces the page's own text when the Admin value is non-empty, so
 * an unreachable database or an empty field never blanks the page.
 *
 * HERO hooks (structured page fields):
 *   [data-page-hero-eyebrow]   hero_eyebrow
 *   [data-page-hero-title]     hero_title       (inline HTML allowed, e.g. <br>)
 *   [data-page-hero-subtitle]  hero_subtitle
 *   [data-page-hero-button]    hero_button_text (+ hero_button_link → href)
 *   [data-page-hero-image]     hero_image_url   (<img> src, <video> poster,
 *                                                or background-image)
 *
 * SECTION hooks — one entry in pages.sections per [data-cms-section="key"]:
 *   [data-cms-eyebrow]   section.eyebrow
 *   [data-cms-heading]   section.heading
 *   [data-cms-content]   section.html     (rich text). data-cms-p-class="x"
 *                                           re-applies the page's paragraph
 *                                           class to top-level <p>s, so the
 *                                           rich-text editor never has to
 *                                           keep CSS classes.
 *   [data-cms-image]     section.image_url
 *   [data-cms-f="name"]  section.fields[name]   (single values)
 *   [data-cms-list="name"] section.lists[name]  (repeatable items)
 *       > [data-cms-item]  one element per item; item N re-uses the page's
 *                          own item N as its template (the last one for
 *                          extra items), so per-card layout variants and
 *                          decorative icons are preserved.
 *       Inside an item (or on the item element itself):
 *         data-cms-f="field"      innerHTML / text
 *         data-cms-href="field"   href
 *         data-cms-src="field"    src (+ alt from data-cms-alt="field")
 *         data-cms-bg="field"     background-image
 *         data-cms-class="field"  className (Font Awesome icon classes)
 *   A section on one page can read another page's row:
 *     data-cms-page="home" on the section element.
 *
 * SEO: seo_title → <title> + og:title/twitter:title; seo_description →
 * description + og:description/twitter:description; seo_keywords;
 * og_image_url → og:image/twitter:image.
 *
 * The same apply() is exposed as window.AventrixCMS.applyPage(row, root) so
 * the automated tests and the Admin preview use exactly this code.
 */

(function () {
    const sb = window.supabaseClient;
    const pageKey = document.body && document.body.getAttribute("data-page-key");

    // ---------------------------------------------------------------
    // Value helpers
    // ---------------------------------------------------------------
    function hasValue(v) {
        return v !== undefined && v !== null && String(v).trim() !== "";
    }

    // Admin values are staff-entered (RLS: admins only). Plain text is set
    // as text; values that already contain markup (e.g. "<br>", a <span>
    // accent or a list) are set as HTML, exactly like the section body.
    function setContent(el, value) {
        const v = String(value);
        if (/<[a-z!/]/i.test(v)) el.innerHTML = v;
        else el.textContent = v;
    }

    function cssEscape(str) {
        return String(str).replace(/["\\]/g, "\\$&");
    }

    // ---------------------------------------------------------------
    // HERO
    // ---------------------------------------------------------------
    function applyHero(p, root) {
        each(root, "[data-page-hero-eyebrow]", (el) => hasValue(p.hero_eyebrow) && setContent(el, p.hero_eyebrow));
        each(root, "[data-page-hero-title]", (el) => hasValue(p.hero_title) && setContent(el, p.hero_title));
        each(root, "[data-page-hero-subtitle]", (el) => hasValue(p.hero_subtitle) && setContent(el, p.hero_subtitle));
        each(root, "[data-page-hero-button]", (el) => {
            if (hasValue(p.hero_button_text)) setContent(el, p.hero_button_text);
            if (hasValue(p.hero_button_link)) el.setAttribute("href", p.hero_button_link);
        });
        if (hasValue(p.hero_image_url)) {
            each(root, "[data-page-hero-image]", (el) => setImage(el, p.hero_image_url));
        }
    }

    function setImage(el, url) {
        const tag = el.tagName;
        if (tag === "IMG") el.setAttribute("src", url);
        else if (tag === "VIDEO") el.setAttribute("poster", url);
        else el.style.backgroundImage = "url('" + String(url).replace(/'/g, "%27") + "')";
    }

    // ---------------------------------------------------------------
    // SECTIONS
    // ---------------------------------------------------------------
    function applySections(sections, root, forPageKey) {
        let faqTouched = false;
        (sections || []).forEach((s) => {
            if (!s || !s.key) return;
            root.querySelectorAll(`[data-cms-section="${cssEscape(s.key)}"]`).forEach((wrap) => {
                const wantPage = wrap.getAttribute("data-cms-page");
                if (wantPage && forPageKey && wantPage !== forPageKey) return;
                if (!wantPage && forPageKey && pageKey && forPageKey !== pageKey && root === document) return;
                if (applySection(wrap, s)) faqTouched = faqTouched || !!wrap.querySelector(".faq-question");
            });
        });
        if (faqTouched && typeof window.initFaqAccordion === "function") window.initFaqAccordion();
    }

    // Only elements that belong to THIS section (not to a nested list item).
    function own(wrap, selector) {
        const els = Array.from(wrap.querySelectorAll(selector));
        if (wrap.matches(selector)) els.unshift(wrap);
        return els.filter((el) => {
            const item = el.closest("[data-cms-item]");
            return !item || !wrap.contains(item) || item === wrap;
        }).filter((el) => el.closest("[data-cms-section]") === wrap);
    }

    function applySection(wrap, s) {
        let changed = false;
        if (hasValue(s.eyebrow)) own(wrap, "[data-cms-eyebrow]").forEach((el) => { setContent(el, s.eyebrow); changed = true; });
        if (hasValue(s.heading)) own(wrap, "[data-cms-heading]").forEach((el) => { setContent(el, s.heading); changed = true; });
        if (hasValue(s.html)) {
            own(wrap, "[data-cms-content]").forEach((el) => {
                el.innerHTML = s.html;
                const pClass = el.getAttribute("data-cms-p-class");
                if (pClass) Array.from(el.children).forEach((c) => { if (c.tagName === "P") c.classList.add(...pClass.split(/\s+/)); });
                changed = true;
            });
        }
        if (hasValue(s.image_url)) own(wrap, "[data-cms-image]").forEach((el) => { setImage(el, s.image_url); changed = true; });

        const fields = s.fields || {};
        Object.keys(fields).forEach((name) => {
            if (!hasValue(fields[name])) return;
            own(wrap, `[data-cms-f="${cssEscape(name)}"]`).forEach((el) => { setContent(el, fields[name]); changed = true; });
            own(wrap, `[data-cms-href="${cssEscape(name)}"]`).forEach((el) => { el.setAttribute("href", fields[name]); changed = true; });
            own(wrap, `[data-cms-src="${cssEscape(name)}"]`).forEach((el) => { el.setAttribute("src", fields[name]); changed = true; });
            own(wrap, `[data-cms-bg="${cssEscape(name)}"]`).forEach((el) => { setImage(el, fields[name]); changed = true; });
        });

        const lists = s.lists || {};
        Object.keys(lists).forEach((name) => {
            const items = Array.isArray(lists[name]) ? lists[name] : [];
            if (!items.length) return;
            own(wrap, `[data-cms-list="${cssEscape(name)}"]`).forEach((listEl) => { applyList(listEl, items); changed = true; });
        });
        return changed;
    }

    function applyList(listEl, items) {
        // Keep the page's original items as templates (captured once).
        if (!listEl.__cmsTemplates) {
            listEl.__cmsTemplates = Array.from(listEl.children).filter((c) => c.hasAttribute("data-cms-item")).map((c) => c.cloneNode(true));
        }
        const templates = listEl.__cmsTemplates;
        if (!templates.length) return;
        const anchor = Array.from(listEl.children).find((c) => c.hasAttribute("data-cms-item"));
        const marker = document.createComment("cms-list");
        listEl.insertBefore(marker, anchor || null);
        Array.from(listEl.children).forEach((c) => { if (c.hasAttribute("data-cms-item")) c.remove(); });

        items.forEach((item, i) => {
            const node = templates[Math.min(i, templates.length - 1)].cloneNode(true);
            fillItem(node, item || {});
            listEl.insertBefore(node, marker);
        });
        marker.remove();
    }

    function fillItem(node, item) {
        const all = [node].concat(Array.from(node.querySelectorAll("*")));
        all.forEach((el) => {
            const f = el.getAttribute("data-cms-f");
            if (f !== null && f in item) {
                if (hasValue(item[f])) { setContent(el, item[f]); el.hidden = false; }
                else el.remove();
            }
            const h = el.getAttribute("data-cms-href");
            if (h !== null && h in item && hasValue(item[h])) el.setAttribute("href", item[h]);
            const src = el.getAttribute("data-cms-src");
            if (src !== null && src in item && hasValue(item[src])) el.setAttribute("src", item[src]);
            const alt = el.getAttribute("data-cms-alt");
            if (alt !== null && alt in item) el.setAttribute("alt", stripTags(item[alt] || ""));
            const bg = el.getAttribute("data-cms-bg");
            if (bg !== null && bg in item && hasValue(item[bg])) setImage(el, item[bg]);
            const cls = el.getAttribute("data-cms-class");
            if (cls !== null && cls in item && hasValue(item[cls])) el.className = item[cls];
        });
    }

    function stripTags(v) {
        const d = document.createElement("div");
        d.innerHTML = String(v);
        return d.textContent || "";
    }

    // ---------------------------------------------------------------
    // SEO
    // ---------------------------------------------------------------
    function applySeo(p) {
        if (hasValue(p.seo_title)) {
            document.title = p.seo_title;
            setMeta("og:title", p.seo_title, "property");
            setMeta("twitter:title", p.seo_title);
        }
        if (hasValue(p.seo_description)) {
            setMeta("description", p.seo_description);
            setMeta("og:description", p.seo_description, "property");
            setMeta("twitter:description", p.seo_description);
        }
        if (hasValue(p.seo_keywords)) setMeta("keywords", p.seo_keywords);
        if (hasValue(p.og_image_url)) {
            setMeta("og:image", p.og_image_url, "property");
            setMeta("twitter:image", p.og_image_url);
        }
    }

    function setMeta(name, content, attr = "name") {
        let tags = document.querySelectorAll(`meta[${attr}="${name}"]`);
        if (!tags.length) {
            // Only create tags that are standard for every page; don't add
            // social tags a page intentionally doesn't carry.
            if (name !== "description" && name !== "keywords" && !name.startsWith("og:")) return;
            const tag = document.createElement("meta");
            tag.setAttribute(attr, name);
            document.head.appendChild(tag);
            tags = [tag];
        }
        tags.forEach((t) => t.setAttribute("content", content));
    }

    function each(root, selector, fn) {
        root.querySelectorAll(selector).forEach(fn);
    }

    // ---------------------------------------------------------------
    // Public API + boot
    // ---------------------------------------------------------------
    function applyPage(row, root, opts) {
        root = root || document;
        opts = opts || {};
        if (!row) return;
        if (!opts.sectionsOnly) applyHero(row, root);
        applySections(row.sections || [], root, row.page_key);
        if (!opts.sectionsOnly && root === document && opts.seo !== false) applySeo(row);
    }

    window.AventrixCMS = { applyPage, applyList, fillItem, hasValue };

    if (!sb || !pageKey) return;

    // This page's row, plus any other rows a section asks for
    // (data-cms-page="home" etc.) — one request for all of them.
    const extraKeys = Array.from(document.querySelectorAll("[data-cms-page]"))
        .map((el) => el.getAttribute("data-cms-page"))
        .filter((k, i, a) => k && k !== pageKey && a.indexOf(k) === i);

    sb.from("pages")
        .select("*")
        .in("page_key", [pageKey].concat(extraKeys))
        .eq("publish_status", "Published")
        .then(({ data }) => {
            if (!data) return;
            const own = data.find((r) => r.page_key === pageKey);
            if (own) {
                applyHero(own, document);
                applySections(own.sections || [], document, pageKey);
                applySeo(own);
            }
            data.filter((r) => r.page_key !== pageKey).forEach((r) => {
                // Only sections explicitly marked data-cms-page="<key>".
                const secs = (r.sections || []).filter((s) => document.querySelector(`[data-cms-section="${cssEscape(s.key)}"][data-cms-page="${cssEscape(r.page_key)}"]`));
                applySections(secs, document, r.page_key);
            });
            document.dispatchEvent(new CustomEvent("aventrix:page-content-applied"));
        });
})();
