/* Aventrix Realty — Pallikaranai Marsh News & Updates
 * Progressive enhancement only: every entry is already in the HTML
 * (rendered by tools/build-pallikaranai.py from
 * data/pallikaranai-updates.json), so the page works without this file.
 * This adds: "Today" / "Yesterday" labels next to exact dates
 * (calculated in India time), plus category and month filters.
 */
(function () {
  "use strict";

  // ---- Relative date labels (exact date always stays visible) ----
  function istDateKey(d) {
    // YYYY-MM-DD in Asia/Kolkata, independent of the visitor's own zone.
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  }
  var todayKey = istDateKey(new Date());
  var yesterdayKey = istDateKey(new Date(Date.now() - 86400000));
  document.querySelectorAll("time[data-pm-rel]").forEach(function (el) {
    var key = el.getAttribute("datetime");
    var label = key === todayKey ? "Today" : key === yesterdayKey ? "Yesterday" : "";
    if (!label) return;
    var tag = document.createElement("span");
    tag.className = "pm-rel";
    tag.textContent = label;
    el.parentNode.insertBefore(tag, el);
  });

  // ---- Filters ----
  var feed = document.getElementById("pmFeed");
  if (!feed) return;
  var entries = Array.prototype.slice.call(feed.querySelectorAll(".pm-entry"));
  var chips = Array.prototype.slice.call(document.querySelectorAll(".pm-chip[data-cat]"));
  var month = document.getElementById("pmMonth");
  var count = document.getElementById("pmCount");
  var empty = document.getElementById("pmEmpty");
  var state = { cat: "all", month: "all" };

  // Deep links: ?category=court&month=2026-10
  var params = new URLSearchParams(window.location.search);
  if (params.get("category")) state.cat = params.get("category");
  if (params.get("month")) state.month = params.get("month");

  function apply(pushUrl) {
    var shown = 0;
    entries.forEach(function (el) {
      var ok = (state.cat === "all" || el.dataset.category === state.cat) &&
               (state.month === "all" || el.dataset.month === state.month);
      el.hidden = !ok;
      if (ok) shown++;
    });
    chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c.dataset.cat === state.cat)); });
    if (month) month.value = state.month;
    if (count) count.textContent = shown === entries.length ? "Showing all " + shown + " updates" : "Showing " + shown + " of " + entries.length + " updates";
    if (empty) empty.hidden = shown !== 0;
    if (pushUrl && window.history && history.replaceState) {
      var q = new URLSearchParams();
      if (state.cat !== "all") q.set("category", state.cat);
      if (state.month !== "all") q.set("month", state.month);
      var url = window.location.pathname + (q.toString() ? "?" + q.toString() : "") + "#updates";
      history.replaceState(null, "", url);
    }
  }

  chips.forEach(function (c) {
    c.addEventListener("click", function () { state.cat = c.dataset.cat; apply(true); });
  });
  if (month) month.addEventListener("change", function () { state.month = month.value; apply(true); });

  var filters = document.getElementById("pmFilters");
  if (filters) filters.hidden = false;
  apply(false);
})();
