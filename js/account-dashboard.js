/*
 * AVENTRIX REALTY — BUYER ACCOUNT DASHBOARD (account.html, logged in)
 * -------------------------------------------------------------------
 * Tabs: Matches · My Requirement · Saved Searches · My Enquiries ·
 * Profile. Every read/write goes to the buyer's OWN rows —
 * customer_profiles, buyer_requirements, saved_searches, enquiries —
 * and is enforced by Supabase RLS
 * (sql/migration-2026-09-25-02-p1-crm-buyer-analytics.sql), not by
 * this file.
 *
 * Wishlist / Shortlist / Recently Viewed keep using the existing
 * account-aware js/aventrix-storage.js (already synced to Supabase
 * on login, local data migrated without loss) — only their counts
 * are shown here.
 *
 * If the database migration hasn't been run yet, each tab shows a
 * friendly "not available yet" message instead of breaking the page.
 */
(function () {
    const sb = window.supabaseClient;
    const root = document.getElementById("acctLoggedInPanel");
    if (!sb || !root) return;

    const LAKH = 100000;
    const FACINGS = ["North", "South", "East", "West", "North-East", "North-West", "South-East", "South-West"];
    const FURNISHING = ["Fully Furnished", "Semi-Furnished", "Unfurnished"];
    const BHKS = [1, 2, 3, 4, 5];

    let user = null;
    const loaded = {};

    function escapeHtml(str) {
        return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function msg(text, type) {
        const el = document.getElementById("acctDashMessage");
        if (!text) { el.hidden = true; return; }
        el.textContent = text;
        el.className = "acct-message acct-message-" + (type || "success");
        el.hidden = false;
        if (type !== "error") setTimeout(() => { el.hidden = true; }, 3500);
    }

    function unavailable(err) {
        console.error(err);
        return '<p class="acct-hint">This section isn\'t available right now. Please try again shortly.</p>';
    }

    function fmtDate(iso) {
        return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
    }

    // ---------------------------------------------------------
    // Chip (multi-select checkbox) helpers
    // ---------------------------------------------------------
    function renderChips(containerId, options, name) {
        document.getElementById(containerId).innerHTML = options.map(([value, label]) => `
            <label class="acct-chip"><input type="checkbox" name="${name}" value="${escapeHtml(value)}"><span>${escapeHtml(label)}</span></label>`).join("");
    }
    function setChips(name, values) {
        const set = new Set((values || []).map(String));
        root.querySelectorAll(`input[name="${name}"]`).forEach((i) => { i.checked = set.has(i.value); });
    }
    function getChips(name) {
        return Array.from(root.querySelectorAll(`input[name="${name}"]:checked`)).map((i) => i.value);
    }

    function propertyTypeOptions() {
        const tax = window.AventrixPropertyTaxonomy || { TYPE_LABELS: {}, TYPE_SUBTYPES: {} };
        const opts = [];
        Object.keys(tax.TYPE_LABELS).forEach((key) => {
            opts.push([key, "Any " + tax.TYPE_LABELS[key]]);
            if (key === "residential" || key === "commercial") {
                (tax.TYPE_SUBTYPES[key] || []).forEach((s) => opts.push([s.value, s.label]));
            }
        });
        return opts;
    }

    // ---------------------------------------------------------
    // Tabs
    // ---------------------------------------------------------
    function showTab(name) {
        root.querySelectorAll("#acctDashTabs button").forEach((b) => b.classList.toggle("active", b.dataset.dtab === name));
        root.querySelectorAll(".acct-dash-panel").forEach((p) => { p.hidden = p.dataset.dpanel !== name; });
        msg("");
        if (name === "matches") loadMatches();
        if (name === "requirement" && !loaded.requirement) loadRequirement();
        if (name === "searches") loadSavedSearches();
        if (name === "enquiries") loadEnquiries();
        if (name === "profile" && !loaded.profile) loadProfile();
        try { history.replaceState(null, "", "#" + name); } catch (e) { /* ignore */ }
    }

    // ---------------------------------------------------------
    // Requirement
    // ---------------------------------------------------------
    async function fetchRequirement() {
        const { data, error } = await sb.from("buyer_requirements").select("*").eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        return data;
    }

    async function loadRequirement() {
        try {
            const r = await fetchRequirement();
            loaded.requirement = true;
            if (!r) return;
            document.getElementById("reqTransaction").value = r.transaction_type || "";
            document.getElementById("reqPurpose").value = r.purpose || "";
            document.getElementById("reqLocations").value = (r.preferred_locations || []).join(", ");
            document.getElementById("reqBudgetMin").value = r.budget_min != null ? +(r.budget_min / LAKH).toFixed(2) : "";
            document.getElementById("reqBudgetMax").value = r.budget_max != null ? +(r.budget_max / LAKH).toFixed(2) : "";
            document.getElementById("reqMinArea").value = r.min_area_sqft != null ? r.min_area_sqft : "";
            document.getElementById("reqParking").checked = !!r.parking_required;
            document.getElementById("reqNotes").value = r.notes || "";
            setChips("reqType", r.property_types);
            setChips("reqBhk", r.bhk);
            setChips("reqFacing", r.facing);
            setChips("reqFurnishing", r.furnishing);
        } catch (err) {
            msg("Couldn't load your requirement. Please try again shortly.", "error");
            console.error(err);
        }
    }

    async function saveRequirement(e) {
        e.preventDefault();
        const num = (id) => { const v = document.getElementById(id).value; return v === "" ? null : Number(v); };
        const min = num("reqBudgetMin"), max = num("reqBudgetMax");
        if (min != null && max != null && min > max) { msg("Budget “from” is higher than “up to”.", "error"); return; }

        const record = {
            user_id: user.id,
            transaction_type: document.getElementById("reqTransaction").value || null,
            purpose: document.getElementById("reqPurpose").value || null,
            property_types: getChips("reqType"),
            preferred_locations: document.getElementById("reqLocations").value.split(",").map((s) => s.trim()).filter(Boolean),
            budget_min: min != null ? Math.round(min * LAKH) : null,
            budget_max: max != null ? Math.round(max * LAKH) : null,
            bhk: getChips("reqBhk").map(Number),
            min_area_sqft: num("reqMinArea"),
            parking_required: document.getElementById("reqParking").checked,
            facing: getChips("reqFacing"),
            furnishing: getChips("reqFurnishing"),
            notes: document.getElementById("reqNotes").value.trim() || null
        };
        const btn = e.target.querySelector("button[type=submit]");
        btn.disabled = true;
        const { error } = await sb.from("buyer_requirements").upsert(record, { onConflict: "user_id" });
        btn.disabled = false;
        if (error) { msg("Couldn't save your requirement. Please try again.", "error"); console.error(error); return; }
        loaded.matches = false;
        msg("Requirement saved. Your matches have been updated.");
        showTab("matches");
    }

    // ---------------------------------------------------------
    // Matches
    // ---------------------------------------------------------
    const STATUS_ICON = { match: "✓", partial: "~", miss: "✗", unknown: "?" };

    async function loadMatches() {
        const el = document.getElementById("acctMatches");
        if (loaded.matches) return;
        el.innerHTML = '<p class="acct-hint">Finding matches…</p>';
        try {
            const req = await fetchRequirement();
            if (!req) {
                el.innerHTML = `<div class="acct-empty"><p>Tell us what you're looking for and we'll score every listing against it.</p>
                    <button type="button" class="acct-submit-btn acct-inline-btn" data-goto="requirement">Set My Requirement</button></div>`;
                return;
            }
            const { data, error } = await sb.from("properties")
                .select("slug, title, location, price_display, price_value, listing_type, category, sub_type, bedrooms, parking, built_up_area, facing, furnishing, featured_image, images, property_code, status")
                .eq("publish_status", "Published")
                .limit(1000);
            if (error) throw error;
            const available = (data || []).filter((p) => p.status !== "Sold" && p.status !== "Rented");
            const ranked = window.AventrixMatching.rank(req, available, { minScore: 50 }).slice(0, 12);
            loaded.matches = true;

            if (!ranked.length) {
                el.innerHTML = `<div class="acct-empty"><p>No current listings score 50% or more against your requirement. Try widening your budget or locations — or ask us, we often know of options before they're listed.</p>
                    <a class="acct-submit-btn acct-inline-btn" href="enquiry.html">Ask Aventrix Realty</a></div>`;
                return;
            }
            el.innerHTML = `<div class="acct-match-grid">${ranked.map((r) => {
                const p = r.property;
                const img = p.featured_image || (p.images && p.images[0]) || "images/property1.jpg";
                return `
                <a class="acct-match-card" href="property.html?id=${encodeURIComponent(p.slug)}">
                    <div class="acct-match-img"><img src="${escapeHtml(img)}" alt="${escapeHtml(p.title)}" loading="lazy"><span class="acct-match-score">${r.score}% match</span></div>
                    <div class="acct-match-body">
                        ${p.property_code ? `<span class="acct-match-code">${escapeHtml(p.property_code)}</span>` : ""}
                        <h3>${escapeHtml(p.title)}</h3>
                        <p class="acct-match-meta">${escapeHtml(p.location || "")} · ${escapeHtml(p.price_display || "Price on request")}</p>
                        <ul class="acct-factors">${r.factors.map((f) => `
                            <li class="f-${f.status}" title="${escapeHtml(f.detail || "")}"><span aria-hidden="true">${STATUS_ICON[f.status]}</span> ${escapeHtml(f.label)}</li>`).join("")}
                        </ul>
                    </div>
                </a>`;
            }).join("")}</div>
            <p class="acct-hint acct-match-note">Scores compare listing details with your requirement only. They are not a valuation or a recommendation — always verify details with our team.</p>`;
        } catch (err) {
            el.innerHTML = unavailable(err);
        }
    }

    // ---------------------------------------------------------
    // Saved searches
    // ---------------------------------------------------------
    async function loadSavedSearches() {
        const el = document.getElementById("acctSavedSearches");
        el.innerHTML = '<p class="acct-hint">Loading…</p>';
        const { data, error } = await sb.from("saved_searches").select("*").order("created_at", { ascending: false });
        if (error) { el.innerHTML = unavailable(error); return; }
        if (!data.length) {
            el.innerHTML = '<div class="acct-empty"><p>No saved searches yet.</p><a class="acct-submit-btn acct-inline-btn" href="properties.html">Search Properties</a></div>';
            return;
        }
        el.innerHTML = `<ul class="acct-list">${data.map((s) => `
            <li data-id="${escapeHtml(s.id)}">
                <div>
                    <strong>${escapeHtml(s.name)}</strong>
                    <span class="acct-hint">Saved ${escapeHtml(fmtDate(s.created_at))}</span>
                    <label class="acct-check acct-small"><input type="checkbox" data-alert-toggle ${s.alerts_enabled ? "checked" : ""}> Notify me about new matches</label>
                </div>
                <div class="acct-list-actions">
                    <a href="properties.html${s.query_string ? "?" + escapeHtml(s.query_string) : ""}">Run search</a>
                    <button type="button" data-delete-search>Delete</button>
                </div>
            </li>`).join("")}</ul>`;
    }

    async function onSavedSearchClick(e) {
        const li = e.target.closest("li[data-id]");
        if (!li) return;
        const id = li.getAttribute("data-id");
        if (e.target.matches("[data-delete-search]")) {
            if (!confirm("Delete this saved search?")) return;
            const { error } = await sb.from("saved_searches").delete().eq("id", id);
            if (error) { msg("Couldn't delete. Please try again.", "error"); return; }
            loadSavedSearches();
        }
    }

    async function onSavedSearchChange(e) {
        if (!e.target.matches("[data-alert-toggle]")) return;
        const id = e.target.closest("li[data-id]").getAttribute("data-id");
        const { error } = await sb.from("saved_searches").update({ alerts_enabled: e.target.checked }).eq("id", id);
        if (error) { msg("Couldn't update. Please try again.", "error"); e.target.checked = !e.target.checked; }
    }

    // ---------------------------------------------------------
    // Enquiries
    // ---------------------------------------------------------
    async function loadEnquiries() {
        const el = document.getElementById("acctEnquiries");
        el.innerHTML = '<p class="acct-hint">Loading…</p>';
        const { data, error } = await sb.from("enquiries")
            .select("id, created_at, form_type, property_code, property_slug")
            .eq("submitted_by", user.id)
            .order("created_at", { ascending: false });
        if (error) { el.innerHTML = unavailable(error); return; }
        if (!data.length) {
            el.innerHTML = '<div class="acct-empty"><p>You haven\'t sent any enquiries while logged in.</p><a class="acct-submit-btn acct-inline-btn" href="enquiry.html">Send an Enquiry</a></div>';
            return;
        }
        el.innerHTML = `<ul class="acct-list">${data.map((q) => `
            <li>
                <div>
                    <strong>${escapeHtml(q.form_type || "Enquiry")}</strong>
                    <span class="acct-hint">Sent ${escapeHtml(fmtDate(q.created_at))}${q.property_code ? " · " + escapeHtml(q.property_code) : ""}</span>
                </div>
                ${q.property_slug ? `<div class="acct-list-actions"><a href="property.html?id=${encodeURIComponent(q.property_slug)}">View property</a></div>` : ""}
            </li>`).join("")}</ul>
            <p class="acct-hint">Our team responds by phone, WhatsApp or email.</p>`;
    }

    // ---------------------------------------------------------
    // Profile
    // ---------------------------------------------------------
    async function loadProfile() {
        const { data, error } = await sb.from("customer_profiles").select("*").eq("user_id", user.id).maybeSingle();
        if (error) { msg("Profile isn't available right now.", "error"); console.error(error); return; }
        loaded.profile = true;
        document.getElementById("profName").value = (data && data.full_name) || (user.user_metadata && user.user_metadata.full_name) || "";
        document.getElementById("profPhone").value = (data && data.phone) || "";
        document.getElementById("profContact").value = (data && data.preferred_contact) || "";
    }

    async function saveProfile(e) {
        e.preventDefault();
        const phone = document.getElementById("profPhone").value.trim();
        if (phone && !/^[+\d][\d\s-]{7,16}$/.test(phone)) { msg("Please enter a valid mobile number.", "error"); return; }
        const btn = e.target.querySelector("button[type=submit]");
        btn.disabled = true;
        const { error } = await sb.from("customer_profiles").upsert({
            user_id: user.id,
            full_name: document.getElementById("profName").value.trim() || null,
            phone: phone || null,
            preferred_contact: document.getElementById("profContact").value || null
        }, { onConflict: "user_id" });
        btn.disabled = false;
        if (error) { msg("Couldn't save your profile. Please try again.", "error"); console.error(error); return; }
        const n = document.getElementById("profName").value.trim();
        document.getElementById("acctDashName").textContent = n ? ", " + n.split(" ")[0] : "";
        msg("Profile saved.");
    }

    // ---------------------------------------------------------
    // Init
    // ---------------------------------------------------------
    function updateCounts() {
        const S = window.AventrixStorage;
        if (!S) return;
        document.getElementById("acctDashWishCount").textContent = S.wishlist.count() ? "(" + S.wishlist.count() + ")" : "";
        document.getElementById("acctDashShortCount").textContent = S.shortlist.count() ? "(" + S.shortlist.count() + ")" : "";
    }

    async function init() {
        const { data } = await sb.auth.getSession();
        user = data && data.session && data.session.user;
        if (!user) return;
        if (window.AventrixAccountRecovery && window.AventrixAccountRecovery()) return;

        document.querySelector(".acct-card").classList.add("acct-card--dashboard");
        const title = document.getElementById("acctPageTitle");
        if (title) title.textContent = "My Account";
        const first = user.user_metadata && user.user_metadata.full_name ? String(user.user_metadata.full_name).split(" ")[0] : "";
        document.getElementById("acctDashName").textContent = first ? ", " + first : "";

        renderChips("reqTypes", propertyTypeOptions(), "reqType");
        renderChips("reqBhk", BHKS.map((b) => [String(b), b + (b === 5 ? "+ BHK" : " BHK")]), "reqBhk");
        renderChips("reqFacing", FACINGS.map((f) => [f, f]), "reqFacing");
        renderChips("reqFurnishing", FURNISHING.map((f) => [f, f]), "reqFurnishing");

        root.querySelector("#acctDashTabs").addEventListener("click", (e) => {
            const b = e.target.closest("button[data-dtab]");
            if (b) showTab(b.dataset.dtab);
        });
        root.addEventListener("click", (e) => {
            const g = e.target.closest("[data-goto]");
            if (g) showTab(g.dataset.goto);
        });
        document.getElementById("acctRequirementForm").addEventListener("submit", saveRequirement);
        document.getElementById("acctProfileForm").addEventListener("submit", saveProfile);
        const ss = document.getElementById("acctSavedSearches");
        ss.addEventListener("click", onSavedSearchClick);
        ss.addEventListener("change", onSavedSearchChange);

        if (window.AventrixStorage) {
            window.AventrixStorage.ready.then(updateCounts);
            window.addEventListener("aventrix:wishlist-changed", updateCounts);
            window.addEventListener("aventrix:shortlist-changed", updateCounts);
        }

        const start = (window.location.hash || "").replace("#", "");
        showTab(["matches", "requirement", "searches", "enquiries", "profile"].includes(start) ? start : "matches");
    }

    init();
})();
