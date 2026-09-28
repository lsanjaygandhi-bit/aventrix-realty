/*
 * AVENTRIX REALTY — PROPERTY LOCATION PICKER (shared)
 * -----------------------------------------------------
 * One small, reusable "mark this property on the map" widget, used in
 * two places:
 *   - list-with-us.html  (Post Property / List Your Property — the
 *     customer places their own property's marker)
 *   - admin/dashboard.html (Admin → Properties — staff can view,
 *     search, move or click to change a property's marker)
 *
 * Uses the SAME Google Maps JavaScript API + js/maps-config.js key as
 * js/properties-map.js (Properties/Homepage Map View) — this is a
 * second small map instance for picking one point, not a second Map
 * View implementation. Nothing here is guessed: the marker only
 * appears once the visitor clicks the map (or drags the pin), or an
 * existing saved location is passed in — never a default/random
 * position. Address search only moves the map to the approximate area;
 * it never sets the coordinates itself.
 *
 * Usage:
 *   AventrixLocationPicker.attach({
 *       mapEl, searchInputEl, latInputEl, lngInputEl,
 *       statusEl,                 // optional: shows "Location selected / Lat / Lng"
 *       confirmBtnEl,             // optional: "Use This Location" button
 *       initial: {lat, lng} | null,
 *       onChange: function (lat, lng) {}   // lat/lng are null when cleared
 *   })
 *   -> { setLocation(lat, lng), getLocation(), clear() }
 */
