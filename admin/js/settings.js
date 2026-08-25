/*
 * AVENTRIX REALTY — SITE SETTINGS MODULE
 * -------------------------------------------
 * Edits the single `site_settings` row (id = 1). This table already
 * had several columns (footer, social links, WhatsApp, branding)
 * that the public site was reading (see js/public-site-settings.js)
 * but that had no Admin form field — this module now covers all of
 * them, so every value Admin can see here actually reaches the
 * public website, and nothing is hard-coded that Admin can't change.
 */

const SettingsModule = (function () {
    async function load() {
        const { data } = await window.supabaseClient.from("site_settings").select("*").eq("id", 1).maybeSingle();
        if (!data) return;

        // Hero
        setVal("setHeroTitle", data.hero_title);
        setVal("setHeroSubtitle", data.hero_subtitle);
        setVal("setHeroTagline", data.hero_tagline);
        setVal("setHeroTaglineColor", data.hero_tagline_color || "#D4AF37");
        setVal("setHeroVideoUrl", data.hero_video_url);

        // Contact
        setVal("setPhone1", data.realtor_phone_1);
        setVal("setPhone1Display", data.realtor_phone_1_display);
        setVal("setPhone2", data.realtor_phone_2);
        setVal("setEmail", data.realtor_email);
        setVal("setWhatsapp", data.whatsapp_number);
        setVal("setReraNo", data.rera_registration_no);

        // Branding
        setVal("setLogoUrl", data.logo_url);
        setVal("setFaviconUrl", data.favicon_url);

        // Footer
        setVal("setFooterTagline", data.footer_tagline);
        setVal("setFooterDescription", data.footer_description);
        setVal("setCopyrightText", data.copyright_text);

        // Social links
        setVal("setSocialFacebook", data.social_facebook);
        setVal("setSocialInstagram", data.social_instagram);
        setVal("setSocialLinkedin", data.social_linkedin);
        setVal("setSocialYoutube", data.social_youtube);
    }

    function setVal(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value || "";
    }

    function getVal(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    }

    async function save() {
        const btn = document.getElementById("saveSettingsBtn");
        btn.disabled = true;
        btn.textContent = "Saving...";

        const record = {
            id: 1,
            hero_title: getVal("setHeroTitle"),
            hero_subtitle: getVal("setHeroSubtitle"),
            hero_tagline: getVal("setHeroTagline"),
            hero_tagline_color: getVal("setHeroTaglineColor"),
            hero_video_url: getVal("setHeroVideoUrl"),

            realtor_phone_1: getVal("setPhone1"),
            realtor_phone_1_display: getVal("setPhone1Display"),
            realtor_phone_2: getVal("setPhone2"),
            realtor_email: getVal("setEmail"),
            whatsapp_number: getVal("setWhatsapp"),
            rera_registration_no: getVal("setReraNo"),

            logo_url: getVal("setLogoUrl"),
            favicon_url: getVal("setFaviconUrl"),

            footer_tagline: getVal("setFooterTagline"),
            footer_description: getVal("setFooterDescription"),
            copyright_text: getVal("setCopyrightText"),

            social_facebook: getVal("setSocialFacebook"),
            social_instagram: getVal("setSocialInstagram"),
            social_linkedin: getVal("setSocialLinkedin"),
            social_youtube: getVal("setSocialYoutube")
        };

        try {
            const { error } = await window.supabaseClient.from("site_settings").upsert(record);
            if (error) throw error;
            showToast("Settings saved — live on the website");
        } catch (err) {
            showToast("Save failed: " + err.message, true);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Save Changes';
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("saveSettingsBtn").addEventListener("click", save);
    });

    return { load };
})();

window.SettingsModule = SettingsModule;
