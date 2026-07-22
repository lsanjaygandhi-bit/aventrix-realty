/*
 * AVENTRIX REALTY — PUBLIC SITE SETTINGS LOADER
 * ------------------------------------------------
 * Applies the single `site_settings` row (hero banner text, realtor
 * contact details) to the existing DOM elements. If an element isn't
 * present on a given page, it's silently skipped — this script is
 * safe to include on every page.
 */

(function () {
    const sb = window.supabaseClient;
    if (!sb) return;

    sb.from("site_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle()
        .then(({ data }) => {
            if (!data) return;

            setText("heroTitle", data.hero_title);
            setText("heroSubtitle", data.hero_subtitle);
            setText("heroTagline", data.hero_tagline);

            // Phone numbers appear in several places (header, nav, footer)
            // sharing the same value — update every element carrying the
            // matching data-attribute instead of a single id.
            if (data.realtor_phone_1) {
                document.querySelectorAll('[data-site="phone1"]').forEach((el) => {
                    if (el.tagName === "A") {
                        el.href = "tel:" + data.realtor_phone_1.replace(/\s+/g, "");
                    } else {
                        el.textContent = data.realtor_phone_1_display || data.realtor_phone_1;
                    }
                });
            }
            if (data.realtor_email) {
                document.querySelectorAll('[data-site="email"]').forEach((el) => {
                    el.textContent = data.realtor_email;
                });
            }
        });

    function setText(id, value) {
        if (!value) return;
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
})();
