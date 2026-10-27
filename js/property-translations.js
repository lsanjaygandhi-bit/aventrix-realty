/* Property content translations (public pages only).
 *
 * Wraps window.supabaseClient.from("properties") so rows returned to the existing
 * renderers carry translated title / descriptions / location / features when a
 * non-English language is selected. Translations are read from the separate
 * `property_translations` table (keyed by property id, language and field), so
 * the English source rows are never modified. Prices, areas, slugs, codes and
 * every other fact are untouched. Missing translations, a missing table or any
 * network error fall back to the original English text, field by field.
 *
 * Load after js/supabase-client.js and never on admin pages. */
(function () {
  "use strict";
  var sb = window.supabaseClient;
  if (!sb || sb.__avxPropertyTranslations) return;
  sb.__avxPropertyTranslations = true;

  var LANGS = ["ta", "hi", "te", "kn", "ml"];
  var TEXT_FIELDS = ["title", "short_description", "description", "location", "seo_title", "seo_description", "seo_keywords"];
  var CACHE_MS = 10 * 60 * 1000;
  var CHUNK = 100;
  var mem = {};          // lang -> { id: { field: value } } (ids with an entry were already looked up)
  var inflight = {};     // lang|ids -> promise
  var stats = { lang: "en", rows: 0, translated: 0, requests: 0, disabled: false };
  window.avxPropertyTranslations = stats;

  function pathLocale() {
    var m = location.pathname.match(/^\/(ta|hi|te|kn|ml)(?=\/|$)/);
    if (m) return m[1];
    var q = new URLSearchParams(location.search).get("lang");
    return LANGS.indexOf(q) >= 0 ? q : null;
  }

  // The language switcher is deferred; wait for it so local-preview storage is honoured.
  function localeReady() {
    var fromUrl = pathLocale();
    if (fromUrl) return Promise.resolve(fromUrl);
    function read() {
      var l = window.avxI18n && window.avxI18n.getLocale && window.avxI18n.getLocale();
      return LANGS.indexOf(l) >= 0 ? l : "en";
    }
    if (window.avxI18n || document.readyState !== "loading") return Promise.resolve(read());
    return new Promise(function (resolve) {
      document.addEventListener("DOMContentLoaded", function () { resolve(read()); }, { once: true });
    });
  }

  // Admin-only review mode: ?avx_preview_translations=1 also requests unapproved
  // (machine) rows. RLS returns them only to a signed-in admin, so for anyone else
  // this behaves exactly like the public view.
  var PREVIEW = new URLSearchParams(location.search).get("avx_preview_translations") === "1";
  var previewShown = 0;

  function showPreviewBanner() {
    if (!PREVIEW || !previewShown || document.getElementById("avx-pt-preview")) return;
    var b = document.createElement("div");
    b.id = "avx-pt-preview";
    b.setAttribute("role", "status");
    b.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#7a1f1f;color:#fff;padding:8px 12px;font:600 13px/1.3 sans-serif;text-align:center";
    b.textContent = "Admin preview: showing UNAPPROVED machine translations. Not visible to the public.";
    document.body.appendChild(b);
  }

  function storeKey(lang) { return (PREVIEW ? "avx_pt_v2_prev_" : "avx_pt_v2_") + lang; }
  function loadStored(lang) {
    if (mem[lang]) return mem[lang];
    mem[lang] = {};
    try {
      var s = JSON.parse(sessionStorage.getItem(storeKey(lang)) || "null");
      if (s && Date.now() - s.t < CACHE_MS) mem[lang] = s.d;
    } catch (e) { /* storage unavailable */ }
    return mem[lang];
  }
  function persist(lang) {
    try { sessionStorage.setItem(storeKey(lang), JSON.stringify({ t: Date.now(), d: mem[lang] })); } catch (e) { /* quota */ }
  }
  function disabled() {
    try { return Date.now() - Number(sessionStorage.getItem("avx_pt_off") || 0) < CACHE_MS; } catch (e) { return false; }
  }
  function disable() {
    stats.disabled = true;
    try { sessionStorage.setItem("avx_pt_off", String(Date.now())); } catch (e) { /* ignore */ }
  }

  function fetchMissing(lang, ids) {
    var cache = loadStored(lang);
    var missing = ids.filter(function (id) { return !(id in cache); });
    if (!missing.length) return Promise.resolve();
    var key = lang + "|" + missing.join(",");
    if (inflight[key]) return inflight[key];
    var jobs = [];
    for (var i = 0; i < missing.length; i += CHUNK) {
      jobs.push(missing.slice(i, i + CHUNK));
    }
    inflight[key] = Promise.all(jobs.map(function (chunk) {
      stats.requests++;
      var q = sb.from("property_translations").select("property_id,field,value,status,source_hash")
        .eq("lang", lang).in("property_id", chunk);
      if (!PREVIEW) q = q.eq("status", "approved");
      return q.then(function (res) {
          if (res.error) {
            disable();
            console.warn("Property translations are unavailable; showing English text.", res.error.message);
            return;
          }
          chunk.forEach(function (id) { cache[id] = {}; });
          (res.data || []).forEach(function (r) {
            if (!cache[r.property_id]) return;
            if (r.status !== "approved" && r.status !== "machine") return;
            cache[r.property_id][r.field] = {
              value: r.value,
              source_hash: r.source_hash
            };
            if (r.status === "machine") previewShown++;
          });
        });
    })).then(function () { persist(lang); }, function () { disable(); })
      .then(function () { delete inflight[key]; });
    return inflight[key];
  }

  function sourceText(row, field) {
    if (field === "features") {
      return Array.isArray(row.features)
        ? row.features.filter(function (s) { return typeof s === "string"; }).join("\n")
        : "";
    }
    return typeof row[field] === "string" ? row[field] : "";
  }

  function hashText(text) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (digest) {
      return Array.prototype.map.call(new Uint8Array(digest), function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  async function currentTranslations(row, cached) {
    var valid = {};
    var fields = TEXT_FIELDS.concat(["features"]);
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      var entry = cached && cached[field];
      var source = sourceText(row, field);
      if (!entry || !source.trim() || !entry.source_hash) continue;
      if (await hashText(source) === entry.source_hash) valid[field] = entry.value;
    }
    return valid;
  }

  function applyTo(row, tr) {
    var changed = false;
    TEXT_FIELDS.forEach(function (f) {
      if (typeof tr[f] === "string" && tr[f].trim() && row[f]) {
        if (!row._en) row._en = {};
        row._en[f] = row[f];
        row[f] = tr[f];
        changed = true;
      }
    });
    if (Array.isArray(tr.features) && tr.features.length && Array.isArray(row.features) && row.features.length) {
      if (!row._en) row._en = {};
      row._en.features = row.features;
      row.features = tr.features.filter(function (s) { return typeof s === "string" && s.trim(); });
      changed = true;
    }
    return changed;
  }

  function overlay(result) {
    try {
      if (!result || result.error || !result.data || disabled()) return result;
      var data = result.data;
      var rows = Array.isArray(data) ? data : [data];
      rows = rows.filter(function (r) { return r && typeof r === "object" && r.id && r.slug; });
      if (!rows.length) return result;
      return localeReady().then(function (lang) {
        stats.lang = lang;
        if (lang === "en") return result;
        var ids = rows.map(function (r) { return r.id; });
        return fetchMissing(lang, ids).then(async function () {
          var cache = mem[lang] || {};
          for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            stats.rows++;
            var fresh = await currentTranslations(r, cache[r.id]);
            var changed = applyTo(r, fresh);
            if (changed) stats.translated++;
          }
          showPreviewBanner();
          return result;
        });
      }).catch(function (error) {
        console.warn("Property translations could not be verified; showing English text.", error);
        return result;
      });
    } catch (e) {
      console.warn("Property translations could not be applied; showing English text.", e);
      return result;
    }
  }

  function wrap(builder) {
    return new Proxy(builder, {
      get: function (target, prop) {
        if (prop === "then") {
          return function (res, rej) { return Promise.resolve(target.then(overlay)).then(res, rej); };
        }
        var v = target[prop];
        if (typeof v !== "function") return v;
        return function () {
          var out = v.apply(target, arguments);
          return out && typeof out.then === "function" ? wrap(out) : out;
        };
      }
    });
  }

  var originalFrom = sb.from.bind(sb);
  sb.from = function (table) {
    var b = originalFrom(table);
    return table === "properties" ? wrap(b) : b;
  };
})();
