/* List With Us / Post Property pages only.
 *
 * 1. Keeps what the visitor has typed when they change language. The shared
 *    language selector reloads the page, so entries are held in sessionStorage
 *    for that single reload and restored on the next load.
 * 2. Shows the browser's built-in required / invalid-email messages in the
 *    selected language (English keeps the native browser messages).
 *
 * Uses the existing avxI18n dictionary; it adds no language switching of its own.
 * Field names, values and the form submission itself are never changed. */
(function () {
  "use strict";
  var FORMS = ["propertyForm", "postLoginForm"];
  var SKIP_TYPES = /^(file|password|submit|button|reset|image)$/i;
  var STORE = "avx-listing-draft:" + location.pathname.replace(/^\/(ta|hi|te|kn|ml)(?=\/)/, "").split("/").pop();

  function fields(form) {
    return Array.prototype.filter.call(form.elements, function (el) {
      return (el.name || el.id) && !SKIP_TYPES.test(el.type || "");
    });
  }

  function fieldKey(el) { return el.id || el.name; }

  function save() {
    var draft = {};
    FORMS.forEach(function (id) {
      var form = document.getElementById(id);
      if (!form) return;
      fields(form).forEach(function (el) {
        var k = id + "|" + fieldKey(el);
        if (el.type === "checkbox" || el.type === "radio") {
          if (el.type === "radio" && !el.checked) return;
          draft[k + (el.type === "radio" ? "" : "|" + el.value)] = el.type === "radio" ? el.value : el.checked;
        } else if (el.value !== "") {
          draft[k] = el.value;
        }
      });
    });
    try { sessionStorage.setItem(STORE, JSON.stringify(draft)); } catch (e) { /* storage unavailable */ }
  }

  function restore() {
    var raw;
    try { raw = sessionStorage.getItem(STORE); sessionStorage.removeItem(STORE); } catch (e) { return; }
    if (!raw) return;
    var draft;
    try { draft = JSON.parse(raw); } catch (e) { return; }
    var lat = null;
    FORMS.forEach(function (id) {
      var form = document.getElementById(id);
      if (!form) return;
      fields(form).forEach(function (el) {
        var k = id + "|" + fieldKey(el);
        if (el.type === "checkbox") { if (draft.hasOwnProperty(k + "|" + el.value)) el.checked = !!draft[k + "|" + el.value]; return; }
        if (el.type === "radio") { el.checked = draft[k] === el.value; return; }
        if (!draft.hasOwnProperty(k)) return;
        el.value = draft[k];
        if (el.id === "lwuLatitude") lat = el;
      });
    });
    // Let the map picker redraw its pin from the restored coordinates.
    if (lat) lat.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Runs before the selector's own handler, which reloads the page.
  document.addEventListener("change", function (event) {
    if (event.target && event.target.id === "avxLanguageSelect") save();
  }, true);

  function t(key, fallback) {
    var value = window.avxI18n ? window.avxI18n.t(key) : fallback;
    return value && value !== key ? value : fallback;
  }

  function localized(el) {
    if (!window.avxI18n || window.avxI18n.getLocale() === "en") return null;
    var v = el.validity;
    if (v.valueMissing) {
      return el.tagName === "SELECT"
        ? t("listing.validation.select", "Please select an item in the list.")
        : t("listing.validation.required", "Please fill out this field.");
    }
    if (v.typeMismatch && el.type === "email") return t("listing.validation.email", "Please enter a valid email address.");
    return null;
  }

  document.addEventListener("invalid", function (event) {
    var el = event.target;
    if (!el || !el.form || FORMS.indexOf(el.form.id) < 0) return;
    el.setCustomValidity("");
    var message = localized(el);
    if (message) el.setCustomValidity(message);
  }, true);

  function clearCustom(event) {
    var el = event.target;
    if (el && el.form && FORMS.indexOf(el.form.id) >= 0 && el.setCustomValidity) el.setCustomValidity("");
  }
  document.addEventListener("input", clearCustom, true);
  document.addEventListener("change", clearCustom, true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", restore);
  else restore();
})();
