/*
 * AVENTRIX REALTY — SITE-WIDE VISITOR INTELLIGENCE
 * Draft implementation for review. Requires the additive SQL proposal
 * sql/proposal-2026-10-19-real-estate-intelligence.sql to be applied first.
 *
 * Tracks pathname only (never query strings/referrers), random pseudonymous
 * browser + tab identifiers, page views, and a lightweight live heartbeat.
 * No IP address, precise location, user-agent, name, phone, or email is sent.
 */
(function () {
  "use strict";
  const sb = window.supabaseClient;
  if (!sb || window.__aventrixIntelligenceStarted || String(window.location.pathname || "").startsWith("/admin/")) return;
  window.__aventrixIntelligenceStarted = true;

  const VISITOR_KEY = "aventrix:visitorKey";
  const SESSION_KEY = "aventrix:analyticsSession";
  const HEARTBEAT_MS = 30000;
  const MAX_PATH = 300;

  function makeId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    } catch (_) {}
    return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  function getStored(storageName, key) {
    try {
      const storage = window[storageName];
      let value = storage.getItem(key);
      if (!value) { value = makeId(); storage.setItem(key, value); }
      return value;
    } catch (_) {
      const fallback = "__aventrix_" + key.replace(/[^a-z]/gi, "");
      if (!window[fallback]) window[fallback] = makeId();
      return window[fallback];
    }
  }

  const visitorKey = getStored("localStorage", VISITOR_KEY);
  const sessionKey = getStored("sessionStorage", SESSION_KEY);
  let lastPath = "";
  let lastHeartbeat = 0;
  let pending = Promise.resolve();

  function safePath() {
    // Exclude query/hash values: forms and search terms can contain private data.
    let path = String(window.location.pathname || "/").slice(0, MAX_PATH);
    if (!path.startsWith("/") || path.startsWith("//")) path = "/";
    return path || "/";
  }

  function propertySlug() {
    const params = new URLSearchParams(window.location.search);
    let raw = null;
    if (/\/property\.html$/i.test(window.location.pathname)) raw = params.get("id");
    else if (/\/enquiry\.html$/i.test(window.location.pathname)) raw = params.get("property");
    return raw && /^[a-zA-Z0-9-]{1,180}$/.test(raw) ? raw : null;
  }

  function send(eventType, force) {
    if (!sb || document.visibilityState === "prerender") return pending;
    const path = safePath();
    const now = Date.now();
    if (eventType === "heartbeat" && now - lastHeartbeat < HEARTBEAT_MS - 1000) return pending;
    if (eventType === "page_view" && !force && path === lastPath) return pending;
    if (eventType === "page_view") lastPath = path;
    if (eventType === "heartbeat") lastHeartbeat = now;

    // Keep calls serialized so heartbeat/page changes don't race session upserts.
    pending = pending.then(async () => {
      try {
        const { error } = await sb.rpc("track_site_activity", {
          p_visitor_key: visitorKey,
          p_session_key: sessionKey,
          p_event_type: eventType,
          p_page_path: path,
          p_property_slug: propertySlug()
        });
        if (error) console.debug("Aventrix site analytics unavailable:", error.message);
      } catch (_) {
        // Analytics must never interrupt browsing or form submission.
      }
    });
    return pending;
  }

  send("page_view", true);
  let heartbeatTimer = null;
  function startHeartbeat() {
    if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
    heartbeatTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") send("heartbeat", false);
    }, HEARTBEAT_MS);
  }
  function stopHeartbeat() {
    if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  startHeartbeat();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") send("heartbeat", true);
  });
  window.addEventListener("pagehide", () => {
    // Best-effort final heartbeat; stop timers while the page is in the back-forward cache.
    send("heartbeat", true);
    stopHeartbeat();
  });

  window.addEventListener("aventrix:enquiry-submitted", () => send("enquiry_submit", true));

  // Explicit login/logout history: call only after successful authentication.
  window.AventrixIntelligence = {
    visitorKey,
    sessionKey,
    trackPageView: () => send("page_view", true),
    recordAuthEvent: async function (eventType) {
      if (!["login", "logout"].includes(eventType)) return;
      try {
        const { error } = await sb.rpc("record_login_activity", { p_event_type: eventType });
        if (error) console.debug("Aventrix login history unavailable:", error.message);
      } catch (_) {}
    }
  };

  // Browsers may restore this page from the back-forward cache. Restart the
  // timer so restored tabs continue to count as live after the initial heartbeat.
  window.addEventListener("pageshow", () => {
    startHeartbeat();
    send("heartbeat", true);
  });
})();
