/*
 * AVENTRIX REALTY — PUBLIC REALTORS LOADER
 * ------------------------------------------------
 * Fetches from the `realtors` table and reuses the EXISTING render
 * functions in script.js (renderRealtorsGrid / renderRealtorProfile)
 * so the grid, profile pages, and Sanjay/Gnanasekaran pages keep
 * their original markup and styling. realtors-data.js is kept only
 * as an offline fallback if Supabase is unreachable.
 */

(function () {
    const sb = window.supabaseClient;
    if (!sb) return;

    sb.from("realtors")
        .select("*")
        .eq("publish_status", "Published")
        .order("display_order", { ascending: true })
        .then(({ data }) => {
            if (!data || !data.length) return; // keep the existing static/fallback data

            window.REALTORS_DATA = data.map((r) => ({
                id: r.slug,
                name: r.name,
                designation: r.designation,
                photo: r.photo_url,
                shortIntro: r.short_intro,
                profileLink: r.profile_link || null,
                about: r.about,
                expertise: r.expertise || [],
                experience: r.experience,
                languages: r.languages || [],
                specializations: r.specializations || [],
                phone: r.phone,
                email: r.email,
                whatsapp: r.whatsapp
            }));

            if (typeof window.renderRealtorsGrid === "function") window.renderRealtorsGrid();
            if (typeof window.renderRealtorProfile === "function") window.renderRealtorProfile();
            applyStaticRealtorPage(data);
        });

    // ---------------------------------------------------------
    // DEDICATED STATIC PROFILE PAGES (sanjay.html, gnanasekaran.html)
    // These keep their own custom layout, but pull their editable
    // fields from the SAME `realtors` table via [data-realtor-slug]
    // on <body>, so there's one source of truth in Admin instead of
    // two.
    // ---------------------------------------------------------
    function applyStaticRealtorPage(realtors) {
        const slug = document.body.getAttribute("data-realtor-slug");
        if (!slug) return;

        const r = realtors.find((x) => x.slug === slug);
        if (!r) return;

        setImg("[data-realtor-photo]", r.photo_url);
        setText("[data-realtor-name]", r.name);
        setText("[data-realtor-designation]", r.designation);
        setText("[data-realtor-intro]", r.short_intro);

        if (r.specializations && r.specializations.length) {
            document.querySelectorAll("[data-realtor-specializations]").forEach((el) => {
                el.innerHTML = r.specializations.map((x) => escapeHtml(x)).join("<br>\n");
            });
        }

        // Long-form profile fields (Admin → Our Realtors / Leadership).
        if (r.about && String(r.about).trim()) {
            document.querySelectorAll("[data-realtor-about]").forEach((box) => {
                const tpl = box.querySelector("p");
                const cls = tpl ? tpl.className : "profile-body-text";
                box.innerHTML = String(r.about).split(/\n\s*\n/).map((para) => para.trim()).filter(Boolean)
                    .map((para) => `<p class="${cls}">${escapeHtml(para).replace(/\n/g, "<br>")}</p>`).join("\n");
            });
        }
        setText("[data-realtor-experience]", r.experience);
        setList("[data-realtor-expertise]", r.expertise);
        setList("[data-realtor-languages]", r.languages);

        document.querySelectorAll("[data-realtor-phone]").forEach((el) => {
            if (!r.phone) return;
            el.setAttribute("href", "tel:" + r.phone.replace(/\s+/g, ""));
            const shown = formatPhone(r.phone);
            const label = el.querySelector("span") || el;
            if (label !== el) label.textContent = shown; else el.lastChild && (el.lastChild.textContent = " " + shown);
        });
        document.querySelectorAll("[data-realtor-whatsapp]").forEach((el) => {
            if (r.whatsapp) el.setAttribute("href", "https://wa.me/" + r.whatsapp);
        });
        document.querySelectorAll("[data-realtor-email]").forEach((el) => {
            if (!r.email) return;
            el.setAttribute("href", "mailto:" + r.email);
        });

        // <title> comes from the page's SEO fields (Admin → Website Content), not the realtor name.
    }

    // Tag lists (<span class="profile-tag">) or a <br>-separated paragraph —
    // whichever markup the page already uses.
    function setList(selector, values) {
        if (!Array.isArray(values) || !values.length) return;
        document.querySelectorAll(selector).forEach((el) => {
            const tag = el.querySelector(".profile-tag");
            if (tag) {
                el.innerHTML = values.map((v) => `<span class="${tag.className}">${escapeHtml(v)}</span>`).join("\n");
            } else {
                el.innerHTML = values.map((v) => escapeHtml(v)).join("<br>\n");
            }
        });
    }

    // "+917092356222" → "+91 70923 56222" (Indian mobile numbers); anything else unchanged.
    function formatPhone(p) {
        const d = String(p || "").replace(/\D/g, "");
        if (d.length === 12 && d.startsWith("91")) return "+91 " + d.slice(2, 7) + " " + d.slice(7);
        if (d.length === 10) return "+91 " + d.slice(0, 5) + " " + d.slice(5);
        return p;
    }

    function escapeHtml(str) {
        return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function setText(selector, value) {
        if (!value) return;
        document.querySelectorAll(selector).forEach((el) => (el.textContent = value));
    }

    function setImg(selector, value) {
        if (!value) return;
        document.querySelectorAll(selector).forEach((el) => (el.src = value));
    }
})();
