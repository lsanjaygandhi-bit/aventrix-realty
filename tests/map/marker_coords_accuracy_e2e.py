#!/usr/bin/env python3
"""
PROPERTIES MAP VIEW — MARKER = EXACT STORED LATITUDE/LONGITUDE (local stack)

Verifies, against a real seeded property, that the marker Google Maps
receives is built from the property's own `latitude`/`longitude` columns —
read as numbers, validated, and used as-is — with no rounding beyond what
the value already carries, no geocoding, and no Chennai/default fallback
for properties that DO have coordinates. Also verifies properties without
coordinates never get a marker (no guess, no default), and that clicking a
marker opens the preview for the exact property that produced it.

Env: MAP_DB (default aventrix_map), SITE :8080 / REST :3000 already
running against MAP_DB.
"""
import os, sys
sys.argv = [sys.argv[0]]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "map_view_e2e.py")).read().split("EXPECTED_ON_MAP =")[0])

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ================= A. Exact coordinates for a single real property =================
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page, "?location=Neelankarai")
        slugs_a = page.evaluate("(window.AventrixSearchResults.properties || []).map(p => p.slug)")
        check("A: filter isolates exactly villa-neelankarai", slugs_a == ["villa-neelankarai"], slugs_a)
        db_row = sql("select latitude::text || ',' || longitude::text from properties where slug='villa-neelankarai'")
        db_lat, db_lng = [float(x) for x in db_row.split(",")]

        open_map(page)
        markers = page.evaluate("""() => window.__mockMaps.maps[0].markers.map(m => ({
            title: m._title, pos: m.getPosition ? { lat: m.getPosition().lat(), lng: m.getPosition().lng() } : null
        }))""")
        check("A: exactly one marker on the map", len(markers) == 1, markers)
        marker_pos = markers[0]["pos"] if markers else None
        check("A: marker latitude exactly matches the property's stored latitude (float equality, no rounding drift)",
              marker_pos is not None and marker_pos["lat"] == db_lat, (marker_pos, db_lat))
        check("A: marker longitude exactly matches the property's stored longitude (float equality, no rounding drift)",
              marker_pos is not None and marker_pos["lng"] == db_lng, (marker_pos, db_lng))

        # The map centers on this same exact point (single-property path).
        center = page.evaluate("window.__mockMaps.maps[0].getCenter().toJSON()")
        check("A: map centers on the exact same stored coordinates (not a rounded/approximate one)",
              center["lat"] == db_lat and center["lng"] == db_lng, (center, db_lat, db_lng))

        # Clicking the marker opens the preview for THIS exact property.
        page.locator('#sfMapCanvas .mock-marker').first.click()
        page.wait_for_timeout(200)
        preview_slug = page.get_attribute("#sfMapPreview", "data-slug")
        check("A: clicking the marker opens the preview for the exact property whose coordinates produced it",
              preview_slug == "villa-neelankarai", preview_slug)
        check("no JS errors (A)", not errs, errs)
        ctx.close()

        # ================= B. A property with NO coordinates never gets a marker =================
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page, "?priceMin=1000000000")  # isolates edge-long-price (lat/lng both NULL)
        slugs_b = page.evaluate("(window.AventrixSearchResults.properties || []).map(p => p.slug)")
        check("B: filter isolates exactly the coordinate-less test property", slugs_b == ["edge-long-price"], slugs_b)
        db_null = sql("select coalesce(latitude::text,'NULL') || ',' || coalesce(longitude::text,'NULL') from properties where slug='edge-long-price'")
        check("B: confirms this property truly has no stored coordinates in the DB", db_null == "NULL,NULL", db_null)
        open_map(page)
        check("B: no marker is created for a property with no coordinates", page.evaluate("window.__mockMaps.maps[0].markers.length") == 0)
        center_b = page.evaluate("window.__mockMaps.maps[0].getCenter().toJSON()")
        check("B: map falls back to the Chennai default center (never a guessed/geocoded point)",
              abs(center_b["lat"] - 13.0827) < 0.001 and abs(center_b["lng"] - 80.2707) < 0.001, center_b)
        check("no JS errors (B)", not errs, errs)
        ctx.close()

        # ================= C. Coordinates survive a Satellite/Hybrid map-type switch unchanged =================
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page, "?location=Neelankarai")
        open_map(page)
        pos_roadmap = page.evaluate("window.__mockMaps.maps[0].markers[0].getPosition().toJSON()")
        page.locator("#sfMapCanvas .mock-maptype-control").select_option("hybrid")
        page.wait_for_timeout(150)
        pos_hybrid = page.evaluate("window.__mockMaps.maps[0].markers[0].getPosition().toJSON()")
        check("C: switching Roadmap -> Satellite (hybrid) never changes the marker's coordinates",
              pos_roadmap == pos_hybrid, (pos_roadmap, pos_hybrid))
        check("no JS errors (C)", not errs, errs)
        ctx.close()

        # ================= D. Multiple real properties: each marker keyed to its own coordinates =================
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page)
        open_map(page)
        db_all = {}
        for row in sql("select slug, latitude::text, longitude::text from properties where publish_status='Published' and latitude is not null").splitlines():
            slug, lat, lng = row.split("|")
            db_all[slug] = (float(lat), float(lng))
        pins = page.evaluate("""() => window.__mockMaps.maps[0].markers
            .filter(m => m.getPosition && !m._label)  // exclude cluster markers (their position is an averaged center, not a property's own coordinates)
            .map(m => ({ title: m._title, lat: m.getPosition().lat(), lng: m.getPosition().lng() }))""")
        # Every individual (non-cluster) pin's exact position must be one of
        # the property table's real stored coordinates — never a rounded,
        # averaged, geocoded or otherwise synthesized point. (Matched by
        # coordinate value rather than by title, since two unrelated test
        # fixtures intentionally share the same title to test that edge
        # case elsewhere — real coordinates are still unique per marker.)
        db_positions = set(db_all.values())
        mismatches = [pin for pin in pins if (pin["lat"], pin["lng"]) not in db_positions]
        check("D: every individually-visible property marker's position is one of the DB's real stored coordinates",
              len(pins) > 0 and not mismatches, mismatches or "no individual (non-clustered) pins visible at this zoom")
        check("no JS errors (D)", not errs, errs)
        ctx.close()

        b.close()
    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1

sys.exit(run())
