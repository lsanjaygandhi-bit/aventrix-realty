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

            // Tagline color — inline style takes precedence over the CSS
            // default (#D4AF37 gold) only when Admin has set a value, so
            // the color never silently reverts to a hard-coded override.
            if (data.hero_tagline_color) {
                const taglineEl = document.getElementById("heroTagline");
                if (taglineEl) taglineEl.style.color = data.hero_tagline_color;
            }

            // Hero background video — swap the <source> and reload only
            // if Admin has set an override; otherwise the existing local
            // video file keeps playing exactly as before.
            if (data.hero_video_url) {
                const videoEl = document.getElementById("heroVideo");
                const sourceEl = videoEl && videoEl.querySelector("source");
                if (videoEl && sourceEl && sourceEl.getAttribute("src") !== data.hero_video_url) {
                    sourceEl.setAttribute("src", data.hero_video_url);
                    videoEl.load();
                }
            }

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

            // Additive fields — footer, socials, WhatsApp. No-op on pages
            // that don't have matching elements.
            setTextBySelector("[data-site='footer-tagline']", data.footer_tagline);
            setTextBySelector("[data-site='footer-description']", data.footer_description);
            setTextBySelector("[data-site='copyright-text']", data.copyright_text);

            if (data.whatsapp_number) {
                document.querySelectorAll('[data-site="whatsapp-link"]').forEach((el) => {
                    el.setAttribute("href", "https://wa.me/" + data.whatsapp_number.replace(/\D/g, ""));
                });
            }
            setHrefBySelector("[data-site='social-facebook']", data.social_facebook);
            setHrefBySelector("[data-site='social-instagram']", data.social_instagram);
            setHrefBySelector("[data-site='social-linkedin']", data.social_linkedin);
            setHrefBySelector("[data-site='social-youtube']", data.social_youtube);

            // Favicon — safe to apply automatically (no layout impact).
            // Logo: intentionally NOT auto-applied here. The current
            // header logo is styled text (AVENTRIX / REALTY spans), not
            // an <img>; swapping it for an uploaded image would be a
            // visual design change beyond what was requested, so
            // logo_url is stored and Admin-editable for future use but
            // not wired into the header markup.
            if (data.favicon_url) {
                let icon = document.querySelector('link[rel="icon"]');
                if (!icon) {
                    icon = document.createElement("link");
                    icon.setAttribute("rel", "icon");
                    document.head.appendChild(icon);
                }
                icon.setAttribute("href", data.favicon_url);
            }
        });

    function setTextBySelector(selector, value) {
        if (!value) return;
        document.querySelectorAll(selector).forEach((el) => (el.textContent = value));
    }

    function setHrefBySelector(selector, value) {
        if (!value) return;
        document.querySelectorAll(selector).forEach((el) => el.setAttribute("href", value));
    }

    function setText(id, value) {
        if (!value) return;
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
})();
