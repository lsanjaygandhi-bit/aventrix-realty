/*
 * AVENTRIX REALTY — OUR LEGACY (sidebar shortcut)  (v2, 2026-09-26)
 * -------------------------------------------
 * "Our Legacy" is the `about-legacy` section of the Homepage row in the
 * `pages` table, shown on the About Us page. It is now edited with the
 * same structured editor as every other section (subtitle, timeline
 * entries with year / title / text, closing line), so this menu entry
 * simply opens Website Content → Homepage at that section.
 *
 * (The previous stand-alone Quill editor re-saved the timeline HTML
 * through Quill, which drops the page's layout markup — the timeline
 * would have lost its year/dot layout on the first save.)
 */
const LegacyContentModule = (function () {
    async function load() {
        if (typeof window.AventrixShowSection === "function") window.AventrixShowSection("content");
        if (window.PageContentModule) {
            await window.PageContentModule.load();
            await window.PageContentModule.openPage("home", { focus: "about-legacy" });
        }
    }
    return { load };
})();
window.LegacyContentModule = LegacyContentModule;
