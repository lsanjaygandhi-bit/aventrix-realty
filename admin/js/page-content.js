/*
 * AVENTRIX REALTY — WEBSITE CONTENT (PAGES) MODULE
 * -------------------------------------------
 * ONE generic editor, reused for every content page (Homepage,
 * Joint Venture, NRI Services, List With Us, Free Valuation,
 * Contact, Insights hero, Our Realtors intro).
 *
 * Hybrid CMS approach (per approved plan):
 *   - Structured fields: hero eyebrow/title/subtitle/button/image,
 *     SEO title/description/keywords — separate inputs.
 *   - Body content: ONE rich-text block PER SECTION (Quill editor),
 *     not a separate field per sentence/paragraph.
 *
 * Data lives in the `pages` table, one row per page_key.
 * See js/public-page-content.js for how this renders on the
 * public site.
 */

const PAGES_LIST = [
    { key: "home", label: "Homepage" },
    { key: "joint-venture", label: "Joint Venture" },
    { key: "nri-services", label: "NRI Services" },
    { key: "list-with-us", label: "List With Us" },
    { key: "free-valuation", label: "Free Property Valuation" },
    { key: "contact", label: "Contact" },
    { key: "insights", label: "Insights (page intro)" },
    { key: "our-realtors", label: "Our Realtors (page intro)" }
];

