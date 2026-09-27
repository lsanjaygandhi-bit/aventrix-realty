// Reads every [data-cms-section] on the CURRENT (static) page using the
// same hooks js/public-page-content.js applies, and returns the page's
// content as a `pages` row (sections JSON + hero + SEO). Used to seed
// the CMS with exactly what the live page shows — nothing invented.
(() => {
    const norm = (h) => String(h == null ? "" : h).replace(/\s+/g, " ").trim();
    const val = (el) => {
        // plain text when the element has no child elements, else HTML
        return el.children.length ? norm(el.innerHTML) : norm(el.textContent);
    };
    const own = (wrap, sel) => (wrap.matches(sel) ? [wrap] : []).concat(Array.from(wrap.querySelectorAll(sel))).filter((el) => {
        const item = el.closest("[data-cms-item]");
        return (!item || !wrap.contains(item) || item === wrap) && el.closest("[data-cms-section]") === wrap;
    });
    const imgOf = (el) => {
        if (el.tagName === "IMG") return el.getAttribute("src") || "";
        if (el.tagName === "VIDEO") return el.getAttribute("poster") || "";
        const m = (el.getAttribute("style") || "").match(/background-image\s*:\s*url\((['"]?)(.*?)\1\)/i);
        return m ? m[2] : "";
    };
    function readItem(node) {
        const item = {};
        [node].concat(Array.from(node.querySelectorAll("*"))).forEach((el) => {
            const f = el.getAttribute("data-cms-f"); if (f !== null) item[f] = val(el);
            const h = el.getAttribute("data-cms-href"); if (h !== null) item[h] = el.getAttribute("href") || "";
            const s = el.getAttribute("data-cms-src"); if (s !== null) item[s] = el.getAttribute("src") || "";
            const a = el.getAttribute("data-cms-alt"); if (a !== null && !(a in item)) item[a] = el.getAttribute("alt") || "";
            const b = el.getAttribute("data-cms-bg"); if (b !== null) item[b] = imgOf(el);
            const c = el.getAttribute("data-cms-class"); if (c !== null) item[c] = el.getAttribute("class") || "";
        });
        return item;
    }
    const sections = [];
    let order = 1;
    document.querySelectorAll("[data-cms-section]").forEach((wrap) => {
        const s = { key: wrap.getAttribute("data-cms-section") };
        if (wrap.getAttribute("data-cms-page")) s.__page = wrap.getAttribute("data-cms-page");
        if (wrap.getAttribute("data-cms-label")) s.label = wrap.getAttribute("data-cms-label");
        const e = own(wrap, "[data-cms-eyebrow]")[0]; s.eyebrow = e ? val(e) : "";
        const h = own(wrap, "[data-cms-heading]")[0]; s.heading = h ? val(h) : "";
        const c = own(wrap, "[data-cms-content]")[0];
        if (c) {
            const clone = c.cloneNode(true);
            const pc = c.getAttribute("data-cms-p-class");
            if (pc) Array.from(clone.children).forEach((p) => {
                if (p.tagName !== "P") return;
                pc.split(/\s+/).forEach((k) => p.classList.remove(k));
                if (!p.getAttribute("class")) p.removeAttribute("class");
            });
            s.html = norm(clone.innerHTML);
        } else s.html = "";
        const im = own(wrap, "[data-cms-image]")[0]; s.image_url = im ? imgOf(im) : "";
        const fields = {};
        own(wrap, "[data-cms-f]").forEach((el) => { fields[el.getAttribute("data-cms-f")] = val(el); });
        own(wrap, "[data-cms-href]").forEach((el) => { fields[el.getAttribute("data-cms-href")] = el.getAttribute("href") || ""; });
        own(wrap, "[data-cms-src]").forEach((el) => { fields[el.getAttribute("data-cms-src")] = el.getAttribute("src") || ""; });
        own(wrap, "[data-cms-bg]").forEach((el) => { fields[el.getAttribute("data-cms-bg")] = imgOf(el); });
        if (Object.keys(fields).length) s.fields = fields;
        const lists = {};
        own(wrap, "[data-cms-list]").forEach((listEl) => {
            lists[listEl.getAttribute("data-cms-list")] = Array.from(listEl.children).filter((ch) => ch.hasAttribute("data-cms-item")).map(readItem);
        });
        if (Object.keys(lists).length) s.lists = lists;
        s.hooks = [];
        if (e) s.hooks.push("eyebrow");
        if (h) s.hooks.push("heading");
        if (c) s.hooks.push("html");
        if (im) s.hooks.push("image_url");
        s.display_order = order++;
        sections.push(s);
    });
    const q = (sel) => document.querySelector(sel);
    const hero = {};
    const he = q("[data-page-hero-eyebrow]"); if (he) hero.hero_eyebrow = val(he);
    const ht = q("[data-page-hero-title]"); if (ht) hero.hero_title = val(ht);
    const hs = q("[data-page-hero-subtitle]"); if (hs) hero.hero_subtitle = val(hs);
    const hb = q("[data-page-hero-button]"); if (hb) { hero.hero_button_text = val(hb); hero.hero_button_link = hb.getAttribute("href") || ""; }
    const hi = q("[data-page-hero-image]"); if (hi) hero.hero_image_url = imgOf(hi);
    const meta = (n, a = "name") => { const m = q(`meta[${a}="${n}"]`); return m ? norm(m.getAttribute("content")) : ""; };
    return {
        page_key: document.body.getAttribute("data-page-key"),
        hero,
        seo_title: norm(document.title),
        seo_description: meta("description"),
        seo_keywords: meta("keywords"),
        og_image_url: meta("og:image", "property"),
        sections
    };
})()
