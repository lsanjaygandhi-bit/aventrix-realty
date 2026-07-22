/*
 * AVENTRIX REALTY — SITE SETTINGS MODULE
 * -------------------------------------------
 * Edits the single `site_settings` row (id = 1) that drives the
 * homepage hero banner text and realtor contact details on the
 * public site (see js/public-site-settings.js for how it's applied).
 */

const SettingsModule = (function () {
    async function load() {
        const { data } = await window.supabaseClient.from("site_settings").select("*").eq("id", 1).maybeSingle();
        if (!data) return;

        document.getElementById("setHeroTitle").value = data.hero_title || "";
        document.getElementById("setHeroSubtitle").value = data.hero_subtitle || "";
        document.getElementById("setHeroTagline").value = data.hero_tagline || "";
        document.getElementById("setPhone1").value = data.realtor_phone_1 || "";
        document.getElementById("setEmail").value = data.realtor_email || "";
    }

    async function save() {
        const btn = document.getElementById("saveSettingsBtn");
        btn.disabled = true;
        btn.textContent = "Saving...";

        const record = {
            id: 1,
            hero_title: document.getElementById("setHeroTitle").value.trim(),
            hero_subtitle: document.getElementById("setHeroSubtitle").value.trim(),
            hero_tagline: document.getElementById("setHeroTagline").value.trim(),
            realtor_phone_1: document.getElementById("setPhone1").value.trim(),
            realtor_email: document.getElementById("setEmail").value.trim()
        };

        try {
            const { error } = await window.supabaseClient.from("site_settings").upsert(record);
            if (error) throw error;
            showToast("Settings saved");
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
