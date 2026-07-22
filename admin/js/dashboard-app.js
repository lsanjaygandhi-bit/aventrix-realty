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

    // ---- Sidebar navigation (section switching, no reload) ----
    const navLinks = document.querySelectorAll("#adminNav a[data-section]");
    const sections = document.querySelectorAll(".admin-section");
    const sectionTitle = document.getElementById("sectionTitle");

    const titles = {
        overview: "Overview",
        properties: "Properties",
        enquiries: "Enquiries",
        settings: "Site Settings"
    };

    function showSection(key) {
        sections.forEach((s) => (s.style.display = s.id === "section-" + key ? "" : "none"));
        navLinks.forEach((a) => a.classList.toggle("active", a.dataset.section === key));
        sectionTitle.textContent = titles[key] || key;
        closeSidebarMobile();

        if (key === "properties" && window.PropertiesModule) window.PropertiesModule.load();
        if (key === "enquiries" && window.EnquiriesModule) window.EnquiriesModule.load();
        if (key === "settings" && window.SettingsModule) window.SettingsModule.load();
        if (key === "overview") loadOverviewStats();
    }

    navLinks.forEach((a) => a.addEventListener("click", () => showSection(a.dataset.section)));

    async function loadOverviewStats() {
        try {
            const [total, published, draft, newEnquiries] = await Promise.all([
                CrudEngine.count("properties"),
                CrudEngine.count("properties", { publish_status: "Published" }),
                CrudEngine.count("properties", { publish_status: "Draft" }),
                CrudEngine.count("enquiries", { status: "new" })
            ]);
            document.getElementById("statTotal").textContent = total;
            document.getElementById("statPublished").textContent = published;
            document.getElementById("statDraft").textContent = draft;
            document.getElementById("statEnquiries").textContent = newEnquiries;

            const badge = document.getElementById("enquiryBadge");
            if (newEnquiries > 0) {
                badge.style.display = "inline-block";
                badge.textContent = newEnquiries;
            }
        } catch (err) {
            console.error(err);
        }
    }

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