const PageContentModule = (function () {
    let currentPage = null;    // full row from `pages`
    let currentPageKey = null; // key currently selected in the dropdown
    let sectionEditors = {};   // sectionKey -> Quill instance
    const els = {};

    function cacheEls() {
        [
            "pageContentSelect", "pageContentForm", "pageContentEmpty",
            "pageContentLoading", "pageContentError", "pageContentErrorMsg",
            "pcRetryBtn", "pcCreatePageBtn",
            "pcHeroEyebrow", "pcHeroTitle", "pcHeroSubtitle",
            "pcHeroButtonText", "pcHeroButtonLink", "pcHeroImageUrl", "pcHeroImagePreview",
            "pcSectionsList", "pcSeoTitle", "pcSeoDescription", "pcSeoKeywords",
            "savePageContentBtn"
        ].forEach((id) => (els[id] = document.getElementById(id)));
    }

    function populateSelect() {
        els.pageContentSelect.innerHTML =
            '<option value="">Choose a page to edit…</option>' +
            PAGES_LIST.map((p) => `<option value="${p.key}">${p.label}</option>`).join("");
    }

    async function load() {
        if (!els.pageContentSelect.options.length) populateSelect();
    }

    // ---- View-state control -------------------------------------------
    // Exactly one of these panels is visible at a time:
    //   idle     -> nothing selected yet
    //   loading  -> query in flight
    //   error    -> query failed (real Supabase/network error)
    //   notfound -> query succeeded but no row exists for this page yet
    //   form     -> row loaded, editing form visible
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

    async function openPage(pageKey) {
        currentPageKey = pageKey || null;

        if (!pageKey) {
            currentPage = null;
            setState("idle");
            return;
        }

        setState("loading");

        let data;
        try {
            const { data: row, error } = await CrudEngine.sb
                .from("pages")
                .select("*")
                .eq("page_key", pageKey)
                .maybeSingle();

            if (error) {
                // Real database/network/RLS error — never silently swallow
                // this and never create a row on top of it.
                throw error;
            }

            data = row; // null here means "no row yet", not an error
        } catch (err) {
            console.error("Failed to load page content for '" + pageKey + "':", err);
            setState("error", { message: "Unable to load page content: " + (err && err.message ? err.message : "Unknown error. See console for details.") });
            return;
        }

        if (!data) {
            // Query succeeded, the row genuinely doesn't exist yet.
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
    }

    async function createCurrentPage() {
        if (!currentPageKey) return;
        const meta = PAGES_LIST.find((p) => p.key === currentPageKey);
        const btn = els.pcCreatePageBtn;
        btn.disabled = true;
        try {
            const data = await CrudEngine.insert("pages", { page_key: currentPageKey, page_label: meta ? meta.label : currentPageKey, sections: [] });
            currentPage = data;
            renderForm(data);
            setState("form");
            showToast("Page content created — edit and Save & Publish to go live");
        } catch (err) {
            console.error("Failed to create page content row:", err);
            setState("error", { message: "Unable to create page content: " + (err && err.message ? err.message : "Unknown error. See console for details.") });
        } finally {
            btn.disabled = false;
        }
    }

    function renderForm(p) {
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

        renderSections(p.sections || []);
    }

    function renderImagePreview(el, url) {
        if (!el) return;
        el.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="">` : "";
    }

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function renderSections(sections) {
        sectionEditors = {};
        const sorted = [...sections].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

        if (!sorted.length) {
            els.pcSectionsList.innerHTML = `<p class="helper-text">No content sections on this page yet. Click "Add Section" to create one.</p>`;
            return;
        }

        els.pcSectionsList.innerHTML = sorted.map((s, i) => `
            <div class="admin-card pc-section-block" data-section-key="${escapeHtml(s.key)}" style="margin-bottom:14px;">
                <div class="admin-form-grid">
                    <div class="admin-field">
                        <label>Section Key (internal)</label>
                        <input type="text" class="pc-s-key" value="${escapeHtml(s.key)}" placeholder="e.g. about-legacy">
                    </div>
                    <div class="admin-field">
                        <label>Eyebrow (small label above heading)</label>
                        <input type="text" class="pc-s-eyebrow" value="${escapeHtml(s.eyebrow)}">
                    </div>
                    <div class="admin-field full">
                        <label>Section Heading</label>
                        <input type="text" class="pc-s-heading" value="${escapeHtml(s.heading)}">
                    </div>
                    <div class="admin-field">
                        <label>Image URL (optional)</label>
                        <input type="text" class="pc-s-image" value="${escapeHtml(s.image_url)}">
                    </div>
                    <div class="admin-field">
                        <label>Display Order</label>
                        <input type="number" class="pc-s-order" value="${s.display_order ?? i}">
                    </div>
                    <div class="admin-field full">
                        <label>Content</label>
                        <div class="pc-quill-editor" id="quill-${escapeHtml(s.key)}"></div>
                        <p class="helper-text pc-quill-missing" id="quill-missing-${escapeHtml(s.key)}" style="display:none; color:var(--admin-danger);">
                            Rich text editor failed to load (Quill is missing). Your existing content is safe, but reformatting is unavailable right now — refresh the page and try again.
                        </p>
                    </div>
                </div>
                <div style="display:flex; justify-content:flex-end; margin-top:10px;">
                    <button type="button" class="admin-btn secondary danger pc-remove-section"><i class="fas fa-trash"></i> Remove Section</button>
                </div>
            </div>
        `).join("");

        sorted.forEach((s) => {
            const editorEl = document.getElementById(`quill-${s.key}`);
            if (!editorEl) return;

            if (typeof Quill === "undefined") {
                // Don't let a missing Quill library silently drop content
                // or break the rest of the editor — surface it clearly and
                // keep the raw HTML around so Save still preserves it.
                console.error("Quill library is not loaded; section '" + s.key + "' will not have a rich text editor.");
                const missingMsg = document.getElementById(`quill-missing-${s.key}`);
                if (missingMsg) missingMsg.style.display = "block";
                editorEl.dataset.rawHtml = s.html || "";
                editorEl.textContent = "(Rich text editor unavailable — raw content preserved.)";
                return;
            }

            const quill = new Quill(editorEl, {
                theme: "snow",
                modules: { toolbar: [["bold", "italic"], [{ header: [2, 3, false] }], ["link"], [{ list: "ordered" }, { list: "bullet" }], ["clean"]] }
            });
            quill.root.innerHTML = s.html || "";
            sectionEditors[s.key] = quill;
        });

        document.querySelectorAll(".pc-remove-section").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                if (!confirm("Remove this section? This can't be undone until you save.")) return;
                e.target.closest(".pc-section-block").remove();
            });
        });
    }

    function addSection() {
        const key = prompt("Section key (internal identifier, e.g. 'intro' or 'why-choose-us'):");
        if (!key) return;
        const existing = collectSectionsFromDom();
        existing.push({ key, eyebrow: "", heading: "", html: "", image_url: "", display_order: existing.length });
        renderSections(existing);
    }

    function collectSectionsFromDom() {
        return Array.from(document.querySelectorAll(".pc-section-block")).map((block) => {
            const key = block.querySelector(".pc-s-key").value.trim();
            const editorEl = block.querySelector(".pc-quill-editor");
            return {
                key,
                eyebrow: block.querySelector(".pc-s-eyebrow").value.trim(),
                heading: block.querySelector(".pc-s-heading").value.trim(),
                image_url: block.querySelector(".pc-s-image").value.trim(),
                display_order: parseInt(block.querySelector(".pc-s-order").value, 10) || 0,
                // Prefer the live Quill instance; fall back to the raw HTML
                // we preserved if Quill failed to load for this section.
                html: sectionEditors[key] ? sectionEditors[key].root.innerHTML : (editorEl && editorEl.dataset.rawHtml) || ""
            };
        });
    }

    async function save() {
        if (!currentPage) return;
        const btn = els.savePageContentBtn;
        btn.disabled = true;
        btn.textContent = "Saving...";

        try {
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
                sections: collectSectionsFromDom()
            };
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
        document.getElementById("pcAddSectionBtn").addEventListener("click", addSection);
        els.savePageContentBtn.addEventListener("click", save);
        els.pcRetryBtn.addEventListener("click", () => openPage(currentPageKey));
        els.pcCreatePageBtn.addEventListener("click", createCurrentPage);
        const heroImageInput = document.getElementById("pcHeroImageUpload");
        if (heroImageInput) heroImageInput.addEventListener("change", (e) => uploadHeroImage(e.target.files[0]));
    }

    document.addEventListener("DOMContentLoaded", () => {
        cacheEls();
        bindEvents();
    });

    return { load, openPage };
})();

window.PageContentModule = PageContentModule;
