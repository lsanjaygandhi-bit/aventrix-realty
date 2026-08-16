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
                el.innerHTML = r.specializations.map((s) => s).join("<br>\n");
            });
        }

        document.querySelectorAll("[data-realtor-phone]").forEach((el) => {
            if (!r.phone) return;
            el.setAttribute("href", "tel:" + r.phone.replace(/\s+/g, ""));
            const label = el.querySelector("span") || el;
            if (label !== el) label.textContent = r.phone; else el.lastChild && (el.lastChild.textContent = " " + r.phone);
        });
        document.querySelectorAll("[data-realtor-whatsapp]").forEach((el) => {
            if (r.whatsapp) el.setAttribute("href", "https://wa.me/" + r.whatsapp);
        });
        document.querySelectorAll("[data-realtor-email]").forEach((el) => {
            if (!r.email) return;
            el.setAttribute("href", "mailto:" + r.email);
        });

        if (r.name) document.title = `${r.name} | Aventrix Realty`;
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
