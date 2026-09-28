/*
 * AVENTRIX REALTY — LIST / MAP VIEW COMPONENT
 * -------------------------------------------------------------
 * ONE map implementation, used in two places:
 *   - properties.html  (id prefix "sf") — results from js/properties-search.js
 *     ("aventrix:search-results"): the Properties page's one query + all filters.
 *   - index.html       (id prefix "hp") — results from js/home-app-experience.js
 *     ("aventrix:home-properties"): the homepage's existing Future Properties
 *     query (Published, Featured first, latest 20).
 * Neither instance queries the database. Each shows exactly the records its
 * page already loaded; List View renders those same records as cards.
 *
 *  - Markers: only for properties with their own latitude/longitude
 *    (Admin → Properties → Map location). Nothing is guessed or geocoded.
 *  - Google Maps JavaScript API is loaded once per page, only when Map View
 *    is first opened, with the key from js/maps-config.js. Any failure (no
 *    key, invalid key, network, timeout) shows a fallback message; List
 *    View is never affected.
 *  - Clustering: small built-in grid clusterer (no extra library).
 *  - "Search this area" (Properties page only): applies the visible map
 *    area as one more filter in the shared search engine.
 */
(function () {
    "use strict";

    var FALLBACK_TEXT = "Map view is temporarily unavailable. Please use List View to browse properties.";
    var CLUSTER_RADIUS_PX = 64;  // wide enough that neighbouring price bubbles don't overlap
    var NO_CLUSTER_ZOOM = 18;
    // Default map center when no property has coordinates yet. Only used to
    // point the camera somewhere sensible — never attached to a property or
    // rendered as a marker/pin.
    var CHENNAI_CENTER = { lat: 13.0827, lng: 80.2707 };
    var NO_MARKERS_ZOOM = 11;
    // Closest zoom the automatic first overview of the results may use —
    // neighbourhood level, so the initial view shows where properties are
    // rather than zooming into one of them.
    var OVERVIEW_MAX_ZOOM = 14;
    // "Current Location" (Properties Map View only) — browser geolocation,
    // shown for this page view only, never treated as a property and
    // never persisted anywhere. See makeCurrentLocationMarker() below.
    var CURRENT_LOCATION_ZOOM = 16;

    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

    // A property's own map coordinates, or null. Never guessed.
    // (Also used by js/properties-search.js for "Search this area".)
    function coordsOf(p) {
        if (!p || p.latitude === null || p.latitude === undefined || p.longitude === null || p.longitude === undefined ||
            p.latitude === "" || p.longitude === "") return null;
        var lat = Number(p.latitude), lng = Number(p.longitude);
        if (!isFinite(lat) || !isFinite(lng)) return null;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
        if (lat === 0 && lng === 0) return null;
        return { lat: lat, lng: lng };
    }

    // ------------------------------------------------------------
    // Google Maps loader — shared by every instance, loaded at most once
    // ------------------------------------------------------------
    var Maps = { status: "idle", waiters: [] };  // idle | loading | ready | failed
    function mapsSettle(status) {
        Maps.status = status;
        var w = Maps.waiters; Maps.waiters = [];
        w.forEach(function (fn) { fn(status); });
    }
    function loadGoogleMaps(done) {
        if (Maps.status === "ready" || Maps.status === "failed") { done(Maps.status); return; }
        Maps.waiters.push(done);
        if (Maps.status === "loading") return;
        if (window.google && window.google.maps && window.google.maps.Map) { mapsSettle("ready"); return; }
        var cfg = window.AVENTRIX_MAPS_CONFIG || {};
        var key = String(cfg.apiKey || "").trim();
        if (!key) { mapsSettle("failed"); return; }
        Maps.status = "loading";
        var finished = false;
        function finish(status) { if (finished) return; finished = true; clearTimeout(timer); mapsSettle(status); }
        var timer = setTimeout(function () { finish("failed"); }, 15000);
        window.__aventrixMapsReady = function () {
            var ok = !!(window.google && window.google.maps && window.google.maps.Map);
            finish(ok ? "ready" : "failed");
        };
        // Google calls this when the key is invalid, restricted or unbilled —
        // possibly after the map has already been drawn.
        window.gm_authFailure = function () {
            finished = true; clearTimeout(timer);
            Maps.status = "failed";
            Instances.forEach(function (inst) { inst.onMapsFailed(); });
            mapsSettle("failed");
        };
        var s = document.createElement("script");
        s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) +
            "&v=weekly&loading=async&libraries=marker&callback=__aventrixMapsReady";
        s.async = true;
        s.onerror = function () { finish("failed"); };
        document.head.appendChild(s);
    }

    // ------------------------------------------------------------
    // Shared helpers (markers, preview text)
    // ------------------------------------------------------------
    // Property pin: Aventrix green with a white house + gold door, plus a white
    // ring and soft shadow so it stays clearly visible on satellite imagery.
    // The tip (bottom-centre) is the exact property coordinate.
    var MARKER_SHADOW = '<filter id="avxShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.45"/></filter>';
    var PIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="-2 -2 34 42"><defs>' + MARKER_SHADOW + '</defs>' +
        '<path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.9 15 40 15 40s15-14.1 15-25.2C30 6.6 23.3 0 15 0z" fill="#0F3B2E" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" filter="url(#avxShadow)"/>' +
        '<path d="M15 6.8 7.6 13.2h2.2v7.3h10.4v-7.3h2.2z" fill="#ffffff"/><rect x="13.4" y="16.2" width="3.2" height="4.3" fill="#D4AF37"/></svg>';
    function svgUrl(svg) { return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg); }

    // ---- Map-only marker artwork: price bubbles + "N Properties" clusters ----
    // Compact price for a property's map bubble, built ONLY from its own stored
    // price_value (rupees): ₹68 L, ₹1.10 Cr, ₹50K/mo. No number → null, and the
    // property keeps the plain house pin (never a made-up or "from" price).
    function priceShort(p) {
        var v = Number(p && p.price_value);
        if (!p || p.price_value === null || p.price_value === "" || !isFinite(v) || v <= 0) return null;
        var s;
        if (v >= 1e7) { var cr = v / 1e7; s = (cr >= 100 ? String(Math.round(cr)) : cr.toFixed(2).replace(/\.00$/, "")) + " Cr"; }
        else if (v >= 1e5) { var l = v / 1e5; s = (l >= 100 ? String(Math.round(l)) : l.toFixed(2).replace(/\.?0+$/, "")) + " L"; }
        else if (v >= 1000) { s = (v / 1000).toFixed(1).replace(/\.0$/, "") + "K"; }
        else s = String(Math.round(v));
        // Rent/lease: only mark the period when the property's own price text states it.
        var d = String(p.price_display || "");
        var per = /month|\/\s*mo\b|p\.?\s*m\b/i.test(d) ? "/mo" : /year|annum|\/\s*yr\b|p\.?\s*a\b/i.test(d) ? "/yr" : "";
        return "₹" + s + (p.listing_type === "lease" ? per : "");
    }
    var MARKER_FONT = "700 12px Arial, Helvetica, sans-serif";
    var CLUSTER_FONT = "700 12.5px Montserrat, Arial, Helvetica, sans-serif";
    var measureCtx = null;
    function textWidth(text, font) {
        try {
            measureCtx = measureCtx || document.createElement("canvas").getContext("2d");
            measureCtx.font = font;
            return Math.ceil(measureCtx.measureText(text).width);
        } catch (e) { return Math.ceil(String(text).length * 7.4); }
    }
    // Price bubble: dark-green pill, white price, gold hairline, small pointer
    // whose tip is the property's exact coordinate (the marker anchor).
    // Price bubble: Aventrix-green pill with a white ring + soft shadow (clearly
    // visible on satellite imagery), white price text, and a pointer whose tip
    // is the exact property coordinate (bottom-centre = the marker anchor).
    function priceBubble(text) {
        var pad = 3, w0 = Math.max(46, textWidth(text, MARKER_FONT) + 22), h0 = 26, tip = 7;
        var W = w0 + pad * 2, cx = W / 2, x0 = pad, x1 = pad + w0, y0 = pad, y1 = pad + h0, r = h0 / 2, H = y1 + tip;
        var d = "M" + (x0 + r) + " " + y0 + " H" + (x1 - r) + " A" + r + " " + r + " 0 0 1 " + (x1 - r) + " " + y1 +
            " H" + (cx + 6) + " L" + cx + " " + H + " L" + (cx - 6) + " " + y1 + " H" + (x0 + r) + " A" + r + " " + r + " 0 0 1 " + (x0 + r) + " " + y0 + " Z";
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"><defs>' + MARKER_SHADOW + '</defs>' +
            '<path d="' + d + '" fill="#0F3B2E" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" filter="url(#avxShadow)"/>' +
            '<text x="' + cx + '" y="' + (y0 + h0 / 2 + 4.2) + '" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" fill="#ffffff">' + esc(text) + '</text></svg>';
        return { svg: svg, w: W, h: H };
    }
    var HOUSE_GLYPH = '<path d="M7 1.6 0.8 7h1.9v6h3.2V9.4h2.2V13h3.2V7h1.9z" fill="#D4AF37"/>';
    function clusterText(n) { return n + (n === 1 ? " Property" : " Properties"); }
    // Cluster pill: house glyph + "N Properties" (the text itself is drawn by
    // the marker label so it uses the site font); centred on the cluster point.
    function clusterPill(n) {
        var tw = textWidth(clusterText(n), CLUSTER_FONT), w = tw + 46, h = 32;
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
            '<rect x="1.5" y="1.5" width="' + (w - 3) + '" height="' + (h - 3) + '" rx="' + ((h - 3) / 2) + '" fill="#0F3B2E" stroke="#D4AF37" stroke-width="1.5"/>' +
            '<g transform="translate(13 8.5)">' + HOUSE_GLYPH + '</g></svg>';
        return { svg: svg, w: w, h: h, labelX: 32 + tw / 2, labelY: h / 2 };
    }
    // Blue "you are here" dot with a soft halo — deliberately unlike the
    // dark-green/gold property pin (PIN_SVG), the price bubbles and the
    // "N Properties" cluster pills, so it can never be mistaken for a property marker.
    var CURRENT_LOCATION_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">' +
        '<circle cx="17" cy="17" r="16" fill="#1A73E8" fill-opacity="0.18"/>' +
        '<circle cx="17" cy="17" r="8" fill="#1A73E8" stroke="#ffffff" stroke-width="3"/></svg>';
    function project(pos, zoom) {
        var scale = 256 * Math.pow(2, zoom);
        var siny = Math.min(Math.max(Math.sin(pos.lat * Math.PI / 180), -0.9999), 0.9999);
        return { x: scale * (0.5 + pos.lng / 360), y: scale * (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)) };
    }
    function typeLabel(p) {
        var T = window.AventrixPropertyTaxonomy && window.AventrixPropertyTaxonomy.TYPE_SUBTYPES;
        if (T && p.category && p.sub_type && T[p.category]) {
            var hit = T[p.category].filter(function (s) { return s.value === p.sub_type; })[0];
            if (hit) return hit.label;
        }
        var LABELS = { residential: "Residential", apartments: "Apartment", villas: "Villa", commercial: "Commercial", land: "Land / Plot",
            investment: "Investment", industrial: "Industrial", special_purpose: "Special Purpose", agricultural: "Agricultural" };
        return LABELS[p.category] || "";
    }
    function configLine(p) {
        var parts = [];
        if (p.bedrooms) parts.push(p.bedrooms + " BHK");
        var t = typeLabel(p); if (t) parts.push(t);
        parts.push(p.listing_type === "lease" ? "For Lease" : "For Sale");
        return parts.join(" · ");
    }
    function areaLine(p) { return p.built_up_area || p.land_area || p.uds_area || ""; }

    var Instances = [];

    // ------------------------------------------------------------
    // One List / Map instance
    // cfg: { name, prefix, grid, viewKey, event, initial(), messages{},
    //        areaSearch: { get(), set(bounds) } | null, syncCard(slug, kind, on) }
    // ------------------------------------------------------------
    function createInstance(cfg) {
        var $ = function (suffix) { return document.getElementById(cfg.prefix + suffix); };
        var els = {
            listBtn: $("ViewListBtn"), mapBtn: $("ViewMapBtn"), mapView: $("MapView"),
            wrap: $("MapWrap"), canvas: $("MapCanvas"), note: $("MapNote"),
            fallback: $("MapFallback"), fallbackText: $("MapFallbackText"),
            areaBtn: $("MapAreaBtn"), preview: $("MapPreview"), loading: $("MapLoading"),
            currentBtn: $("CurrentLocationBtn"), currentStatus: $("CurrentLocationStatus")
        };
        var grid = cfg.grid;
        if (!grid || !els.listBtn || !els.mapBtn || !els.mapView || !els.wrap || !els.canvas || !els.preview) return null;
        function hide(el, h) { if (el) el.hidden = h; }

        var state = {
            view: "list", results: [], status: "loading",
            map: null, useAdvanced: false,
            markers: {}, clusterPool: [], mapped: [], clusters: [],
            lastGesture: 0, fittedFor: null, preview: null,
            currentLocationMarker: null
        };

        // ---- view toggle ----
        function setView(view, remember) {
            state.view = view === "map" ? "map" : "list";
            var isMap = state.view === "map";
            els.listBtn.classList.toggle("is-active", !isMap);
            els.mapBtn.classList.toggle("is-active", isMap);
            els.listBtn.setAttribute("aria-pressed", String(!isMap));
            els.mapBtn.setAttribute("aria-pressed", String(isMap));
            grid.hidden = isMap;
            els.mapView.hidden = !isMap;
            if (remember) { try { sessionStorage.setItem(cfg.viewKey, state.view); } catch (e) {} }
            if (isMap) refresh(false); else closePreview();
            updateFloats();
        }
        els.listBtn.addEventListener("click", function () { setView("list", true); });
        els.mapBtn.addEventListener("click", function () { setView("map", true); });

        // ---- results from this page's own data source ----
        document.addEventListener(cfg.event, function (e) {
            var d = e.detail || {};
            state.results = d.properties || [];
            state.status = d.status || "ok";
            if (state.view === "map") refresh(!!d.mapArea);
        });

        function mappable() {
            var out = [];
            state.results.forEach(function (p) { var c = coordsOf(p); if (c) out.push({ p: p, pos: c }); });
            return out;
        }

        // True once the map exists and NONE of the currently mapped
        // properties' own stored coordinates fall inside the map's current
        // visible viewport (google.maps.LatLngBounds.contains) — i.e. the
        // visitor has panned/zoomed somewhere with nothing mapped nearby.
        // This never removes or re-fetches anything: it only reads the
        // already-loaded `list` (from mappable()) and the map's own
        // getBounds(), so panning never triggers a new Supabase request.
        function viewportHasNoMapped(list) {
            if (!state.map || !list.length) return false;
            var b = state.map.getBounds();
            if (!b) return false;
            return !list.some(function (x) { return b.contains(x.pos); });
        }

        function updateNote(list) {
            var total = state.results.length, onMap = list.length, missing = total - onMap, m = cfg.messages;
            var area = cfg.areaSearch && cfg.areaSearch.get();
            var msg = "";
            if (state.status === "loading") msg = "";
            else if (state.status === "error" || total === 0) msg = m.empty || "";
            else if (onMap === 0) msg = m.none(total);
            // Only when the visitor hasn't run "Search this area" (that has
            // its own, more specific message below) — every mapped property
            // has real coordinates, so this is a true empty-viewport read,
            // never a guess.
            else if (!area && viewportHasNoMapped(list)) msg = m.emptyViewport || "No properties in this area yet.";
            else if (missing > 0) msg = m.some(onMap, total);
            else if (area && m.area) msg = m.area(onMap);
            els.note.textContent = msg;
            els.note.hidden = !msg;
        }

        function showFallback() {
            els.fallbackText.textContent = FALLBACK_TEXT;
            els.fallback.hidden = false;
            els.wrap.hidden = true;
            hide(els.loading, true);
            hide(els.areaBtn, true);
            closePreview();
        }

        // On opening Map View and on every new result set while open.
        //
        // States the map must NOT confuse:
        //   - Google Maps genuinely failed to load (bad/missing key, network,
        //     timeout, gm_authFailure) -> showFallback(): no canvas, "Map view
        //     is temporarily unavailable." This is the ONLY state that hides
        //     the actual map canvas.
        //   - The property data request itself failed (network/API error) ->
        //     nothing reliable to show or center on; same fallback treatment
        //     as a Maps failure, but kept visually distinct from it (no
        //     canvas either way, since the page's own empty/error state
        //     already covers this on the List View side).
        //   - Google Maps is fine and the property data loaded, but there are
        //     zero results for the current search OR none of today's results
        //     have their own coordinates yet -> the map itself ALWAYS still
        //     renders — centered on Chennai — with zero markers and a small,
        //     non-blocking note; it must never be replaced by a blank panel
        //     or collapse to nothing.
        function refresh(fromArea) {
            var list = mappable();
            updateNote(list);
            if (state.status === "loading") return;
            if (Maps.status === "failed") { showFallback(); return; }
            if (state.status === "error") {
                els.wrap.hidden = true; els.fallback.hidden = true; hide(els.areaBtn, true);
                closePreview();
                if (state.map) syncMarkers([]); else state.mapped = [];
                return;
            }
            // Whether there are zero results at all (empty search/DB) or
            // results with no coordinates yet, the map stays visible and
            // interactive from here on — only the note above it changes.
            els.fallback.hidden = true;
            els.wrap.hidden = false;
            if (Maps.status !== "ready") {
                hide(els.loading, false);
                loadGoogleMaps(function (status) {
                    hide(els.loading, true);
                    if (status !== "ready") { showFallback(); return; }
                    var g = window.google.maps, mc = window.AVENTRIX_MAPS_CONFIG || {};
                    state.useAdvanced = !!(mc.mapId && g.marker && g.marker.AdvancedMarkerElement);
                    if (state.view === "map") refresh(false);
                });
                return;
            }
            if (!ensureMap(list)) return;
            syncMarkers(list);
            if (!list.length) {
                // Map is visible and centered; there's simply nothing to fit/preview.
                hide(els.areaBtn, true);
                closePreview();
                return;
            }
            var sig = list.map(function (x) { return x.p.slug; }).join("|");
            // After "Search this area" keep the visitor's own view; otherwise frame the results.
            if (!fromArea && sig !== state.fittedFor) fitTo(list);
            state.fittedFor = sig;
            if (fromArea) hide(els.areaBtn, true);
            if (state.preview && !state.preview.items.every(function (p) { return list.some(function (x) { return x.p.slug === p.slug; }); })) closePreview();
        }

        function ensureMap(list) {
            if (state.map) return true;
            var g = window.google.maps, mc = window.AVENTRIX_MAPS_CONFIG || {};
            // No property has coordinates yet: still show a real, usable map —
            // centered on Chennai, zoomed out — rather than nothing at all.
            var opts = {
                center: list.length ? list[0].pos : CHENNAI_CENTER,
                zoom: list.length ? 12 : NO_MARKERS_ZOOM,
                // No mapTypeId set here on purpose: Google Maps' own default
                // ("roadmap") applies, and mapTypeIds below only ever offers
                // Roadmap and Satellite — Roadmap stays the default type on
                // every load, and Satellite is reachable via the dropdown.
                gestureHandling: "greedy", clickableIcons: false,
                // Map / Satellite switcher. Kept small (a dropdown, not the
                // horizontal button bar) and pinned to the top-left corner —
                // the one corner nothing else uses ("Search this area" is
                // top-center, zoom is top-right, the property preview card
                // is bottom-left but only appears after a marker is tapped).
                mapTypeControl: true,
                mapTypeControlOptions: {
                    style: g.MapTypeControlStyle ? g.MapTypeControlStyle.DROPDOWN_MENU : undefined,
                    position: g.ControlPosition ? g.ControlPosition.TOP_LEFT : undefined,
                    // "hybrid", not "satellite": Google's own control still
                    // labels this option "Satellite" (its native English
                    // label for HYBRID), but the map type it actually applies
                    // is satellite imagery WITH roads/locality labels drawn on
                    // top — plain "satellite" imagery alone has no labels at
                    // all and looks blank. Only Roadmap/Satellite are offered;
                    // no separate "Hybrid" option is exposed.
                    mapTypeIds: ["roadmap", "hybrid"]
                },
                streetViewControl: false, fullscreenControl: false,
                zoomControl: true,
                zoomControlOptions: { position: g.ControlPosition ? g.ControlPosition.RIGHT_TOP : undefined }
            };
            if (mc.mapId) opts.mapId = mc.mapId;
            try { state.map = new g.Map(els.canvas, opts); }
            catch (err) { Maps.status = "failed"; showFallback(); return false; }
            // "Search this area" appears only after the VISITOR moves the map.
            ["pointerdown", "wheel", "touchstart", "keydown"].forEach(function (t) {
                els.canvas.addEventListener(t, function () { state.lastGesture = Date.now(); }, { passive: true, capture: true });
            });
            state.map.addListener("idle", function () {
                recluster();
                if (cfg.areaSearch && Date.now() - state.lastGesture < 4000) hide(els.areaBtn, false);
                // Re-evaluate the note (in particular the "no properties in
                // this area yet" message) against the NEW viewport after
                // every pan/zoom/map-type change settles. This reads only
                // the already-loaded results (mappable()) and the map's own
                // getBounds() — no new Supabase request is triggered by
                // panning or zooming.
                updateNote(mappable());
            });
            state.map.addListener("dragstart", function () { state.lastGesture = Date.now(); });
            state.map.addListener("click", closePreview);
            return true;
        }

        function fitTo(list) {
            var g = window.google.maps;
            state.lastGesture = 0;
            hide(els.areaBtn, true);
            // One property: center on it at neighbourhood level (roads and
            // nearby localities readable) rather than zooming into it.
            if (list.length === 1) { state.map.setCenter(list[0].pos); state.map.setZoom(OVERVIEW_MAX_ZOOM); return; }
            var b = new g.LatLngBounds();
            list.forEach(function (x) { b.extend(x.pos); });
            state.map.fitBounds(b, 56);
            // fitBounds frames the actual spread of the properties (so
            // South-Chennai-only listings aren't shown as a tiny speck on an
            // all-Chennai map), but when they sit close together it would
            // zoom right in. Cap that first overview once; the visitor's own
            // zooming afterwards is never limited.
            var capOnce = state.map.addListener("idle", function () {
                capOnce.remove();
                if (state.map.getZoom() > OVERVIEW_MAX_ZOOM) state.map.setZoom(OVERVIEW_MAX_ZOOM);
            });
        }

        // ---- markers (one per property, created once) + clustering ----
        // price: the property's compact price text (priceShort) or null — a
        // property with a price gets a price bubble, one without keeps the
        // house pin. Either way the anchor/tip is the exact stored coordinate.
        function makeMarker(kind, pos, title, onClick, price) {
            var g = window.google.maps;
            if (state.useAdvanced) {
                var el = document.createElement("div");
                el.className = kind === "cluster" ? "sf-map-cluster" : (price ? "sf-map-price" : "sf-map-pin");
                if (kind !== "cluster") {
                    if (price) el.textContent = price; else el.innerHTML = PIN_SVG;
                }
                var am = new g.marker.AdvancedMarkerElement({ position: pos, content: el, title: title || "", gmpClickable: true });
                var last = 0, once = function () { var t = Date.now(); if (t - last > 300) { last = t; onClick(); } };
                am.addListener("click", once);
                try { am.addListener("gmp-click", once); } catch (e) {}
                return {
                    show: function () { if (am.map !== state.map) am.map = state.map; },
                    hide: function () { if (am.map) am.map = null; },
                    setPos: function (p) { am.position = p; },
                    setCount: function (n) {
                        el.innerHTML = '<svg class="sf-map-cluster-ico" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">' + HOUSE_GLYPH + '</svg>' +
                            '<span>' + esc(clusterText(n)) + '</span>';
                        el.setAttribute("data-count", n); am.title = clusterText(n);
                    }
                };
            }
            var icon;
            if (kind !== "cluster") {
                if (price) { var pb = priceBubble(price); icon = { url: svgUrl(pb.svg), scaledSize: new g.Size(pb.w, pb.h), anchor: new g.Point(pb.w / 2, pb.h) }; }
                else icon = { url: svgUrl(PIN_SVG), scaledSize: new g.Size(34, 42), anchor: new g.Point(17, 42) };
            }
            var mk = new g.Marker({ position: pos, title: title || "", optimized: true, icon: icon });
            mk.addListener("click", onClick);
            var onMap = false;
            return {
                show: function () { if (!onMap) { mk.setMap(state.map); onMap = true; } },
                hide: function () { if (onMap) { mk.setMap(null); onMap = false; } },
                setPos: function (p) { mk.setPosition(p); },
                setCount: function (n) {
                    var c = clusterPill(n);
                    mk.setIcon({ url: svgUrl(c.svg), scaledSize: new g.Size(c.w, c.h), anchor: new g.Point(c.w / 2, c.h / 2),
                        labelOrigin: new g.Point(c.labelX, c.labelY) });
                    mk.setLabel({ text: clusterText(n), color: "#ffffff", fontSize: "12.5px", fontWeight: "700", fontFamily: "Montserrat, Arial, Helvetica, sans-serif" });
                    mk.setTitle(clusterText(n));
                    // Bigger groups sit on top of price bubbles, but always below the blue Current Location dot (999).
                    if (mk.setZIndex) mk.setZIndex(Math.min(900, 500 + n));
                }
            };
        }

        // ---- "Current Location" marker (Properties Map View only) ----
        // Deliberately NOT built with makeMarker(): it is never a property,
        // never clickable to open the property preview, never added to
        // state.markers/clusterPool, and so never takes part in
        // syncMarkers()/recluster() — it cannot be confused with, hidden
        // by, or clustered together with a property pin.
        function makeCurrentLocationMarker(pos) {
            var g = window.google.maps;
            if (state.useAdvanced) {
                var el = document.createElement("div");
                el.className = "sf-current-location-dot";
                el.innerHTML = CURRENT_LOCATION_SVG;
                var am = new g.marker.AdvancedMarkerElement({ position: pos, content: el, title: "Your current location", gmpClickable: false });
                return {
                    show: function () { if (am.map !== state.map) am.map = state.map; },
                    hide: function () { if (am.map) am.map = null; },
                    setPos: function (p) { am.position = p; }
                };
            }
            var mk = new g.Marker({
                position: pos, title: "Your current location", optimized: true, clickable: false, zIndex: 999,
                icon: { url: svgUrl(CURRENT_LOCATION_SVG), scaledSize: new g.Size(34, 34), anchor: new g.Point(17, 17) }
            });
            var onMap = false;
            return {
                show: function () { if (!onMap) { mk.setMap(state.map); onMap = true; } },
                hide: function () { if (onMap) { mk.setMap(null); onMap = false; } },
                setPos: function (p) { mk.setPosition(p); }
            };
        }

        function ensureCurrentLocationMarker(pos) {
            if (state.currentLocationMarker) { state.currentLocationMarker.setPos(pos); state.currentLocationMarker.show(); return; }
            state.currentLocationMarker = makeCurrentLocationMarker(pos);
            state.currentLocationMarker.show();
        }

        var currentLocationStatusTimer = null;
        function showCurrentLocationStatus(text) {
            if (!els.currentStatus) return;
            clearTimeout(currentLocationStatusTimer);
            els.currentStatus.textContent = text;
            els.currentStatus.hidden = false;
            currentLocationStatusTimer = setTimeout(function () { els.currentStatus.hidden = true; }, 4500);
        }
        function hideCurrentLocationStatus() {
            clearTimeout(currentLocationStatusTimer);
            if (els.currentStatus) els.currentStatus.hidden = true;
        }

        function syncMarkers(list) {
            state.mapped = list;
            var keep = {};
            list.forEach(function (x) {
                var slug = x.p.slug;
                keep[slug] = true;
                if (!state.markers[slug]) state.markers[slug] = makeMarker("pin", x.pos, x.p.title, function () { openPreview([state.markers[slug].data.p]); }, priceShort(x.p));
                else state.markers[slug].setPos(x.pos);
                state.markers[slug].data = x;
            });
            Object.keys(state.markers).forEach(function (slug) { if (!keep[slug]) state.markers[slug].hide(); });
            recluster();
        }

        function recluster() {
            if (!state.map) return;
            var zoom = state.map.getZoom();
            if (typeof zoom !== "number") return;
            var groups = [];
            state.mapped.forEach(function (x) {
                var pt = project(x.pos, zoom), hit = null;
                for (var i = 0; i < groups.length; i++) {
                    var gp = groups[i], dx = gp.x - pt.x, dy = gp.y - pt.y;
                    if (Math.sqrt(dx * dx + dy * dy) <= (zoom >= NO_CLUSTER_ZOOM ? 1 : CLUSTER_RADIUS_PX)) { hit = gp; break; }
                }
                if (hit) hit.items.push(x); else groups.push({ x: pt.x, y: pt.y, items: [x] });
            });
            var used = 0;
            groups.forEach(function (gp) {
                if (gp.items.length === 1) { state.markers[gp.items[0].p.slug].show(); return; }
                gp.items.forEach(function (x) { state.markers[x.p.slug].hide(); });
                var lat = 0, lng = 0;
                gp.items.forEach(function (x) { lat += x.pos.lat; lng += x.pos.lng; });
                var center = { lat: lat / gp.items.length, lng: lng / gp.items.length };
                var c = state.clusterPool[used];
                if (!c) { c = makeMarker("cluster", center, "", function () { onClusterClick(c.items); }); state.clusterPool.push(c); }
                c.items = gp.items;
                c.setPos(center); c.setCount(gp.items.length); c.show();
                used++;
            });
            for (var j = used; j < state.clusterPool.length; j++) state.clusterPool[j].hide();
            state.clusters = groups.filter(function (gp) { return gp.items.length > 1; }).map(function (gp) { return gp.items.map(function (x) { return x.p.slug; }); });
        }

        function onClusterClick(items) {
            var g = window.google.maps, b = new g.LatLngBounds();
            var minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
            items.forEach(function (x) {
                b.extend(x.pos);
                minLat = Math.min(minLat, x.pos.lat); maxLat = Math.max(maxLat, x.pos.lat);
                minLng = Math.min(minLng, x.pos.lng); maxLng = Math.max(maxLng, x.pos.lng);
            });
            // Same spot (or fully zoomed in): show them as a paged preview.
            if ((maxLat - minLat < 0.00005 && maxLng - minLng < 0.00005) || state.map.getZoom() >= NO_CLUSTER_ZOOM) {
                openPreview(items.map(function (x) { return x.p; }));
                return;
            }
            state.lastGesture = 0;
            state.map.fitBounds(b, 64);
        }

        // ---- preview (from the real property record) ----
        function renderPreview() {
            var pv = state.preview; if (!pv) return;
            var p = pv.items[pv.index];
            var St = window.AventrixStorage;
            var saved = !!(St && St.wishlist.has(p.slug));
            var listed = !!(St && St.shortlist.has(p.slug));
            var img = p.featured_image || (p.images && p.images[0]) || "images/property1.jpg";
            var href = "property.html?id=" + encodeURIComponent(p.slug);
            var area = areaLine(p);
            els.preview.innerHTML =
                '<button type="button" class="sf-map-preview-close" aria-label="Close preview"><i class="fas fa-times" aria-hidden="true"></i></button>' +
                '<a class="sf-map-preview-img" href="' + href + '" tabindex="-1" aria-hidden="true"><img src="' + esc(img) + '" alt="" loading="lazy"></a>' +
                '<div class="sf-map-preview-body">' +
                    '<h3 class="sf-map-preview-title"><a href="' + href + '">' + esc(p.title) + '</a></h3>' +
                    (p.location ? '<p class="sf-map-preview-loc"><i class="fas fa-map-marker-alt" aria-hidden="true"></i> ' + esc(p.location) + '</p>' : '') +
                    '<p class="sf-map-preview-meta">' + esc(configLine(p)) + (area ? ' · ' + esc(area) : '') + '</p>' +
                    '<div class="sf-map-preview-row">' +
                        '<span class="sf-map-preview-price">' + esc(p.price_display || "Contact for Price") + '</span>' +
                        '<span class="sf-map-preview-actions">' +
                            '<button type="button" class="sf-map-preview-icon sf-map-wish' + (saved ? ' is-on' : '') + '" data-slug="' + esc(p.slug) + '" aria-pressed="' + saved + '" aria-label="' + (saved ? "Remove from Wishlist" : "Save to Wishlist") + '"><i class="' + (saved ? "fas" : "far") + ' fa-heart" aria-hidden="true"></i></button>' +
                            '<button type="button" class="sf-map-preview-icon sf-map-short' + (listed ? ' is-on' : '') + '" data-slug="' + esc(p.slug) + '" aria-pressed="' + listed + '" aria-label="' + (listed ? "Remove from Shortlist" : "Add to Shortlist") + '"><i class="fas fa-bookmark" aria-hidden="true"></i></button>' +
                        '</span>' +
                    '</div>' +
                    '<div class="sf-map-preview-foot">' +
                        '<a class="view-details-btn sf-map-preview-cta" href="' + href + '">View Property</a>' +
                        (pv.items.length > 1
                            ? '<span class="sf-map-preview-pager"><button type="button" class="sf-map-prev" aria-label="Previous property"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>' +
                              '<span>' + (pv.index + 1) + ' / ' + pv.items.length + '</span>' +
                              '<button type="button" class="sf-map-next" aria-label="Next property"><i class="fas fa-chevron-right" aria-hidden="true"></i></button></span>'
                            : '') +
                    '</div>' +
                '</div>';
            els.preview.setAttribute("data-slug", p.slug);
            els.preview.hidden = false;
            updateFloats();
        }
        function openPreview(items) {
            state.preview = { items: items, index: 0 };
            renderPreview();
            // The preview card can occupy the same corner as the "Current
            // Location" control on phones (full-width bottom sheet) — step
            // it (and any status message) aside for as long as the preview
            // is open, per the "do not cover ... property preview" requirement.
            if (els.currentBtn) hide(els.currentBtn, true);
            hideCurrentLocationStatus();
            var close = els.preview.querySelector(".sf-map-preview-close");
            if (close) close.focus({ preventScroll: true });
        }
        function closePreview() {
            state.preview = null;
            els.preview.hidden = true;
            els.preview.innerHTML = "";
            els.preview.removeAttribute("data-slug");
            if (els.currentBtn) hide(els.currentBtn, false);
        }

        els.preview.addEventListener("click", function (e) {
            var St = window.AventrixStorage;
            if (e.target.closest(".sf-map-preview-close")) { closePreview(); updateFloats(); return; }
            if (e.target.closest(".sf-map-prev") && state.preview) { state.preview.index = (state.preview.index - 1 + state.preview.items.length) % state.preview.items.length; renderPreview(); return; }
            if (e.target.closest(".sf-map-next") && state.preview) { state.preview.index = (state.preview.index + 1) % state.preview.items.length; renderPreview(); return; }
            var w = e.target.closest(".sf-map-wish");
            if (w && St) { var on = St.wishlist.toggle(w.getAttribute("data-slug")); if (cfg.syncCard) cfg.syncCard(w.getAttribute("data-slug"), "wishlist", on); renderPreview(); return; }
            var sh = e.target.closest(".sf-map-short");
            if (sh && St) { var on2 = St.shortlist.toggle(sh.getAttribute("data-slug")); if (cfg.syncCard) cfg.syncCard(sh.getAttribute("data-slug"), "shortlist", on2); renderPreview(); }
        });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape" && state.preview) closePreview(); });

        // ---- "Search this area" (only where the page has a search engine) ----
        if (els.areaBtn) {
            els.areaBtn.addEventListener("click", function () {
                if (!state.map || !cfg.areaSearch) return;
                var b = state.map.getBounds(); if (!b) return;
                var ne = b.getNorthEast(), sw = b.getSouthWest();
                closePreview();
                els.areaBtn.hidden = true;
                cfg.areaSearch.set({ north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() });
            });
        }

        // ---- "Current Location" button (Properties Map View only) ----
        // Reuses the existing geolocation session bridge (js/geo-bridge.js —
        // also used by js/near-me.js) instead of calling
        // navigator.geolocation directly, so this never becomes a second,
        // duplicate geolocation system: the browser's native permission
        // prompt still only ever appears once per tab/session either way.
        if (cfg.currentLocation && els.currentBtn) {
            els.currentBtn.addEventListener("click", function () {
                if (!state.map || els.currentBtn.getAttribute("aria-busy") === "true") return;
                if (!window.AventrixGeoBridge) {
                    showCurrentLocationStatus("Location isn't available right now.");
                    return;
                }
                els.currentBtn.setAttribute("aria-busy", "true");
                hideCurrentLocationStatus();
                window.AventrixGeoBridge.request({
                    onGranted: function (lat, lng) {
                        els.currentBtn.removeAttribute("aria-busy");
                        var pos = { lat: lat, lng: lng };
                        // Center + zoom the existing map; never a property
                        // marker, never written back to Supabase or any
                        // other store — held only in this page view (and,
                        // via the shared bridge, this browser tab's
                        // sessionStorage) for as long as the tab is open.
                        // Every click re-centers AND re-zooms to a fixed
                        // close-up level (never "only if currently zoomed
                        // out further"), matching a standard Google Maps
                        // "Your Location" control and making a second click
                        // after moving somewhere else behave identically to
                        // the first.
                        ensureCurrentLocationMarker(pos);
                        state.map.panTo(pos);
                        state.map.setZoom(CURRENT_LOCATION_ZOOM);
                    },
                    onUnavailable: function (message, kind) {
                        els.currentBtn.removeAttribute("aria-busy");
                        var text = kind === "denied"
                            ? "Location access is disabled. Please allow location access to use your current location."
                            : kind === "unsupported"
                                ? "Your browser doesn't support location services."
                                : "Unable to determine your current location. Please try again.";
                        showCurrentLocationStatus(text);
                    }
                }, { forceRefresh: true });
            });
        }

        // ---- floating WhatsApp / Back-to-top zone overlap ----
        function floatsOverlap() {
            if (state.view !== "map" || els.mapView.hidden || els.wrap.hidden) return false;
            var r = els.wrap.getBoundingClientRect();
            if (r.bottom <= 0 || r.top >= window.innerHeight) return false;
            // The fixed buttons occupy the right 110px / bottom 240px of the screen.
            return r.right > window.innerWidth - 110 && r.bottom > window.innerHeight - 240;
        }

        var inst = {
            name: cfg.name,
            floatsOverlap: floatsOverlap,
            onMapsFailed: function () { if (state.view === "map") showFallback(); },
            snapshot: function () {
                return {
                    view: state.view, mapsStatus: Maps.status, mapped: state.mapped.map(function (x) { return x.p.slug; }),
                    results: state.results.map(function (p) { return p.slug; }),
                    clusters: state.clusters, fittedFor: state.fittedFor,
                    preview: state.preview ? state.preview.items.map(function (p) { return p.slug; }) : null,
                    advanced: state.useAdvanced
                };
            }
        };

        // Start: pick up results already published, restore this tab's last view.
        var init = cfg.initial && cfg.initial();
        if (init) { state.results = init.properties || []; state.status = init.status || "ok"; }
        var initial = "list";
        try { initial = sessionStorage.getItem(cfg.viewKey) === "map" ? "map" : "list"; } catch (e) {}
        Instances.push(inst);
        setView(initial, false);
        return inst;
    }

    // Floating buttons step aside while they'd cover any open map.
    var ticking = false;
    function updateFloats() {
        ticking = false;
        document.body.classList.toggle("sf-map-floats-aside", Instances.some(function (i) { return i.floatsOverlap(); }));
    }
    function queue() { if (!ticking) { ticking = true; requestAnimationFrame(updateFloats); } }
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);

    var api = {
        coordsOf: coordsOf,
        instances: {},
        // Test hook (read-only): the Properties page instance by default.
        snapshot: function (name) {
            var i = api.instances[name || "properties"] || Instances[0];
            return i ? i.snapshot() : null;
        }
    };
    window.AventrixPropertyMap = api;

    // ------------------------------------------------------------
    // Instances
    // ------------------------------------------------------------
    // Properties page — results + filters + "Search this area" from properties-search.js
    var sfGrid = document.getElementById("sfResultsGrid");
    if (sfGrid) {
        var S = window.AventrixSearch || {};
        var props = createInstance({
            name: "properties", prefix: "sf", grid: sfGrid, viewKey: "aventrix:propertiesView",
            event: "aventrix:search-results",
            currentLocation: true,
            initial: function () { return window.AventrixSearchResults || null; },
            areaSearch: S.setMapArea ? { get: S.getMapArea, set: S.setMapArea } : null,
            messages: {
                // Zero results for the current search/filters, and zero of
                // today's results having coordinates, are shown with the
                // same small, non-blocking note — the map itself (Chennai by
                // default) stays fully visible and interactive either way.
                empty: "No properties in this area yet.",
                none: function () { return "No properties in this area yet."; },
                some: function (on, total) { return "Showing " + on + " of " + total + " properties on the map. Some properties are not currently available on the map — see List View."; },
                area: function (on) { return "Showing " + on + (on === 1 ? " property" : " properties") + " in this map area."; },
                emptyViewport: "No properties in this area yet."
            },
            syncCard: function (slug, kind, on) {
                var sel = kind === "wishlist" ? ".property-save-btn" : ".icon-shortlist-btn";
                var btn = sfGrid.querySelector(sel + '[data-slug="' + (window.CSS && CSS.escape ? CSS.escape(slug) : slug) + '"]');
                if (!btn) return;
                btn.classList.toggle(kind === "wishlist" ? "saved" : "active", on);
                btn.setAttribute("aria-pressed", on ? "true" : "false");
                if (kind === "wishlist") {
                    btn.setAttribute("aria-label", on ? "Remove from Wishlist" : "Save to Wishlist");
                    var i = btn.querySelector("i"); if (i) { i.classList.toggle("fas", on); i.classList.toggle("far", !on); }
                } else {
                    btn.setAttribute("aria-label", on ? "Remove from Shortlist" : "Add to Shortlist");
                    btn.setAttribute("title", on ? "Shortlisted" : "Add to Shortlist");
                }
            }
        });
        if (props) api.instances.properties = props;
    }

    // Homepage — the existing Future Properties records (js/home-app-experience.js)
    var hpGrid = document.getElementById("futurePropertiesGrid");
    if (hpGrid) {
        var home = createInstance({
            name: "home", prefix: "hp", grid: hpGrid, viewKey: "aventrix:homeView",
            event: "aventrix:home-properties",
            // Same Current Location control as the Properties page — same
            // code path (shared AventrixGeoBridge, forceRefresh, zoom 16,
            // blue dot), bound to this instance's own hp* elements and map.
            currentLocation: true,
            initial: function () { return window.AventrixHomeResults || null; },
            areaSearch: null,
            messages: {
                empty: "No properties available right now — please check back soon.",
                none: function () { return "No properties in this area yet."; },
                some: function (on, total) { return "Showing " + on + " of " + total + " properties on the map."; },
                emptyViewport: "No properties in this area yet."
            },
            syncCard: function (slug, kind, on) {
                if (kind !== "wishlist") return; // homepage cards have no shortlist button
                var btn = hpGrid.querySelector('.home-app-card-heart[data-slug="' + (window.CSS && CSS.escape ? CSS.escape(slug) : slug) + '"]');
                if (!btn) return;
                btn.classList.toggle("saved", on);
                var i = btn.querySelector("i"); if (i) i.className = on ? "fas fa-heart" : "far fa-heart";
                btn.setAttribute("aria-label", on ? "Remove from Wishlist" : "Save to Wishlist");
            }
        });
        if (home) api.instances.home = home;
    }
})();