(function () {
    "use strict";

    var CHENNAI_CENTER = { lat: 13.0827, lng: 80.2707 };
    var DEFAULT_ZOOM = 11;
    var PICKED_ZOOM = 16;

    var Maps = { status: "idle", waiters: [] }; // idle | loading | ready | failed
    function settle(status) { Maps.status = status; var w = Maps.waiters; Maps.waiters = []; w.forEach(function (fn) { fn(status); }); }
    function loadGoogleMaps(done) {
        if (Maps.status === "ready" || Maps.status === "failed") { done(Maps.status); return; }
        Maps.waiters.push(done);
        if (Maps.status === "loading") return;
        if (window.google && window.google.maps && window.google.maps.Map) { settle("ready"); return; }
        var cfg = window.AVENTRIX_MAPS_CONFIG || {};
        var key = String(cfg.apiKey || "").trim();
        if (!key) { settle("failed"); return; }
        Maps.status = "loading";
        var finished = false;
        var timer = setTimeout(function () { if (!finished) { finished = true; settle("failed"); } }, 15000);
        window.__aventrixLocationPickerReady = function () {
            if (finished) return; finished = true; clearTimeout(timer);
            settle(window.google && window.google.maps && window.google.maps.Map ? "ready" : "failed");
        };
        var prevAuthFailure = window.gm_authFailure;
        window.gm_authFailure = function () {
            if (!finished) { finished = true; clearTimeout(timer); settle("failed"); }
            if (typeof prevAuthFailure === "function") prevAuthFailure();
        };
        var s = document.createElement("script");
        s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) +
            "&v=weekly&loading=async&callback=__aventrixLocationPickerReady";
        s.async = true;
        s.onerror = function () { if (!finished) { finished = true; clearTimeout(timer); settle("failed"); } };
        document.head.appendChild(s);
    }

    function validCoords(lat, lng) {
        return isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
    }

    function attach(opts) {
        var mapEl = opts.mapEl, searchEl = opts.searchInputEl, latEl = opts.latInputEl, lngEl = opts.lngInputEl,
            statusEl = opts.statusEl, confirmBtn = opts.confirmBtnEl, onChange = opts.onChange || function () {};

        var state = { map: null, marker: null, lat: null, lng: null, geocoder: null };

        function say(text, isError) {
            if (!statusEl) return;
            if (!text) { statusEl.hidden = true; statusEl.textContent = ""; return; }
            statusEl.hidden = false;
            statusEl.classList.toggle("location-picker-error", !!isError);
            statusEl.innerHTML = text;
        }

        function fmt(n) { return Math.round(n * 1e6) / 1e6; }

        function updateStatusForSelection() {
            if (state.lat == null) { say(""); return; }
            say("<strong>Location selected</strong><br>Latitude: " + fmt(state.lat) + " &nbsp; Longitude: " + fmt(state.lng));
        }

        function setLocation(lat, lng, opts2) {
            opts2 = opts2 || {};
            if (lat == null || lng == null) {
                state.lat = null; state.lng = null;
                if (latEl) latEl.value = "";
                if (lngEl) lngEl.value = "";
                if (state.marker) state.marker.setMap(null);
                state.marker = null;
                updateStatusForSelection();
                if (!opts2.silent) onChange(null, null);
                return;
            }
            if (!validCoords(lat, lng)) return;
            state.lat = fmt(lat); state.lng = fmt(lng);
            if (latEl) latEl.value = state.lat;
            if (lngEl) lngEl.value = state.lng;
            if (state.map) {
                var pos = { lat: state.lat, lng: state.lng };
                if (!state.marker) {
                    state.marker = new window.google.maps.Marker({ position: pos, map: state.map, draggable: true, title: "Selected Property Location" });
                    state.marker.addListener("dragend", function () {
                        var p = state.marker.getPosition();
                        setLocation(p.lat(), p.lng());
                    });
                } else {
                    state.marker.setPosition(pos);
                }
                if (!opts2.keepView) { state.map.setCenter(pos); state.map.setZoom(Math.max(state.map.getZoom(), PICKED_ZOOM)); }
            }
            updateStatusForSelection();
            if (!opts2.silent) onChange(state.lat, state.lng);
        }

        function ensureMap() {
            if (state.map || !mapEl) return;
            var g = window.google.maps;
            state.map = new g.Map(mapEl, {
                center: opts.initial ? { lat: opts.initial.lat, lng: opts.initial.lng } : CHENNAI_CENTER,
                zoom: opts.initial ? PICKED_ZOOM : DEFAULT_ZOOM,
                gestureHandling: "greedy", clickableIcons: false,
                mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
                zoomControl: true
            });
            state.geocoder = new g.Geocoder();
            state.map.addListener("click", function (e) { setLocation(e.latLng.lat(), e.latLng.lng()); });
            if (opts.initial && validCoords(opts.initial.lat, opts.initial.lng)) {
                setLocation(opts.initial.lat, opts.initial.lng, { silent: true, keepView: true });
            } else if (state.lat != null) {
                // A saved location was set (e.g. Admin opened a property to edit)
                // before Google Maps finished loading: now draw its pin and open
                // the map on that exact spot.
                setLocation(state.lat, state.lng, { silent: true });
            }
        }

        // Google's reason for a failed search, in words the Admin/visitor can act
        // on. REQUEST_DENIED almost always means the Maps key isn't allowed to
        // use the Geocoding API (Google Cloud Console → enable "Geocoding API"
        // and add it to the key's API restrictions) — previously every such
        // failure was reported as "couldn't find", which hid the real cause.
        function searchFailure(status) {
            if (status === "ZERO_RESULTS") return "Couldn't find that location. Try a more specific address, or click the map directly.";
            if (status === "REQUEST_DENIED") return "Location search isn't available right now (Google declined the search request). You can still click the map directly to mark the exact spot.";
            if (status === "OVER_QUERY_LIMIT") return "Too many searches just now. Please wait a moment and try again, or click the map directly.";
            return "Location search didn't respond. Please try again, or click the map directly.";
        }

        function geocode(query) {
            if (!query || !state.geocoder) return;
            say("Searching…");
            var req = { address: query, region: "in", componentRestrictions: { country: "IN" } };
            // Prefer places near the area currently on screen (Chennai by default).
            // This is only a bias from the live map view — no fixed coordinates.
            var view = state.map && state.map.getBounds && state.map.getBounds();
            if (view) req.bounds = view;
            var handled = false;
            function done(results, status) {
                if (handled) return; handled = true;
                if (status !== "OK" || !results || !results.length) {
                    if (window.console && status !== "ZERO_RESULTS") console.warn("Location search failed:", status);
                    say(searchFailure(status), true);
                    return;
                }
                // Search only finds the APPROXIMATE AREA: the map moves there, but
                // no pin is dropped and no latitude/longitude is filled in. A
                // geocoded point (such as a locality's centre) must never become
                // a property's saved location — only an explicit map click or
                // marker drag sets the coordinates (see setLocation). An
                // already-selected pin is left exactly where it is.
                var geo = results[0].geometry;
                if (state.map) {
                    if (geo.viewport && state.map.fitBounds) {
                        state.map.fitBounds(geo.viewport);
                    } else {
                        state.map.setCenter(geo.location);
                        state.map.setZoom(PICKED_ZOOM);
                    }
                }
                say(state.lat == null
                    ? "<strong>Area found.</strong> Now select the exact property location on the map — click the exact spot."
                    : "<strong>Area found.</strong> Click the exact spot or drag the pin to change the selected location.<br>Latitude: " + fmt(state.lat) + " &nbsp; Longitude: " + fmt(state.lng));
            }
            try {
                var pending = state.geocoder.geocode(req, done);
                // Newer Maps versions also return a Promise that rejects on failure;
                // the callback above already reported it, so just keep the console clean.
                if (pending && typeof pending.catch === "function") pending.catch(function (err) { done(null, (err && err.code) || "ERROR"); });
            } catch (err) {
                done(null, "ERROR");
            }
        }

        if (searchEl) {
            searchEl.addEventListener("keydown", function (e) {
                if (e.key === "Enter") { e.preventDefault(); geocode(searchEl.value.trim()); }
            });
            var searchBtn = opts.searchBtnEl;
            if (searchBtn) searchBtn.addEventListener("click", function () { geocode(searchEl.value.trim()); });
        }
        if (confirmBtn) {
            confirmBtn.addEventListener("click", function () {
                if (state.lat == null) { say("Please click the exact property location on the map first (search only finds the area).", true); return; }
                say("<strong>Location selected</strong><br>Latitude: " + fmt(state.lat) + " &nbsp; Longitude: " + fmt(state.lng));
            });
        }
        // Manual lat/lng edits (typed or pasted directly into the boxes,
        // e.g. Admin's existing "paste from Google Maps" convention) keep
        // the map/marker in sync.
        function onManualEdit() {
            var lat = parseFloat(latEl.value), lng = parseFloat(lngEl.value);
            if (latEl.value.trim() === "" && lngEl.value.trim() === "") { setLocation(null, null, { silent: true }); return; }
            if (validCoords(lat, lng)) setLocation(lat, lng, { silent: true });
        }
        if (latEl) latEl.addEventListener("change", onManualEdit);
        if (lngEl) lngEl.addEventListener("change", onManualEdit);

        if (mapEl) {
            loadGoogleMaps(function (status) {
                if (status !== "ready") { say("Map couldn't load right now. You can still enter coordinates manually if you have them.", true); return; }
                ensureMap();
            });
        }

        return {
            setLocation: function (lat, lng) { setLocation(lat, lng); },
            getLocation: function () { return state.lat == null ? null : { lat: state.lat, lng: state.lng }; },
            clear: function () { setLocation(null, null); },
            // Call after the map's container becomes visible (e.g. a modal
            // that was `display:none` when the map was first constructed —
            // Google Maps cannot size itself correctly against a
            // zero-size container until told to re-check).
            invalidateSize: function () {
                if (!state.map || !window.google) return;
                window.google.maps.event.trigger(state.map, "resize");
                var pos = state.lat != null ? { lat: state.lat, lng: state.lng } : (opts.initial || CHENNAI_CENTER);
                state.map.setCenter(pos);
            }
        };
    }

    window.AventrixLocationPicker = { attach: attach };
})();
