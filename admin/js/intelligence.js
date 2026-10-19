/*
 * AVENTRIX REALTY — WEBSITE INTELLIGENCE ADMIN MODULE
 * Admin-only. Every underlying table/RPC is protected by Supabase RLS
 * and server-side role checks; hiding the nav is not the security boundary.
 */
(function () {
  "use strict";
  const rootId = "section-intelligence";
  let loaded = false;
  let timer = null;
  let users = [];
  let sessions = [];
  let events = [];
  let logins = [];
  let activeTab = "visitors";

  function el(id) { return document.getElementById(id); }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function dateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }
  function userLabel(id) {
    const u = users.find(x => x.user_id === id);
    return u ? (u.email || u.full_name || id) : (id ? "Account " + id.slice(0, 8) : "Anonymous visitor");
  }
  function liveSessions() {
    const cutoff = Date.now() - 120000;
    return sessions.filter(s => new Date(s.last_seen_at).getTime() >= cutoff);
  }
  function showError(message) {
    const status = el("intelStatus");
    if (status) status.textContent = message;
    const tables = el("intelTableArea");
    if (tables) tables.innerHTML = '<p class="helper-text">Unable to load intelligence data. Check the proposed SQL migration and admin permissions.</p>';
  }
  function renderStats() {
    const live = liveSessions();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayViews = events.filter(e => e.event_type === "page_view" && new Date(e.created_at) >= today).length;
    const set = (id, value) => { if (el(id)) el(id).textContent = String(value); };
    set("intelLiveCount", window.__aventrixIntelCounts ? window.__aventrixIntelCounts.live : live.length);
    set("intelPageViews", window.__aventrixIntelCounts ? window.__aventrixIntelCounts.viewsToday : todayViews);
    set("intelRegisteredCount", users.length);
    set("intelLoginCount", logins.filter(x => x.event_type === "login").length);
    set("intelUpdatedAt", "Updated " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }
  function renderTable() {
    const area = el("intelTableArea");
    if (!area) return;
    if (activeTab === "visitors") {
      const rows = liveSessions().sort((a,b) => new Date(b.last_seen_at) - new Date(a.last_seen_at));
      area.innerHTML = rows.length ? '<div class="table-wrap"><table class="admin-table"><thead><tr><th>Visitor</th><th>Current page</th><th>Last activity</th><th>Type</th></tr></thead><tbody>' +
        rows.map(s => '<tr><td>' + escapeHtml(userLabel(s.user_id)) + '</td><td><code>' + escapeHtml(s.current_path) + '</code></td><td>' + escapeHtml(dateTime(s.last_seen_at)) + '</td><td>' + (s.user_id ? 'Signed in' : 'Anonymous') + '</td></tr>').join("") +
        '</tbody></table></div><p class="helper-text">Live means a heartbeat was received in the last 2 minutes. A browser may remain listed until the session expires.</p>'
        : '<p class="helper-text">No active visitors in the last 2 minutes. The tracking migration must be applied and deployed before new sessions appear.</p>';
    } else if (activeTab === "users") {
      area.innerHTML = users.length ? '<div class="table-wrap"><table class="admin-table"><thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Registered</th><th>Last login</th></tr></thead><tbody>' +
        users.map(u => '<tr><td>' + escapeHtml(u.email) + '</td><td>' + escapeHtml(u.full_name || "—") + '</td><td>' + escapeHtml(u.app_role || "customer") + '</td><td>' + escapeHtml(dateTime(u.registered_at)) + '</td><td>' + escapeHtml(dateTime(u.last_sign_in_at)) + '</td></tr>').join("") +
        '</tbody></table></div><p class="helper-text">Showing up to 500 latest accounts. Email is read from Supabase Auth through an admin-only database function.</p>'
        : '<p class="helper-text">No registered accounts returned.</p>';
    } else if (activeTab === "logins") {
      area.innerHTML = logins.length ? '<div class="table-wrap"><table class="admin-table"><thead><tr><th>Account</th><th>Event</th><th>Time</th></tr></thead><tbody>' +
        logins.slice(0,100).map(x => '<tr><td>' + escapeHtml(userLabel(x.user_id)) + '</td><td>' + escapeHtml(x.event_type) + '</td><td>' + escapeHtml(dateTime(x.created_at)) + '</td></tr>').join("") +
        '</tbody></table></div><p class="helper-text">History begins after this feature is deployed. Existing Supabase Auth logs are not backfilled.</p>'
        : '<p class="helper-text">No login activity recorded yet.</p>';
    } else {
      area.innerHTML = events.length ? '<div class="table-wrap"><table class="admin-table"><thead><tr><th>Page</th><th>Visitor</th><th>Property</th><th>Viewed at</th></tr></thead><tbody>' +
        events.filter(x => x.event_type === "page_view").slice(0,100).map(x => '<tr><td><code>' + escapeHtml(x.page_path) + '</code></td><td>' + escapeHtml(userLabel(x.user_id)) + '</td><td>' + escapeHtml(x.property_slug || "—") + '</td><td>' + escapeHtml(dateTime(x.created_at)) + '</td></tr>').join("") +
        '</tbody></table></div>'
        : '<p class="helper-text">No page-view events yet. New events are collected after the migration and script deployment.</p>';
    }
  }
  async function loadData() {
    const sb = window.supabaseClient;
    if (!sb) throw new Error("Supabase client is unavailable.");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [sessionResult, eventResult, userResult, loginResult, liveCountResult, viewsTodayResult] = await Promise.all([
      sb.from("site_visitor_sessions").select("session_key,visitor_key,user_id,current_path,started_at,last_seen_at").order("last_seen_at", { ascending: false }).limit(500),
      sb.from("site_analytics_events").select("id,session_key,user_id,event_type,page_path,property_slug,created_at").order("created_at", { ascending: false }).limit(500),
      sb.rpc("admin_intelligence_users", { p_limit: 500 }),
      sb.from("user_login_history").select("user_id,event_type,created_at").order("created_at", { ascending: false }).limit(500),
      sb.from("site_visitor_sessions").select("session_key", { count: "exact", head: true }).gte("last_seen_at", new Date(Date.now() - 120000).toISOString()),
      sb.from("site_analytics_events").select("id", { count: "exact", head: true }).eq("event_type", "page_view").gte("created_at", today.toISOString())
    ]);
    const error = sessionResult.error || eventResult.error || userResult.error || loginResult.error || liveCountResult.error || viewsTodayResult.error;
    if (error) throw error;
    sessions = sessionResult.data || [];
    events = eventResult.data || [];
    users = userResult.data || [];
    logins = loginResult.data || [];
    // Exact totals come from count queries; the tables remain capped for responsive UI.
    window.__aventrixIntelCounts = { live: liveCountResult.count || 0, viewsToday: viewsTodayResult.count || 0 };
    renderStats();
    renderTable();
    if (el("intelStatus")) el("intelStatus").textContent = "Live sessions expire after 2 minutes without a heartbeat.";
  }
  async function load() {
    if (window.AventrixAdminRole !== "admin") {
      showError("Website Intelligence is available to administrators only.");
      return;
    }
    try {
      await loadData();
      loaded = true;
    } catch (err) {
      console.error("Aventrix Intelligence:", err);
      showError("Data unavailable: " + (err.message || err));
    }
  }
  function start() {
    if (timer) clearInterval(timer);
    load();
    timer = setInterval(load, 15000);
  }
  document.addEventListener("click", e => {
    const tab = e.target.closest("[data-intel-tab]");
    if (!tab) return;
    activeTab = tab.getAttribute("data-intel-tab");
    document.querySelectorAll("[data-intel-tab]").forEach(b => b.classList.toggle("active", b === tab));
    renderTable();
  });
  window.AventrixIntelligenceModule = { load: start };
})();
