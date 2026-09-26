/*
 * AVENTRIX REALTY — DASHBOARD APP SHELL
 * -------------------------------------------
 * Session guard, section routing (no page reloads), sidebar toggle
 * for mobile, and a shared toast notification helper used by every
 * module file.
 */

function showToast(message, isError) {
    const el = document.getElementById("adminToast");
    el.textContent = message;
    el.className = "toast show" + (isError ? " error" : "");
    setTimeout(() => el.classList.remove("show"), 3200);
}

(async function initDashboard() {
    CrudEngine.init(window.supabaseClient);

    const session = await AdminAuth.requireSession();
    if (!session) return;
    document.body.classList.add("role-" + session.appRole);

    // ---- Sidebar navigation (section switching, no reload) ----
    const navLinks = document.querySelectorAll("#adminNav a[data-section]");
    const sections = document.querySelectorAll(".admin-section");
    const sectionTitle = document.getElementById("sectionTitle");

    const titles = {
        overview: "Overview",
        content: "Website Content",
        legacy: "Our Legacy",
        properties: "Properties",
        testimonials: "Testimonials",
        realtors: "Our Realtors / Leadership",
        insights: "Insights",
        offices: "Office Locations",
        media: "Media Library",
        enquiries: "Leads & Enquiries",
        settings: "Site Settings"
    };

    function showSection(key, opts) {
        opts = opts || {};
        // Realtors only get Overview, Properties and Leads.
        if (session.appRole !== "admin" && !["overview", "properties", "enquiries"].includes(key)) key = "overview";
        sections.forEach((s) => (s.style.display = s.id === "section-" + key ? "" : "none"));
        navLinks.forEach((a) => a.classList.toggle("active", a.dataset.section === key));
        sectionTitle.textContent = titles[key] || key;
        closeSidebarMobile();

        if (key === "content" && window.PageContentModule) window.PageContentModule.load();
        if (key === "legacy" && window.LegacyContentModule) window.LegacyContentModule.load();
        if (key === "properties" && window.PropertiesModule) window.PropertiesModule.load();
        if (key === "testimonials" && window.TestimonialsModule) window.TestimonialsModule.load();
        if (key === "realtors" && window.RealtorsModule) window.RealtorsModule.load();
        if (key === "insights" && window.InsightsModule) window.InsightsModule.load();
        if (key === "offices" && window.OfficesModule) window.OfficesModule.load();
        if (key === "media" && window.MediaLibraryModule) window.MediaLibraryModule.load();
        if (key === "enquiries" && window.EnquiriesModule && !opts.skipLoad) window.EnquiriesModule.load();
        if (key === "settings" && window.SettingsModule) window.SettingsModule.load();
        if (key === "overview") loadOverviewStats();
    }

    navLinks.forEach((a) => a.addEventListener("click", () => showSection(a.dataset.section)));

    window.AventrixShowSection = showSection;

    // ---- Overview: every figure is read live from the database ----
    function escapeHtml(str) {
        return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function setNum(id, v) {
        const el = document.getElementById(id);
        if (el) el.textContent = (v === undefined || v === null) ? "–" : v;
    }

    let perfRows = [];
    let perfMetric = "views";

    function renderPerformance() {
        const el = document.getElementById("overviewPerformance");
        if (!el) return;
        const top = perfRows
            .filter((r) => Number(r[perfMetric]) > 0)
            .sort((a, b) => Number(b[perfMetric]) - Number(a[perfMetric]))
            .slice(0, 8);
        el.innerHTML = top.length
            ? `<ul class="ov-perf-list">${top.map((r) => `<li><span><span class="code-pill">${escapeHtml(r.property_code || "")}</span> ${escapeHtml(r.title)}</span><strong>${Number(r[perfMetric])}</strong></li>`).join("")}</ul>`
            : '<p class="helper-text">No activity recorded for this yet.</p>';
    }

    async function loadOverviewStats() {
        const sb = window.supabaseClient;
        // "Drafts" card kept from the original dashboard, counted the same
        // way it always was (independent of the P1 metrics function).
        CrudEngine.count("properties", { publish_status: "Draft" })
            .then((n) => setNum("statDraft", n))
            .catch((err) => console.error(err));
        try {
            const { data: m, error } = await sb.rpc("admin_dashboard_metrics");
            if (error) throw error;
            if (m) {
                setNum("statActive", m.properties_active);
                setNum("statPublished", m.properties_published);
                setNum("statTotal", m.properties_total);
                setNum("statEnquiries", m.enquiries_unread);
                setNum("statLeadsNew", m.leads_new);
                setNum("statLeadsOpen", m.leads_open);
                setNum("statSiteVisits", m.leads_site_visit);
                setNum("statNegotiation", m.leads_negotiation);
                setNum("statBooked", m.leads_booked);
                setNum("statClosed", m.leads_closed);

                const sources = ["Website", "WhatsApp", "Instagram", "Facebook", "Referral", "Other"];
                const counts = m.lead_sources || {};
                const max = Math.max(1, ...sources.map((s) => counts[s] || 0));
                const total = sources.reduce((t, s) => t + (counts[s] || 0), 0);
                document.getElementById("overviewLeadSources").innerHTML = total
                    ? sources.map((s) => `
                        <div class="ov-bar-row"><span>${s}</span>
                            <div class="ov-bar-track"><div class="ov-bar-fill" style="width:${Math.round(((counts[s] || 0) / max) * 100)}%"></div></div>
                            <span class="n">${counts[s] || 0}</span></div>`).join("")
                    : '<p class="helper-text">No leads yet.</p>';
            }
        } catch (err) {
            console.error(err);
            document.getElementById("overviewLeadSources").innerHTML =
                '<p class="helper-text">Dashboard metrics unavailable — run sql/migration-2026-09-25-02-p1-crm-buyer-analytics.sql.</p>';
        }

        if (window.EnquiriesModule) window.EnquiriesModule.renderFollowUps("overviewFollowUps");

        if (session.appRole === "admin") {
            const { data, error } = await sb.from("property_performance").select("*");
            if (error) {
                document.getElementById("overviewPerformance").innerHTML = '<p class="helper-text">Performance data unavailable.</p>';
            } else {
                perfRows = data || [];
                renderPerformance();
            }
        }
    }

    const perfTabs = document.getElementById("overviewPerfTabs");
    if (perfTabs) {
        perfTabs.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-metric]");
            if (!btn) return;
            perfMetric = btn.dataset.metric;
            perfTabs.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
            renderPerformance();
        });
    }

    window.AventrixOverview = { refresh: loadOverviewStats };

    loadOverviewStats();

    // ---- Mobile sidebar toggle ----
    const sidebar = document.getElementById("adminSidebar");
    const backdrop = document.getElementById("sidebarBackdrop");

    document.getElementById("menuToggleBtn").addEventListener("click", () => {
        sidebar.classList.add("open");
        backdrop.classList.add("show");
    });

    function closeSidebarMobile() {
        sidebar.classList.remove("open");
        backdrop.classList.remove("show");
    }
    backdrop.addEventListener("click", closeSidebarMobile);

    // ---- Logout ----
    document.getElementById("logoutBtn").addEventListener("click", () => AdminAuth.logout());
})();
