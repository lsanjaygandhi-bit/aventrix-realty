/* Local test double for the Google Maps JavaScript API (subset used by
   js/properties-map.js). Real Web-Mercator projection so fitBounds, bounds
   and clustering behave like the real map. Test only — never shipped. */
(function () {
    var params = new URLSearchParams((document.currentScript && document.currentScript.src.split("?")[1]) || "");
    var cb = params.get("callback"), key = params.get("key");
    window.__mockMaps = { loads: (window.__mockMaps ? window.__mockMaps.loads : 0) + 1, maps: [], key: key, libraries: params.get("libraries") };

    function toLL(p) { return p instanceof LatLng ? p : new LatLng(typeof p.lat === "function" ? p.lat() : p.lat, typeof p.lng === "function" ? p.lng() : p.lng); }
    function LatLng(lat, lng) { this._lat = +lat; this._lng = +lng; }
    LatLng.prototype.lat = function () { return this._lat; };
    LatLng.prototype.lng = function () { return this._lng; };
    LatLng.prototype.toJSON = function () { return { lat: this._lat, lng: this._lng }; };

    function LatLngBounds(sw, ne) { this.s = 90; this.n = -90; this.w = 180; this.e = -180; if (sw) this.extend(sw); if (ne) this.extend(ne); }
    LatLngBounds.prototype.extend = function (p) { p = toLL(p); this.s = Math.min(this.s, p.lat()); this.n = Math.max(this.n, p.lat()); this.w = Math.min(this.w, p.lng()); this.e = Math.max(this.e, p.lng()); return this; };
    LatLngBounds.prototype.isEmpty = function () { return this.s > this.n; };
    LatLngBounds.prototype.getNorthEast = function () { return new LatLng(this.n, this.e); };
    LatLngBounds.prototype.getSouthWest = function () { return new LatLng(this.s, this.w); };
    LatLngBounds.prototype.contains = function (p) { p = toLL(p); return p.lat() >= this.s && p.lat() <= this.n && p.lng() >= this.w && p.lng() <= this.e; };

    function world(ll, z) {
        var scale = 256 * Math.pow(2, z), siny = Math.min(Math.max(Math.sin(ll.lat() * Math.PI / 180), -0.9999), 0.9999);
        return { x: scale * (0.5 + ll.lng() / 360), y: scale * (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)) };
    }
    function unworld(x, y, z) {
        var scale = 256 * Math.pow(2, z), lng = (x / scale - 0.5) * 360;
        var n = Math.PI - 2 * Math.PI * y / scale, lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
        return new LatLng(lat, lng);
    }

    function Evented() { this._l = {}; }
    Evented.prototype.addListener = function (n, f) { var l = (this._l[n] = this._l[n] || []); l.push(f); return { remove: function () { var i = l.indexOf(f); if (i >= 0) l.splice(i, 1); } }; };
    Evented.prototype._fire = function (n, a) { (this._l[n] || []).slice().forEach(function (f) { f(a); }); };

    function Map(div, opts) {
        Evented.call(this);
        this.div = div; this.opts = opts || {}; this.center = toLL(opts.center); this.zoom = opts.zoom;
        this.mapTypeId = opts.mapTypeId || "roadmap";
        div.style.overflow = "hidden";
        this.layer = document.createElement("div"); this.layer.className = "mock-map-layer";
        this.layer.style.cssText = "position:absolute;inset:0;background:#dfe7dc";
        div.appendChild(this.layer);
        var self = this;
        // Real Google Maps fires a "click" event with the clicked point's
        // latLng; reproduce that here from the click's pixel offset so
        // code under test (e.g. js/property-location-picker.js) can be
        // exercised the same way it behaves against the real API.
        this.layer.addEventListener("click", function (e) {
            var rect = self.layer.getBoundingClientRect();
            var s = self.size(), c = world(self.center, self.zoom);
            var x = c.x - s.w / 2 + (e.clientX - rect.left);
            var y = c.y - s.h / 2 + (e.clientY - rect.top);
            self._fire("click", { latLng: unworld(x, y, self.zoom) });
        });
        var ctl = document.createElement("div"); ctl.className = "mock-zoom-controls";
        ctl.style.cssText = "position:absolute;top:10px;right:10px;z-index:2;display:flex;flex-direction:column;gap:2px";
        ["+", "-"].forEach(function (s) {
            var b = document.createElement("button"); b.type = "button"; b.textContent = s; b.className = "mock-zoom-" + (s === "+" ? "in" : "out");
            b.style.cssText = "width:40px;height:40px;background:#fff;border:0;font-size:20px";
            b.addEventListener("click", function () { self.setZoom(self.zoom + (s === "+" ? 1 : -1)); });
            ctl.appendChild(b);
        });
        div.appendChild(ctl);
        if (opts.mapTypeControl) {
            var mtc = document.createElement("select");
            mtc.className = "mock-maptype-control";
            (opts.mapTypeControlOptions && opts.mapTypeControlOptions.mapTypeIds || ["roadmap", "satellite"]).forEach(function (id) {
                var o = document.createElement("option"); o.value = id; o.textContent = id; mtc.appendChild(o);
            });
            mtc.value = this.mapTypeId;
            mtc.style.cssText = "position:absolute;top:10px;left:10px;z-index:2;height:32px;background:#fff;border:1px solid #ccc";
            mtc.addEventListener("change", function () { self.setMapTypeId(mtc.value); });
            div.appendChild(mtc);
            this._mtc = mtc;
        }
        var attr = document.createElement("div"); attr.className = "mock-attribution"; attr.textContent = "Map data ©2026 Google (test double)";
        attr.style.cssText = "position:absolute;right:0;bottom:0;font-size:10px;background:rgba(255,255,255,.7);padding:0 4px;z-index:1";
        div.appendChild(attr);
        this.markers = [];
        window.__mockMaps.maps.push(this);
        this._schedule();
    }
    Map.prototype = Object.create(Evented.prototype);
    Map.prototype.size = function () { return { w: this.div.clientWidth || 600, h: this.div.clientHeight || 400 }; };
    Map.prototype.getZoom = function () { return this.zoom; };
    Map.prototype.getMapTypeId = function () { return this.mapTypeId; };
    Map.prototype.setMapTypeId = function (id) { this.mapTypeId = id; this.div.classList.toggle("mock-map-satellite", id === "satellite" || id === "hybrid"); if (this._mtc) this._mtc.value = id; this._fire("maptypeid_changed"); };
    Map.prototype.getCenter = function () { return this.center; };
    Map.prototype.setZoom = function (z) { z = Math.max(1, Math.min(21, Math.round(z))); if (z !== this.zoom) { this.zoom = z; this._fire("zoom_changed"); } this._schedule(); };
    Map.prototype.setCenter = function (c) { this.center = toLL(c); this._fire("center_changed"); this._schedule(); };
    Map.prototype.panTo = Map.prototype.setCenter;
    Map.prototype.getBounds = function () {
        var s = this.size(), c = world(this.center, this.zoom);
        return new LatLngBounds(unworld(c.x - s.w / 2, c.y + s.h / 2, this.zoom), unworld(c.x + s.w / 2, c.y - s.h / 2, this.zoom));
    };
    Map.prototype.fitBounds = function (b, pad) {
        pad = typeof pad === "number" ? pad : 0;
        var s = this.size(), sw = b.getSouthWest(), ne = b.getNorthEast(), z;
        for (z = 21; z > 1; z--) {
            var a = world(sw, z), c = world(ne, z);
            if (Math.abs(c.x - a.x) <= s.w - 2 * pad && Math.abs(a.y - c.y) <= s.h - 2 * pad) break;
        }
        this.center = new LatLng((sw.lat() + ne.lat()) / 2, (sw.lng() + ne.lng()) / 2);
        this.__lastFit = { s: sw.lat(), w: sw.lng(), n: ne.lat(), e: ne.lng(), pad: pad };
        if (z !== this.zoom) { this.zoom = z; this._fire("zoom_changed"); }
        this._schedule();
    };
    // Test helper: behave like the visitor dragging the map.
    Map.prototype.__dragBy = function (dx, dy) {
        this._fire("dragstart");
        var c = world(this.center, this.zoom);
        this.center = unworld(c.x + dx, c.y + dy, this.zoom);
        this._fire("dragend"); this._schedule();
    };
    Map.prototype._schedule = function () {
        var self = this; clearTimeout(this._t);
        this._t = setTimeout(function () { self._render(); self._fire("idle"); }, 30);
    };
    Map.prototype._render = function () {
        var self = this, s = this.size(), c = world(this.center, this.zoom);
        this.markers.forEach(function (m) {
            var p = world(m._pos, self.zoom);
            m._el.style.left = (p.x - c.x + s.w / 2) + "px";
            m._el.style.top = (p.y - c.y + s.h / 2) + "px";
        });
    };
    Map.prototype._add = function (m) { if (this.markers.indexOf(m) < 0) { this.markers.push(m); this.layer.appendChild(m._el); this._render(); } };
    Map.prototype._remove = function (m) { var i = this.markers.indexOf(m); if (i >= 0) { this.markers.splice(i, 1); m._el.remove(); } };

    function Marker(o) {
        Evented.call(this);
        this._pos = toLL(o.position); this._title = o.title || ""; this._icon = o.icon; this._label = null;
        var el = this._el = document.createElement("div");
        el.className = "mock-marker"; el.style.cssText = "position:absolute;width:30px;height:40px;transform:translate(-50%,-100%);cursor:pointer;z-index:1";
        var self = this;
        el.addEventListener("click", function (e) { e.stopPropagation(); self._fire("click"); });
        this._sync();
        if (o.map) this.setMap(o.map);
    }
    Marker.prototype = Object.create(Evented.prototype);
    Marker.prototype._sync = function () {
        this._el.setAttribute("title", this._title); this._el.setAttribute("data-title", this._title);
        this._el.setAttribute("data-kind", this._label ? "cluster" : "pin");
        this._el.setAttribute("data-label", this._label ? this._label.text : "");
        this._el.textContent = this._label ? this._label.text : "";
        this._el.style.background = this._label ? "#0F3B2E" : "#0F3B2E"; this._el.style.color = "#fff"; this._el.style.borderRadius = this._label ? "50%" : "50% 50% 50% 0";
        if (this._label) { this._el.style.transform = "translate(-50%,-50%)"; this._el.style.width = this._el.style.height = "40px"; this._el.style.lineHeight = "40px"; this._el.style.textAlign = "center"; }
    };
    Marker.prototype.setMap = function (m) { if (this._map) this._map._remove(this); this._map = m; if (m) m._add(this); };
    Marker.prototype.getMap = function () { return this._map || null; };
    Marker.prototype.setPosition = function (p) { this._pos = toLL(p); if (this._map) this._map._render(); };
    Marker.prototype.getPosition = function () { return this._pos; };
    Marker.prototype.setIcon = function (i) { this._icon = i; };
    Marker.prototype.setLabel = function (l) { this._label = l; this._sync(); };
    Marker.prototype.setTitle = function (t) { this._title = t; this._sync(); };

    function AdvancedMarkerElement(o) {
        Evented.call(this);
        var self = this;
        this._pos = toLL(o.position); this.title = o.title || "";
        this._el = document.createElement("div"); this._el.className = "mock-adv-marker";
        this._el.style.cssText = "position:absolute;transform:translate(-50%,-100%);cursor:pointer;z-index:1";
        if (o.content) this._el.appendChild(o.content);
        this._el.addEventListener("click", function (e) { e.stopPropagation(); self._fire("click"); self._fire("gmp-click"); });
        Object.defineProperty(this, "map", { get: function () { return self._map || null; }, set: function (m) { if (self._map) self._map._remove(self); self._map = m; if (m) m._add(self); } });
        Object.defineProperty(this, "position", { get: function () { return self._pos; }, set: function (p) { self._pos = toLL(p); if (self._map) self._map._render(); } });
        if (o.map) this.map = o.map;
    }
    AdvancedMarkerElement.prototype = Object.create(Evented.prototype);

    // Test-controlled Geocoder: set window.__mockGeocodeResults = { "some address": {lat, lng} }
    // before searching. An address not in the map resolves with ZERO_RESULTS,
    // matching the real API's behaviour for a location it can't find.
    function Geocoder() {}
    Geocoder.prototype.geocode = function (req, cb) {
        var table = window.__mockGeocodeResults || {};
        var hit = table[(req.address || "").trim()];
        setTimeout(function () {
            if (!hit) { cb([], "ZERO_RESULTS"); return; }
            cb([{ geometry: { location: new LatLng(hit.lat, hit.lng) } }], "OK");
        }, 10);
    };

    window.google = window.google || {};
    window.google.maps = {
        Map: Map, Marker: Marker, LatLng: LatLng, LatLngBounds: LatLngBounds, Geocoder: Geocoder,
        Size: function (w, h) { this.width = w; this.height = h; },
        Point: function (x, y) { this.x = x; this.y = y; },
        ControlPosition: { RIGHT_TOP: 3, RIGHT_BOTTOM: 12, TOP_CENTER: 2, TOP_LEFT: 1 },
        MapTypeControlStyle: { DEFAULT: 0, HORIZONTAL_BAR: 1, DROPDOWN_MENU: 2 },
        MapTypeId: { ROADMAP: "roadmap", SATELLITE: "satellite", HYBRID: "hybrid", TERRAIN: "terrain" },
        marker: { AdvancedMarkerElement: AdvancedMarkerElement },
        event: {
            addListener: function (o, n, f) { return o.addListener(n, f); },
            trigger: function (o, n, a) { o._fire(n, a); }
        }
    };
    if (key === "INVALID") {
        // Real API: loads, then calls gm_authFailure after the key check fails.
        setTimeout(function () { if (cb && window[cb]) window[cb](); setTimeout(function () { if (window.gm_authFailure) window.gm_authFailure(); }, 150); }, 20);
    } else if (key === "HANG") {
        // never calls back (tests the timeout)
    } else {
        setTimeout(function () { if (cb && window[cb]) window[cb](); }, 20);
    }
})();
