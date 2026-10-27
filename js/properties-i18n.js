/* Properties + property details pages only: translates page-specific UI strings that are rendered by
   shared scripts (near-me, map, recent/saved searches) or composed in JS (filter
   chips, card aria-labels). Reuses the avxI18n dictionary; English is untouched. */
(function () {
  "use strict";
  var EXACT = ["Remove this search", "Clear All Recent Searches", "Independent House", "List View", "Map View", "Buy", "Residential", "Commercial", "Land", "Villas", "Agricultural", "Apartments", "Investment", "Properties Near Me", "Filters & Sort", "Filter Properties", "Close filters", "Location / Area", "e.g. Chromepet, ECR, OMR...", "Industrial", "Special Purpose", "Luxury Villas", "Property Sub-Type", "Any Sub-Type", "Buy / Rent", "Buy or Rent", "Price Range (₹)", "Built-up Area (sq.ft)", "North", "South", "East", "West", "North-East", "North-West", "South-East", "South-West", "Fully Furnished", "Semi-Furnished", "Unfurnished", "Min. Road Width (ft)", "e.g. 30", "Show Results", "Recent Search", "No recent searches yet.", "Save this search", "Sort by", "Recommended", "Newest First", "Price: Low to High", "Price: High to Low", "Choose how to view results", "Search this area", "Map of properties", "No properties match your filters", "Try widening your price range or clearing a filter.", "Clear All Filters", "We couldn't load properties right now. Please refresh, or contact us directly.", "My Saved Properties", "My Shortlist & Compare", "Rent / Lease", "Map area", "Agricultural Land", "Apartment / Flat", "Commercial Building", "Commercial Plot", "Development Land", "Duplex", "Factory / Manufacturing", "Farm Land", "Hospital", "Hotel", "Industrial Building", "Industrial Plot", "Layout Plot", "Office Space", "Other Land", "Other Special Purpose", "Penthouse", "Plantation / Estate", "Residential Plot", "Resort", "School / Institution", "Shop / Retail", "Showroom", "Vacant Land", "Villa", "Warehouse", "Find properties near your current location.", "Allow Location Access", "Cancel", "Clear", "Waiting for location permission…", "Properties Near You", "Location isn't supported in this browser.", "Location access was not enabled.", "Location request timed out.", "Your location couldn't be determined right now.", "Close preview", "View Property", "No properties in this area yet.", "No properties available right now — please check back soon.", "Map tiles could not be loaded. Please check your internet connection or use List View.", "Saving isn't available right now.", "Couldn't save this search. Please try again.", "log in or create a free account", "View saved searches", "Search Properties", "Search Aventrix Realty's full property listings across Chennai — filter by location, type, buy or rent, price, bedrooms, bathrooms and area.", "Quick View", "Land Area", "UDS Area", "Floors", "Rental Income", "Property Description", "Brokerage", "Registered Real Estate Agent", "RERA Registered Real Estate Agent", "Similar Properties", "Recently Viewed", "Share this property", "Copy property link", "View full-screen gallery", "Close full-screen gallery", "Previous image", "Next image", "Tamil Nadu Real Estate Regulatory Authority", "Registration No.", "Link copied to clipboard", "Unable to copy link", "Unable to copy link on this browser", "Professional fees apply and are agreed upfront.", "Prefer a call back? Send an enquiry about this property →", "On Request", "Browse available properties", "This property is no longer available", "The listing you're looking for may have been sold, leased or removed. Please browse our current properties, or contact us and we'll help you find a similar one.", "Furnished", "Save to Wishlist", "Remove from Wishlist", "Add to Shortlist", "Remove from Shortlist", "Shortlisted", "Contact for Price", "Call", "Property Type", "Sub-Type", "Listing Type", "Bedrooms", "Bathrooms", "Built-up Area", "Parking", "Furnishing", "Facing", "Road Width", "Key Features", "Read More", "Read Less", "Property Overview", "Close", "Property quick view", "FOR SALE", "FOR LEASE", "Luxury Villas", "How Our Fees Work →"];
  var TEMPLATES = ["View {title}", "Call about {title}", "WhatsApp about {title}", "Showing localities within {n} km of your current location. Distance shown is to each locality's centre, not the exact property.", "No known localities within {n} km. Try a larger radius, or search by location manually below.", "No published properties found near you yet within {n} km. Try a larger radius, or search by location manually below.", "Showing {on} of {total} properties on the map.", "Showing {on} of {total} properties on the map. Some properties are not currently available on the map — see List View.", "Showing {on} property in this map area.", "Showing {on} properties in this map area.", "Please {link} to save searches.", "Search saved. {link}", "Quick view {title}"];
  var ATTRS = ["placeholder", "aria-label", "title"];
  var exact = {}; EXACT.forEach(function (k) { exact[k] = 1; });
  var tpl = TEMPLATES.map(function (k) {
    var names = [];
    var re = k.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(\w+)\}/g, function (_, n) { names.push(n); return "(.+?)"; });
    return { key: k, names: names, re: new RegExp("^" + re + "$") };
  });
  var i18n, busy = false;
  function tr(k) { return i18n.t(k); }
  function word(s) { return exact[s] ? tr(s) : s; }
  function fill(k, vals) { return tr(k).replace(/\{(\w+)\}/g, function (m, n) { return vals[n] != null ? vals[n] : m; }); }

  function translateString(s) {
    var m;
    if (exact[s]) return tr(s);
    for (var i = 0; i < tpl.length; i++) {
      if (tpl[i].key.indexOf("{link}") !== -1 || tpl[i].key.indexOf("{title}") !== -1) continue;
      m = tpl[i].re.exec(s);
      if (m) { var v = {}; tpl[i].names.forEach(function (n, j) { v[n] = m[j + 1]; }); return fill(tpl[i].key, v); }
    }
    if ((m = /^(Location|Type|Sub-Type|Facing): (.+)$/.exec(s))) return tr(m[1]) + ": " + word(m[2]);
    if ((m = /^Price: (.+)$/.exec(s))) return tr("Price") + ": " + m[1].replace(/^Up to /, tr("Up to") + " ");
    if ((m = /^Area: (.+)$/.exec(s))) return tr("Area") + ": " + m[1].replace(/^Up to /, tr("Up to") + " ").replace(/ sq\.ft$/, " " + tr("sq.ft"));
    if ((m = /^(\d+)\+ (Beds|Baths|Parking)$/.exec(s))) return m[1] + "+ " + tr(m[2]);
    if ((m = /^Road Width: (\d+)\+ ft$/.exec(s))) return tr("Road Width") + ": " + m[1] + "+ " + tr("ft");
    if ((m = /^(~?\d+(?:\.\d+)?) km$/.exec(s))) return m[1] + " " + tr("km");
    return null;
  }

  var RECENT = /^(?:(\d+)\+ BHK )?(Residential|Apartments|Villas|Commercial|Land|Investment|Industrial|Special Purpose|Agricultural|Properties)(?: in (.+?))?(?: (Up to ₹\S+|₹\S+|\(Buy\)|\(Lease\)))?$/;
  function translateRecent(s) {
    var m = RECENT.exec(s);
    if (!m) return null;
    var parts = [];
    if (m[1]) parts.push(m[1] + "+ BHK");
    parts.push(tr(m[2]));
    if (m[3]) parts.push(fill("in {place}", { place: m[3] }));
    if (m[4]) parts.push(m[4].replace(/^Up to /, tr("Up to") + " ").replace(/^\((Buy|Lease)\)$/, function (x) { return tr(x); }));
    return parts.join(" ");
  }

  function translateText(node) {
    var raw = node.nodeValue, s = raw.trim();
    if (!s) return;
    var p = node.parentElement;
    var out = p && p.closest(".home-app-recent-chip, .rs-expanded-link") ? translateRecent(s) : translateString(s);
    if (out == null && p && p.closest(".pd-spec-value")) out = translateUnits(s);
    if (out != null && out !== s) node.nodeValue = raw.replace(s, out);
  }

  // Listing specs are free text; only the measurement unit words are localised.
  function translateUnits(s) {
    var out = s.replace(/\b(?:sq\.?\s?ft|sqft|sft)\b\.?/gi, function () { return tr("sq.ft"); })
      .replace(/(\d)\s?ft\b\.?/gi, function (m, d) { return d + " " + tr("ft"); })
      .replace(/\bacres?\b/gi, function () { return tr("acres"); })
      .replace(/\bcents?\b/gi, function () { return tr("cents"); });
    return out === s ? null : out;
  }

  function translateAttrs(el) {
    ATTRS.forEach(function (a) {
      var v = el.getAttribute && el.getAttribute(a);
      if (!v) return;
      var out = null, m;
      if (a === "aria-label" && v === "Remove this search") out = tr(v);
      else if (a === "aria-label" && el.closest && el.closest(".property-card") && (m = /^(View|Call about|WhatsApp about|Quick view) (.+)$/.exec(v))) {
        out = fill(m[1] + " {title}", { title: m[2] });
      } else if (a === "title" && v === "Call") out = tr("Call");
      else out = translateString(v);
      if (out != null && out !== v) el.setAttribute(a, out);
    });
  }

  function translateStatus(el) {
    var link = el.querySelector("a");
    if (!link || el.firstChild.nodeType !== 3 || el.lastChild === el.firstChild) return;
    var before = el.firstChild.nodeValue, after = el.lastChild.nodeType === 3 ? el.lastChild.nodeValue : "", key, linkKey;
    if (before === "Please " && after === " to save searches.") { key = "Please {link} to save searches."; linkKey = "log in or create a free account"; }
    else if (before === "Search saved. " && after === "") { key = "Search saved. {link}"; linkKey = "View saved searches"; }
    else return;
    var a = link.cloneNode(false);
    a.textContent = tr(linkKey);
    var parts = tr(key).split("{link}");
    el.textContent = "";
    el.appendChild(document.createTextNode(parts[0]));
    el.appendChild(a);
    el.appendChild(document.createTextNode(parts[1] || ""));
  }

  function run(root) {
    if (busy) return;
    busy = true;
    try {
      if (root.nodeType === 3) { translateText(root); return; }
      if (root.nodeType !== 1) return;
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          var p = n.parentNode;
          return p && /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
      });
      var n; while ((n = w.nextNode())) translateText(n);
      translateAttrs(root);
      root.querySelectorAll("[placeholder],[aria-label],[title]").forEach(translateAttrs);
      if (root.matches && root.matches(".sf-save-status")) translateStatus(root);
      root.querySelectorAll(".sf-save-status").forEach(translateStatus);
      var st = root.closest && root.closest(".sf-save-status");
      if (st) translateStatus(st);
    } finally { busy = false; }
  }

  function translateHead() {
    var title = document.title.replace(/^Search Properties(?= \|)/, tr("Search Properties"));
    if (title !== document.title) document.title = title;
    var d = document.querySelector('meta[name="description"]');
    var og = document.querySelector('meta[property="og:description"]');
    [d, og].forEach(function (el) {
      if (!el) return;
      var c = el.getAttribute("content");
      if (c && c === "Search Aventrix Realty's full property listings across Chennai — filter by location, type, buy or rent, price, bedrooms, bathrooms and area.") el.setAttribute("content", tr(c));
    });
    var ot = document.querySelector('meta[property="og:title"]');
    if (ot) ot.setAttribute("content", document.title);
  }

  function start() {
    i18n = window.avxI18n;
    if (!i18n) return;
    i18n.ready.then(function () {
      if (i18n.getLocale() === "en") return;
      translateHead();
      run(document.body);
      new MutationObserver(function (muts) {
        muts.forEach(function (mu) {
          if (mu.type === "attributes") { translateAttrs(mu.target); return; }
          if (mu.type === "characterData") { run(mu.target); return; }
          mu.addedNodes.forEach(function (n) { run(n); });
          if (mu.target.nodeType === 1 && mu.target.classList.contains("sf-save-status")) translateStatus(mu.target);
        });
      }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    });
  }

  if (window.avxI18n) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
