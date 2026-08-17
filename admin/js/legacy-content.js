/*
 * AVENTRIX REALTY — OUR LEGACY (DEDICATED SIDEBAR EDITOR)
 * -------------------------------------------
 * "Our Legacy" is not a separate database table — it's the section
 * with key "about-legacy" inside the Homepage row's `sections` JSONB
 * in the SAME `pages` table Website Content already uses (see
 * admin/js/page-content.js and sql/seed-cms-content.sql). This module
 * gives it its own direct sidebar entry instead of requiring the
 * admin to open Website Content → Homepage → scroll to find it.
 *
 * Saving here only ever touches the `sections` column of the
 * Homepage (`page_key = 'home'`) row — every other Homepage field
 * (hero, other sections, SEO) is left completely untouched.
 */

const LegacyContentModule = (function () {
    const SECTION_KEY = "about-legacy";
    const PAGE_KEY = "home";

    let homePage = null;   // full `pages` row for page_key = 'home'
    let quill = null;
    const els = {};

    function cacheEls() {
        [
            "legacyForm", "legacyLoading", "legacyError", "legacyErrorMsg",
            "legacyRetryBtn", "legacyCreateBtn",
            "legacyEyebrow", "legacyHeading", "legacyQuillEditor", "legacyQuillMissing",
            "saveLegacyBtn"
        ].forEach((id) => (els[id] = document.getElementById(id)));
    }

    function setState(state, opts = {}) {
        els.legacyLoading.style.display = state === "loading" ? "block" : "none";
        els.legacyForm.style.display = state === "form" ? "block" : "none";

        if (state === "error" || state === "notfound") {
            els.legacyError.style.display = "block";
            els.legacyErrorMsg.textContent = opts.message || "";
            els.legacyCreateBtn.style.display = state === "notfound" ? "inline-flex" : "none";
        } else {
            els.legacyError.style.display = "none";
        }
    }

    function findLegacySection(page) {
        return (page.sections || []).find((s) => s.key === SECTION_KEY) || null;
    }

    async function load() {
        setState("loading");

        let data;
        try {
            const { data: row, error } = await CrudEngine.sb
                .from("pages")
                .select("*")
                .eq("page_key", PAGE_KEY)
                .maybeSingle();

            if (error) throw error;
            data = row;
        } catch (err) {
            console.error("Failed to load Our Legacy content:", err);
            setState("error", { message: "Unable to load Our Legacy content: " + (err && err.message ? err.message : "Unknown error. See console for details.") });
            return;
        }

        if (!data) {
            // The Homepage row itself doesn't exist yet in `pages`.
            homePage = null;
            setState("notfound", { message: `The Homepage record doesn't exist yet in the "pages" table, so there's no Our Legacy content to load. Click "Create Legacy Content" to start one.` });
            return;
        }

        homePage = data;
        const section = findLegacySection(data);

        if (!section) {
            // Homepage row exists, but has no "about-legacy" section yet.
            setState("notfound", { message: `The Homepage record exists, but has no "Our Legacy" section yet. Click "Create Legacy Content" to add one.` });
            return;
        }

        try {
            renderForm(section);
        } catch (err) {
            console.error("Failed to render Our Legacy form:", err);
            setState("error", { message: "Unable to display the editor: " + (err && err.message ? err.message : "Unknown error. See console for details.") });
            return;
        }
        setState("form");
    }

    async function createLegacySection() {
        const btn = els.legacyCreateBtn;
        btn.disabled = true;
        try {
            const newSection = { key: SECTION_KEY, eyebrow: "", heading: "Our Legacy", html: "", image_url: "", display_order: 0 };

            if (!homePage) {
                // No Homepage row at all yet — create it with just this section.
                homePage = await CrudEngine.insert("pages", { page_key: PAGE_KEY, page_label: "Homepage", sections: [newSection] });
            } else {
                const sections = [...(homePage.sections || []), newSection];
                homePage = await CrudEngine.update("pages", homePage.id, { sections });
            }

            renderForm(findLegacySection(homePage));
            setState("form");
            showToast("Our Legacy section created — edit and Save & Publish to go live");
        } catch (err) {
            console.error("Failed to create Our Legacy section:", err);
            setState("error", { message: "Unable to create Our Legacy content: " + (err && err.message ? err.message : "Unknown error. See console for details.") });
        } finally {
            btn.disabled = false;
        }
    }

    function renderForm(section) {
        els.legacyEyebrow.value = section.eyebrow || "";
        els.legacyHeading.value = section.heading || "";

        quill = null;
        els.legacyQuillMissing.style.display = "none";
        els.legacyQuillEditor.innerHTML = "";
        delete els.legacyQuillEditor.dataset.rawHtml;

        if (typeof Quill === "undefined") {
            console.error("Quill library is not loaded; Our Legacy will not have a rich text editor.");
            els.legacyQuillMissing.style.display = "block";
            els.legacyQuillEditor.dataset.rawHtml = section.html || "";
            els.legacyQuillEditor.textContent = "(Rich text editor unavailable — raw content preserved.)";
            return;
        }

        quill = new Quill(els.legacyQuillEditor, {
            theme: "snow",
            modules: { toolbar: [["bold", "italic"], [{ header: [2, 3, false] }], ["link"], [{ list: "ordered" }, { list: "bullet" }], ["clean"]] }
        });
        quill.root.innerHTML = section.html || "";
    }

    async function save() {
        if (!homePage) return;
        const btn = els.saveLegacyBtn;
        btn.disabled = true;
        btn.textContent = "Saving...";

        try {
            const existing = findLegacySection(homePage) || { key: SECTION_KEY, display_order: 0, image_url: "" };
            const updatedSection = {
                ...existing,
                key: SECTION_KEY,
                eyebrow: els.legacyEyebrow.value.trim(),
                heading: els.legacyHeading.value.trim(),
                html: quill ? quill.root.innerHTML : (els.legacyQuillEditor.dataset.rawHtml || existing.html || "")
            };

            const sections = (homePage.sections || []).some((s) => s.key === SECTION_KEY)
                ? homePage.sections.map((s) => (s.key === SECTION_KEY ? updatedSection : s))
                : [...(homePage.sections || []), updatedSection];

            // Only the `sections` column is written — every other Homepage
            // field (hero, other sections, SEO) is left untouched.
            homePage = await CrudEngine.update("pages", homePage.id, { sections });
            showToast("Our Legacy saved — live on the website");
            renderForm(findLegacySection(homePage));
        } catch (err) {
            console.error("Save failed:", err);
            showToast("Save failed: " + err.message, true);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Save & Publish';
        }
    }

    function bindEvents() {
        els.saveLegacyBtn.addEventListener("click", save);
        els.legacyRetryBtn.addEventListener("click", load);
        els.legacyCreateBtn.addEventListener("click", createLegacySection);
    }

    document.addEventListener("DOMContentLoaded", () => {
        cacheEls();
        bindEvents();
    });

    return { load };
})();

window.LegacyContentModule = LegacyContentModule;
