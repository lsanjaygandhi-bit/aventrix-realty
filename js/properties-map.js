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
    var CLUSTER_RADIUS_PX = 46;
    var NO_CLUSTER_ZOOM = 18;
    // Default map center when no property has coordinates yet. Only used to
    // point the camera somewhere sensible — never attached to a property or
    // rendered as a marker/pin.
    var CHENNAI_CENTER = { lat: 13.0827, lng: 80.2707 };
    var NO_MARKERS_ZOOM = 11;

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
    var PIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.9 15 40 15 40s15-14.1 15-25.2C30 6.6 23.3 0 15 0z" fill="#0F3B2E"/><circle cx="15" cy="14.5" r="6" fill="#D4AF37"/></svg>';
    function clusterSvg(n) {
        var r = n < 10 ? 18 : n < 100 ? 21 : 25, d = r * 2 + 6;
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + d + '" height="' + d + '" viewBox="0 0 ' + d + ' ' + d + '">' +
            '<circle cx="' + d / 2 + '" cy="' + d / 2 + '" r="' + (r + 3) + '" fill="#D4AF37" fill-opacity=".45"/>' +
            '<circle cx="' + d / 2 + '" cy="' + d / 2 + '" r="' + r + '" fill="#0F3B2E"/></svg>';
    }
    function svgUrl(svg) { return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg); }
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
            areaBtn: $("MapAreaBtn"), preview: $("MapPreview"), loading: $("MapLoading")
        };
        var grid = cfg.grid;
        if (!grid || !els.listBtn || !els.mapBtn || !els.mapView || !els.wrap || !els.canvas || !els.preview) return null;
        function hide(el, h) { if (el) el.hidden = h; }

        var state = {
            view: "list", results: [], status: "loading",
            map: null, useAdvanced: false,
            markers: {}, clusterPool: [], mapped: [], clusters: [],
            lastGesture: 0, fittedFor: null, preview: null
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

        function updateNote(list) {
            var total = state.results.length, onMap = list.length, missing = total - onMap, m = cfg.messages;
            var area = cfg.areaSearch && cfg.areaSearch.get();
            var msg = "";
            if (state.status === "loading") msg = "";
            else if (state.status === "error" || total === 0) msg = m.empty || "";
            else if (onMap === 0) msg = m.none(total);
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
        // Two states the map must NOT confuse:
        //   - Google Maps genuinely failed to load (bad/missing key, network,
        //     timeout, gm_authFailure) -> showFallback(): no canvas, "Map view
        //     is temporarily unavailable."
        //   - Google Maps is fine but none of today's properties have their
        //     own coordinates yet -> the map itself still renders (centered on
        //     Chennai), just with zero markers and the "no locations yet" note.
        function refresh(fromArea) {
            var list = mappable();
            updateNote(list);
            if (state.status === "loading") return;
            if (Maps.status === "failed") { showFallback(); return; }
            if (state.status === "error" || !state.results.length) {
                // Either the property data failed to load, or there are no
                // properties at all for the current search/filters (the
                // page's own empty state already covers that). Neither case
                // has anything to center a map on, and neither is a Maps API
                // failure, so this stays visually distinct from showFallback().
                els.wrap.hidden = true; els.fallback.hidden = true; hide(els.areaBtn, true);
                closePreview();
                if (state.map) syncMarkers([]); else state.mapped = [];
                return;
            }
            // At least one property exists for this search — the map always
            // renders from here on, even if none of them have coordinates yet.
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
                gestureHandling: "greedy", clickableIcons: false,
                mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
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
            });
            state.map.addListener("dragstart", function () { state.lastGesture = Date.now(); });
            state.map.addListener("click", closePreview);
            return true;
        }

        function fitTo(list) {
            var g = window.google.maps;
            state.lastGesture = 0;
            hide(els.areaBtn, true);
            if (list.length === 1) { state.map.setCenter(list[0].pos); state.map.setZoom(15); return; }
            var b = new g.LatLngBounds();
            list.forEach(function (x) { b.extend(x.pos); });
            state.map.fitBounds(b, 56);
        }

        // ---- markers (one per property, created once) + clustering ----
        function makeMarker(kind, pos, title, onClick) {
            var g = window.google.maps;
            if (state.useAdvanced) {
                var el = document.createElement("div");
                el.className = kind === "cluster" ? "sf-map-cluster" : "sf-map-pin";
                if (kind !== "cluster") el.innerHTML = PIN_SVG;
                var am = new g.marker.AdvancedMarkerElement({ position: pos, content: el, title: title || "", gmpClickable: true });
                var last = 0, once = function () { var t = Date.now(); if (t - last > 300) { last = t; onClick(); } };
                am.addListener("click", once);
                try { am.addListener("gmp-click", once); } catch (e) {}
                return {
                    show: function () { if (am.map !== state.map) am.map = state.map; },
                    hide: function () { if (am.map) am.map = null; },
                    setPos: function (p) { am.position = p; },
                    setCount: function (n) { el.textContent = String(n); el.setAttribute("data-count", n); am.title = n + " properties"; }
                };
            }
            var mk = new g.Marker({
                position: pos, title: title || "", optimized: true,
                icon: kind === "cluster" ? undefined : { url: svgUrl(PIN_SVG), scaledSize: new g.Size(30, 40), anchor: new g.Point(15, 40) }
            });
            mk.addListener("click", onClick);
            var onMap = false;
            return {
                show: function () { if (!onMap) { mk.setMap(state.map); onMap = true; } },
                hide: function () { if (onMap) { mk.setMap(null); onMap = false; } },
                setPos: function (p) { mk.setPosition(p); },
                setCount: function (n) {
                    var svg = clusterSvg(n), d = +svg.match(/width="(\d+)"/)[1];
                    mk.setIcon({ url: svgUrl(svg), scaledSize: new g.Size(d, d), anchor: new g.Point(d / 2, d / 2) });
                    mk.setLabel({ text: String(n), color: "#ffffff", fontSize: "13px", fontWeight: "700" });
                    mk.setTitle(n + " properties");
                }
            };
        }

        function syncMarkers(list) {
            state.mapped = list;
            var keep = {};
            list.forEach(function (x) {
                var slug = x.p.slug;
                keep[slug] = true;
                if (!state.markers[slug]) state.markers[slug] = makeMarker("pin", x.pos, x.p.title, function () { openPreview([state.markers[slug].data.p]); });
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
                        '<a class="view-details-btn sf-map-preview-cta" href="' + href + '">View Details</a>' +
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
            var close = els.preview.querySelector(".sf-map-preview-close");
            if (close) close.focus({ preventScroll: true });
        }
        function closePreview() {
            state.preview = null;
            els.preview.hidden = true;
            els.preview.innerHTML = "";
            els.preview.removeAttribute("data-slug");
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
            initial: function () { return window.AventrixSearchResults || null; },
            areaSearch: S.setMapArea ? { get: S.getMapArea, set: S.setMapArea } : null,
            messages: {
                none: function (total) { return total === 1
                    ? "This property doesn't have a map location yet. Use List View to see it."
                    : "These " + total + " properties don't have a map location yet. Use List View to see them."; },
                some: function (on, total) { return "Showing " + on + " of " + total + " properties on the map. Some properties are not currently available on the map — see List View."; },
                area: function (on) { return "Showing " + on + (on === 1 ? " property" : " properties") + " in this map area."; }
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
            initial: function () { return window.AventrixHomeResults || null; },
            areaSearch: null,
            messages: {
                empty: "No properties available right now — please check back soon.",
                none: function () { return "Map locations will appear as properties are added to the map."; },
                some: function (on, total) { return "Showing " + on + " of " + total + " properties on the map."; }
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
