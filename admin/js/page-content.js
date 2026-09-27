/*
 * AVENTRIX REALTY — WEBSITE CONTENT (PAGES) MODULE  (v2, 2026-09-26)
 * -------------------------------------------
 * One editor for every public page. Data: the `pages` table, one row per
 * page_key (see js/public-page-content.js for how it renders).
 *
 *   Hero / banner      hero_eyebrow, hero_title, hero_subtitle,
 *                      hero_button_text/link, hero_image_url
 *                      (Homepage: title, subtitle, tagline, colour and video
 *                       are the `site_settings` hero fields — edited here, in
 *                       one place; the button and poster image are the page's
 *                       own hero fields.)
 *   Sections           each `sections[]` entry matches one block on the page
 *                      (data-cms-section="key"):
 *                        eyebrow · heading · rich text (html) · image_url
 *                        fields  {name: value}           single values
 *                        lists   {name: [{field: value}]} repeatable items
 *                      Which of these a section has is decided by the page
 *                      (`hooks`, recorded when the section was created), so
 *                      the form only shows inputs that actually change the
 *                      website.
 *   SEO                seo_title, seo_description, seo_keywords, og_image_url
 *
 * Rich text: Quill is used only when the stored HTML is plain formatted text
 * (paragraphs, bold/italic, lists, links, sub-headings). HTML with page
 * layout markup (classes, divs) is edited in an HTML box instead, because
 * Quill silently strips that markup on save.
 */

const PAGES_LIST = [
    { key: "home", label: "Homepage", url: "index.html" },
    { key: "about", label: "About Us", url: "about.html" },
    { key: "services", label: "Services", url: "services.html" },
    { key: "properties", label: "Properties (search page header)", url: "properties.html" },
    { key: "list-with-us", label: "List With Us", url: "list-with-us.html" },
    { key: "free-valuation", label: "Free Property Valuation", url: "free-valuation.html" },
    { key: "joint-venture", label: "Joint Venture", url: "joint-venture.html" },
    { key: "nri-services", label: "NRI Services", url: "nri-services.html" },
    { key: "brokerage-fees", label: "Professional Fees", url: "brokerage-fees.html" },
    { key: "our-realtors", label: "Our Realtors (page intro)", url: "our-realtors.html" },
    { key: "gnanasekaran", label: "Founder profile — Gnanasekaran P", url: "gnanasekaran.html" },
    { key: "sanjay", label: "Co-Founder profile — L. Sanjay Gandhi", url: "sanjay.html" },
    { key: "insights", label: "Insights (page intro)", url: "insights.html" },
    { key: "contact", label: "Contact", url: "contact.html" },
    { key: "enquiry", label: "Property Enquiry", url: "enquiry.html" },
    { key: "emi-calculator", label: "EMI Calculator", url: "emi-calculator.html" },
    { key: "privacy-policy", label: "Privacy Policy", url: "privacy-policy.html" },
    { key: "terms", label: "Terms & Conditions", url: "terms.html" },
    { key: "sitemap", label: "Sitemap (page intro)", url: "sitemap.html" }
];

// Friendly labels for structured field names.
const FIELD_LABELS = {
    text: "Text", text2: "Second paragraph", title: "Title", subtitle: "Subtitle", label: "Label",
    link: "Link (URL)", link_text: "Link text", button_text: "Button text", number: "Number",
    icon: "Icon (Font Awesome classes)", image: "Image URL", photo: "Photo URL", name: "Name",
    role: "Role / designation", bio: "Biography", rera: "RERA line", profile_link: "Profile page link",
    question: "Question", answer: "Answer", year: "Year", closing: "Closing line", lead: "Lead paragraph",
    note: "Note", intro: "Introduction", quote: "Quote", disclaimer: "Disclaimer", footnote: "Footnote",
    subhead: "Sub-heading", letter: "Letter", value: "Value", result: "Result", day: "Day(s)", time: "Time",
    hours_title: "Hours card title", contact_title: "Contact card title", list_label: "List heading",
    points: "Points (list)", eyebrow: "Small label", factors_label: "Factors heading",
    owner_label: "Landowner list heading", partner_label: "Partner list heading"
};

const PageContentModule = (function () {
    let currentPage = null;    // full row from `pages`
    let currentPageKey = null;
    let siteSettings = null;   // homepage hero lives in site_settings
    let sectionState = [];     // working copy of sections (objects), same order as the form
    let editors = {};          // "sectionIndex" -> Quill instance
    const els = {};

    function cacheEls() {
        [
            "pageContentSelect", "pageContentForm", "pageContentEmpty",
            "pageContentLoading", "pageContentError", "pageContentErrorMsg",
            "pcRetryBtn", "pcCreatePageBtn", "pcViewPageLink",
            "pcHeroEyebrow", "pcHeroTitle", "pcHeroSubtitle",
            "pcHeroButtonText", "pcHeroButtonLink", "pcHeroImageUrl", "pcHeroImagePreview",
            "pcHomeHero", "pcSsHeroTitle", "pcSsHeroSubtitle", "pcSsHeroTagline", "pcSsHeroTaglineColor", "pcSsHeroVideoUrl",
            "pcHeroStdFields", "pcHeroImageLabel",
            "pcSectionsList", "pcSeoTitle", "pcSeoDescription", "pcSeoKeywords", "pcOgImageUrl",
            "savePageContentBtn"
        ].forEach((id) => (els[id] = document.getElementById(id)));
    }

    function populateSelect() {
        els.pageContentSelect.innerHTML =
            '<option value="">Choose a page to edit…</option>' +
            PAGES_LIST.map((p) => `<option value="${p.key}">${escapeHtml(p.label)}</option>`).join("");
    }

    async function load() {
        if (!els.pageContentSelect.options.length) populateSelect();
    }

    function setState(state, opts = {}) {
        els.pageContentEmpty.style.display = state === "idle" ? "block" : "none";
        els.pageContentLoading.style.display = state === "loading" ? "block" : "none";
        els.pageContentForm.style.display = state === "form" ? "block" : "none";
        if (state === "error" || state === "notfound") {
            els.pageContentError.style.display = "block";
            els.pageContentErrorMsg.textContent = opts.message || "";
            els.pcCreatePageBtn.style.display = state === "notfound" ? "inline-flex" : "none";
        } else {
            els.pageContentError.style.display = "none";
        }
    }

    async function openPage(pageKey, opts) {
        opts = opts || {};
        currentPageKey = pageKey || null;
        if (els.pageContentSelect.value !== (pageKey || "")) els.pageContentSelect.value = pageKey || "";
        if (!pageKey) { currentPage = null; setState("idle"); return; }
        setState("loading");

        let data;
        try {
            const { data: row, error } = await CrudEngine.sb.from("pages").select("*").eq("page_key", pageKey).maybeSingle();
            if (error) throw error;
            data = row;
            if (pageKey === "home") {
                const { data: ss, error: e2 } = await CrudEngine.sb.from("site_settings").select("*").eq("id", 1).maybeSingle();
                if (e2) throw e2;
                siteSettings = ss || {};
            }
        } catch (err) {
            console.error("Failed to load page content for '" + pageKey + "':", err);
            setState("error", { message: "Unable to load page content: " + (err && err.message ? err.message : "Unknown error. See console for details.") });
            return;
        }

        if (!data) {
            currentPage = null;
            const meta = PAGES_LIST.find((p) => p.key === pageKey);
            setState("notfound", { message: `"${meta ? meta.label : pageKey}" has no saved content yet. Click "Create Page Content" to start editing it.` });
            return;
        }

        currentPage = data;
        try {
            renderForm(data);
        } catch (err) {
            console.error("Failed to render page content form:", err);
            setState("error", { message: "Unable to display the editor: " + (err && err.message ? err.message : "Unknown error. See console for details.") });
            return;
        }
        setState("form");

        if (opts.focus) {
            const block = document.querySelector(`.pc-section-block[data-section-key="${cssEscape(opts.focus)}"]`);
            if (block) {
                block.classList.add("pc-section-focus");
                block.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
    }

    async function createCurrentPage() {
        if (!currentPageKey) return;
        const meta = PAGES_LIST.find((p) => p.key === currentPageKey);
        const btn = els.pcCreatePageBtn;
        btn.disabled = true;
        try {
            await CrudEngine.insert("pages", { page_key: currentPageKey, page_label: meta ? meta.label : currentPageKey, sections: [] });
            showToast("Page content created — edit and Save & Publish to go live");
            await openPage(currentPageKey);
        } catch (err) {
            console.error("Failed to create page content row:", err);
            setState("error", { message: "Unable to create page content: " + (err && err.message ? err.message : "Unknown error. See console for details.") });
        } finally {
            btn.disabled = false;
        }
    }

    // ------------------------------------------------------------------
    // Form rendering
    // ------------------------------------------------------------------
    function renderForm(p) {
        const meta = PAGES_LIST.find((x) => x.key === p.page_key);
        if (els.pcViewPageLink) {
            els.pcViewPageLink.href = meta ? "../" + meta.url : "../index.html";
            els.pcViewPageLink.style.display = meta ? "" : "none";
        }

        const isHome = p.page_key === "home";
        els.pcHomeHero.style.display = isHome ? "block" : "none";
        els.pcHeroStdFields.style.display = isHome ? "none" : "";
        els.pcHeroImageLabel.textContent = isHome ? "Hero video poster image (shown while the video loads)" : "Hero Image URL";
        if (isHome) {
            const ss = siteSettings || {};
            els.pcSsHeroTitle.value = ss.hero_title || "";
            els.pcSsHeroSubtitle.value = ss.hero_subtitle || "";
            els.pcSsHeroTagline.value = ss.hero_tagline || "";
            els.pcSsHeroTaglineColor.value = ss.hero_tagline_color || "#D4AF37";
            els.pcSsHeroVideoUrl.value = ss.hero_video_url || "";
        }

        els.pcHeroEyebrow.value = p.hero_eyebrow || "";
        els.pcHeroTitle.value = p.hero_title || "";
        els.pcHeroSubtitle.value = p.hero_subtitle || "";
        els.pcHeroButtonText.value = p.hero_button_text || "";
        els.pcHeroButtonLink.value = p.hero_button_link || "";
        els.pcHeroImageUrl.value = p.hero_image_url || "";
        renderImagePreview(els.pcHeroImagePreview, p.hero_image_url);

        els.pcSeoTitle.value = p.seo_title || "";
        els.pcSeoDescription.value = p.seo_description || "";
        els.pcSeoKeywords.value = p.seo_keywords || "";
        if (els.pcOgImageUrl) els.pcOgImageUrl.value = p.og_image_url || "";

        sectionState = JSON.parse(JSON.stringify(p.sections || [])).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        renderSections();
    }

    function renderImagePreview(el, url) {
        if (!el) return;
        el.innerHTML = url ? `<img src="${escapeHtml(resolveUrl(url))}" alt="">` : "";
    }

    // Site-relative paths ("images/x.jpg") are relative to the website root,
    // not to /admin/, so preview them from there.
    function resolveUrl(url) {
        const u = String(url || "");
        return /^(https?:|data:|\/)/i.test(u) ? u : "../" + u;
    }

    function escapeHtml(str) {
        return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function cssEscape(str) { return String(str).replace(/["\\]/g, "\\$&"); }

    function labelFor(name) {
        return FIELD_LABELS[name] || name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
    }

    // Which inputs a section shows. Sections created before hooks were
    // recorded show everything (safe default).
    function hookSet(s) {
        if (Array.isArray(s.hooks)) return new Set(s.hooks);
        return new Set(["eyebrow", "heading", "html", "image_url"]);
    }

    // Plain formatted text → safe for Quill; anything with classes, styles,
    // divs or other layout markup → HTML box (Quill would strip it).
    function isQuillSafe(html) {
        if (!html) return true;
        const tpl = document.createElement("template");
        tpl.innerHTML = html;
        const allowed = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "A", "UL", "OL", "LI", "H2", "H3"]);
        return Array.from(tpl.content.querySelectorAll("*")).every((el) => {
            if (!allowed.has(el.tagName)) return false;
            return Array.from(el.attributes).every((a) => el.tagName === "A" && ["href", "target", "rel"].includes(a.name));
        });
    }

    function fieldInput(value, attrs, name) {
        const v = value == null ? "" : String(value);
        const long = v.length > 90 || /<[a-z]/i.test(v) || ["text", "bio", "answer", "text2", "lead", "intro", "note", "quote", "disclaimer", "footnote", "closing", "points"].includes(name);
        if (long) {
            const rows = Math.min(12, Math.max(2, Math.ceil(v.length / 90) + (/<[a-z]/i.test(v) ? 1 : 0)));
            return `<textarea ${attrs} rows="${rows}">${escapeHtml(v)}</textarea>`;
        }
        return `<input type="text" ${attrs} value="${escapeHtml(v)}">`;
    }

    function renderSections() {
        editors = {};
        if (!sectionState.length) {
            els.pcSectionsList.innerHTML = `<p class="helper-text">This page has no editable content sections.</p>`;
            return;
        }

        els.pcSectionsList.innerHTML = sectionState.map((s, si) => {
            const hooks = hookSet(s);
            const title = s.label || s.key;
            const parts = [];
            if (hooks.has("eyebrow")) parts.push(`<div class="admin-field"><label>Small label (eyebrow)</label><input type="text" data-s="${si}" data-k="eyebrow" value="${escapeHtml(s.eyebrow)}"></div>`);
            if (hooks.has("heading")) parts.push(`<div class="admin-field full"><label>Heading</label><input type="text" data-s="${si}" data-k="heading" value="${escapeHtml(s.heading)}"></div>`);
            if (hooks.has("image_url")) parts.push(`<div class="admin-field full"><label>Image URL</label><input type="text" data-s="${si}" data-k="image_url" value="${escapeHtml(s.image_url)}"></div>`);
            if (hooks.has("html")) {
                const quill = isQuillSafe(s.html) && typeof Quill !== "undefined";
                parts.push(`<div class="admin-field full"><label>Text</label>${quill
                    ? `<div class="pc-quill-editor" id="pc-quill-${si}"></div>`
                    : `<textarea class="pc-html-box" data-s="${si}" data-k="html" rows="${Math.min(18, Math.max(4, Math.ceil(String(s.html || "").length / 100)))}">${escapeHtml(s.html)}</textarea>
                       <p class="helper-text">${typeof Quill === "undefined" ? "The rich text editor did not load — editing as HTML so nothing is lost." : "This text contains page layout markup, so it is edited as HTML to keep the layout intact."}</p>`}</div>`);
            }
            const fields = s.fields || {};
            Object.keys(fields).forEach((name) => {
                parts.push(`<div class="admin-field ${/text|bio|answer|lead|intro|note|quote|disclaimer|closing|points/.test(name) ? "full" : ""}"><label>${escapeHtml(labelFor(name))}</label>${fieldInput(fields[name], `data-s="${si}" data-f="${escapeHtml(name)}"`, name)}</div>`);
            });

            const lists = s.lists || {};
            const listHtml = Object.keys(lists).map((ln) => renderList(si, ln, lists[ln])).join("");

            const shownOn = s.key === "about-legacy" ? `<p class="helper-text">Shown on the <strong>About Us</strong> page.</p>`
                : s.key === "leadership-intro" ? `<p class="helper-text">The people below are shown on the Homepage <em>and</em> the About Us page.</p>` : "";

            return `
            <div class="admin-card pc-section-block" data-section-key="${escapeHtml(s.key)}" data-si="${si}">
                <div class="pc-section-head">
                    <h3>${escapeHtml(title)}</h3>
                    <span class="pc-section-key">${escapeHtml(s.key)}</span>
                </div>
                ${shownOn}
                <div class="admin-form-grid">${parts.join("")}</div>
                ${listHtml}
            </div>`;
        }).join("");

        // Quill instances for plain rich-text sections
        sectionState.forEach((s, si) => {
            const el = document.getElementById(`pc-quill-${si}`);
            if (!el) return;
            const quill = new Quill(el, {
                theme: "snow",
                modules: { toolbar: [["bold", "italic"], [{ header: [2, 3, false] }], ["link"], [{ list: "ordered" }, { list: "bullet" }], ["clean"]] }
            });
            quill.clipboard.dangerouslyPasteHTML(s.html || "");
            editors[si] = quill;
        });
    }

    function renderList(si, name, items) {
        items = Array.isArray(items) ? items : [];
        const keys = [];
        items.forEach((it) => Object.keys(it || {}).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
        const rows = items.map((it, ii) => `
            <div class="pc-list-item" data-s="${si}" data-l="${escapeHtml(name)}" data-i="${ii}">
                <div class="pc-list-item-head">
                    <strong>${ii + 1}</strong>
                    <span>${escapeHtml(stripTags(it[keys[0]] || "")).slice(0, 70)}</span>
                    <span class="pc-list-actions">
                        <button type="button" class="admin-btn secondary pc-item-up" title="Move up" ${ii === 0 ? "disabled" : ""}><i class="fas fa-arrow-up"></i></button>
                        <button type="button" class="admin-btn secondary pc-item-down" title="Move down" ${ii === items.length - 1 ? "disabled" : ""}><i class="fas fa-arrow-down"></i></button>
                        <button type="button" class="admin-btn secondary danger pc-item-remove" title="Remove" ${items.length <= 1 ? "disabled" : ""}><i class="fas fa-trash"></i></button>
                    </span>
                </div>
                <div class="admin-form-grid">
                    ${keys.map((k) => `<div class="admin-field ${/text|bio|answer|points|note/.test(k) ? "full" : ""}"><label>${escapeHtml(labelFor(k))}</label>${fieldInput(it[k], `data-s="${si}" data-l="${escapeHtml(name)}" data-i="${ii}" data-if="${escapeHtml(k)}"`, k)}</div>`).join("")}
                </div>
            </div>`).join("");
        return `
            <div class="pc-list" data-s="${si}" data-l="${escapeHtml(name)}">
                <div class="pc-list-head">
                    <h4>${escapeHtml(labelFor(name))} <span class="helper-text" style="display:inline;">(${items.length})</span></h4>
                    <button type="button" class="admin-btn secondary pc-item-add" style="width:auto;"><i class="fas fa-plus"></i> Add</button>
                </div>
                ${rows}
            </div>`;
    }

    function stripTags(v) {
        const d = document.createElement("div");
        d.innerHTML = String(v);
        return d.textContent || "";
    }

    // Copy everything typed in the form back into sectionState.
    function collectFromDom() {
        document.querySelectorAll("#pcSectionsList [data-s]").forEach((el) => {
            if (!("value" in el) || el.tagName === "DIV") return;
            const s = sectionState[Number(el.dataset.s)];
            if (!s) return;
            const v = el.value.trim();
            if (el.dataset.k) s[el.dataset.k] = v;
            else if (el.dataset.f) { s.fields = s.fields || {}; s.fields[el.dataset.f] = v; }
            else if (el.dataset.if) {
                const list = s.lists[el.dataset.l];
                const item = list && list[Number(el.dataset.i)];
                if (item) item[el.dataset.if] = v;
            }
        });
        Object.keys(editors).forEach((si) => {
            const q = editors[si];
            const html = q.root.innerHTML;
            sectionState[Number(si)].html = (html === "<p><br></p>") ? "" : html;
        });
    }

    function onListClick(e) {
        const btn = e.target.closest("button");
        if (!btn) return;
        const listEl = btn.closest(".pc-list");
        if (!listEl) return;
        collectFromDom();
        const s = sectionState[Number(listEl.dataset.s)];
        const list = s.lists[listEl.dataset.l];
        const itemEl = btn.closest(".pc-list-item");
        const i = itemEl ? Number(itemEl.dataset.i) : -1;
        if (btn.classList.contains("pc-item-add")) {
            const last = list[list.length - 1] || {};
            const blank = {};
            // new item: same fields as the last one; keeps its icon so it matches the design
            Object.keys(last).forEach((k) => (blank[k] = k === "icon" ? last[k] : ""));
            list.push(blank);
        } else if (btn.classList.contains("pc-item-remove")) {
            if (list.length <= 1) return;
            if (!confirm("Remove this item? It is only removed from the website when you click Save & Publish.")) return;
            list.splice(i, 1);
        } else if (btn.classList.contains("pc-item-up") && i > 0) {
            [list[i - 1], list[i]] = [list[i], list[i - 1]];
        } else if (btn.classList.contains("pc-item-down") && i < list.length - 1) {
            [list[i + 1], list[i]] = [list[i], list[i + 1]];
        } else return;
        const y = window.scrollY;
        renderSections();
        window.scrollTo(0, y);
    }

    // ------------------------------------------------------------------
    // Save
    // ------------------------------------------------------------------
    async function save() {
        if (!currentPage) return;
        const btn = els.savePageContentBtn;
        btn.disabled = true;
        btn.textContent = "Saving...";

        try {
            collectFromDom();
            const record = {
                hero_eyebrow: els.pcHeroEyebrow.value.trim(),
                hero_title: els.pcHeroTitle.value.trim(),
                hero_subtitle: els.pcHeroSubtitle.value.trim(),
                hero_button_text: els.pcHeroButtonText.value.trim(),
                hero_button_link: els.pcHeroButtonLink.value.trim(),
                hero_image_url: els.pcHeroImageUrl.value.trim(),
                seo_title: els.pcSeoTitle.value.trim(),
                seo_description: els.pcSeoDescription.value.trim(),
                seo_keywords: els.pcSeoKeywords.value.trim(),
                sections: sectionState
            };
            if (els.pcOgImageUrl) record.og_image_url = els.pcOgImageUrl.value.trim();

            if (currentPage.page_key === "home") {
                // Homepage hero text/video: the site_settings row (single source).
                const { error } = await CrudEngine.sb.from("site_settings").update({
                    hero_title: els.pcSsHeroTitle.value.trim(),
                    hero_subtitle: els.pcSsHeroSubtitle.value.trim(),
                    hero_tagline: els.pcSsHeroTagline.value.trim(),
                    hero_tagline_color: els.pcSsHeroTaglineColor.value.trim(),
                    hero_video_url: els.pcSsHeroVideoUrl.value.trim()
                }).eq("id", 1);
                if (error) throw error;
            }

            await CrudEngine.update("pages", currentPage.id, record);
            showToast("Page content saved — live on the website");
            await openPage(currentPage.page_key);
        } catch (err) {
            console.error("Save failed:", err);
            showToast("Save failed: " + err.message, true);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Save & Publish';
        }
    }

    async function uploadHeroImage(file) {
        if (!file) return;
        try {
            const url = await CrudEngine.uploadImage("site-media", file, "pages");
            els.pcHeroImageUrl.value = url;
            renderImagePreview(els.pcHeroImagePreview, url);
            showToast("Image uploaded");
        } catch (err) {
            showToast("Upload failed: " + err.message, true);
        }
    }

    function bindEvents() {
        els.pageContentSelect.addEventListener("change", (e) => openPage(e.target.value));
        els.savePageContentBtn.addEventListener("click", save);
        els.pcRetryBtn.addEventListener("click", () => openPage(currentPageKey));
        els.pcCreatePageBtn.addEventListener("click", createCurrentPage);
        els.pcSectionsList.addEventListener("click", onListClick);
        const heroImageInput = document.getElementById("pcHeroImageUpload");
        if (heroImageInput) heroImageInput.addEventListener("change", (e) => uploadHeroImage(e.target.files[0]));
        els.pcHeroImageUrl.addEventListener("change", () => renderImagePreview(els.pcHeroImagePreview, els.pcHeroImageUrl.value.trim()));
    }

    document.addEventListener("DOMContentLoaded", () => {
        cacheEls();
        bindEvents();
    });

    return { load, openPage, isQuillSafe };
})();

window.PageContentModule = PageContentModule;
