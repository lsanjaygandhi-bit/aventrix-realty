/*
 * AVENTRIX REALTY — PROPERTY MATCHING ENGINE (rule-based, explainable)
 * -------------------------------------------------------------------
 * Scores one published property against a buyer's saved requirement
 * (public.buyer_requirements). No AI, no hidden logic — every point
 * comes from a factor listed below and every factor is shown to the
 * buyer with ✓ / ~ / ✗ / ? so they can see WHY a property matched.
 *
 *   Factor       Weight   Rule
 *   ----------   ------   ---------------------------------------------
 *   Budget         30     price_value inside min–max = full; within 10%
 *                         outside the range = half
 *   Location       25     any preferred location appears in `location`
 *   Type           15     category or sub_type is one of the chosen types
 *   BHK            15     bedrooms equals a chosen BHK = full; ±1 = half
 *   Parking         5     parking ≥ 1 when parking is required
 *   Area            5     built-up area ≥ minimum = full; within 10% = half
 *   Facing        2.5     facing is one of the chosen directions
 *   Furnishing    2.5     furnishing is one of the chosen options
 *
 * Only factors the buyer actually specified count. Score =
 * earned ÷ possible × 100. A factor the LISTING doesn't state
 * (e.g. no price_value) earns nothing and is shown as "Not listed" —
 * the engine never assumes a match it can't verify.
 *
 * Transaction type (Buy → sale, Rent/Lease → lease) is a hard filter:
 * a sale listing is never suggested to someone looking to rent.
 *
 * FUTURE AI LAYER: keep score() as the transparent baseline. An AI
 * re-ranker can take this function's output (factors + score) as
 * input and add a separate, clearly-labelled suggestion — it should
 * never silently replace these numbers.
 *
 * Pure functions, no DOM, no network — unit-tested in
 * tests/matching.test.js (node tests/matching.test.js).
 */
(function (root) {
    const WEIGHTS = { budget: 30, location: 25, type: 15, bhk: 15, parking: 5, area: 5, facing: 2.5, furnishing: 2.5 };

    // Legacy category values predate the sub-type taxonomy.
    const LEGACY_CATEGORY = {
        apartments: { category: "residential", sub_type: "apartment_flat" },
        villas: { category: "residential", sub_type: "villa" }
    };

    function norm(s) { return String(s == null ? "" : s).trim().toLowerCase(); }

    function parseNumber(text) {
        if (text == null || text === "") return null;
        if (typeof text === "number") return isFinite(text) ? text : null;
        const m = String(text).replace(/,/g, "").match(/(\d+(\.\d+)?)/);
        return m ? parseFloat(m[1]) : null;
    }

    function formatRupees(v) {
        if (v == null) return "";
        if (v >= 1e7) return "₹" + (v / 1e7).toFixed(2).replace(/\.?0+$/, "") + " Cr";
        if (v >= 1e5) return "₹" + (v / 1e5).toFixed(2).replace(/\.?0+$/, "") + " L";
        return "₹" + Math.round(v).toLocaleString("en-IN");
    }

    function transactionMatches(req, p) {
        if (!req.transaction_type) return true;
        const lt = norm(p.listing_type);
        if (req.transaction_type === "buy") return lt === "sale";
        return lt === "lease"; // rent / lease
    }

    function score(req, p) {
        req = req || {};
        p = p || {};
        const factors = [];
        const add = (key, label, status, detail) => {
            const credit = status === "match" ? 1 : status === "partial" ? 0.5 : 0;
            factors.push({ key, label, status, detail, weight: WEIGHTS[key], earned: WEIGHTS[key] * credit });
        };

        // Budget
        const min = parseNumber(req.budget_min), max = parseNumber(req.budget_max);
        if (min != null || max != null) {
            const price = parseNumber(p.price_value);
            if (price == null) add("budget", "Budget", "unknown", "Price not listed");
            else {
                const lo = min != null ? min : 0, hi = max != null ? max : Infinity;
                if (price >= lo && price <= hi) add("budget", "Budget", "match", formatRupees(price) + " is within budget");
                else if (price >= lo * 0.9 && price <= hi * 1.1) add("budget", "Budget", "partial", formatRupees(price) + " is within 10% of budget");
                else add("budget", "Budget", "miss", formatRupees(price) + " is outside budget");
            }
        }

        // Location
        const locs = (req.preferred_locations || []).map(norm).filter(Boolean);
        if (locs.length) {
            const pl = norm(p.location);
            if (!pl) add("location", "Location", "unknown", "Location not listed");
            else {
                const hit = locs.find((l) => pl.indexOf(l) !== -1);
                add("location", "Location", hit ? "match" : "miss", p.location);
            }
        }

        // Property type
        const types = (req.property_types || []).map(norm).filter(Boolean);
        if (types.length) {
            const legacy = LEGACY_CATEGORY[norm(p.category)] || {};
            const cat = legacy.category || norm(p.category);
            const sub = norm(p.sub_type) || legacy.sub_type || "";
            const ok = types.indexOf(cat) !== -1 || (sub && types.indexOf(sub) !== -1);
            add("type", "Property type", ok ? "match" : "miss", [p.sub_type || p.category].filter(Boolean).join(""));
        }

        // BHK
        const bhk = (req.bhk || []).map(Number).filter((n) => n > 0);
        if (bhk.length) {
            const beds = parseNumber(p.bedrooms);
            if (beds == null) add("bhk", "BHK", "unknown", "BHK not listed");
            else if (bhk.indexOf(beds) !== -1) add("bhk", "BHK", "match", beds + " BHK");
            else if (bhk.some((b) => Math.abs(b - beds) === 1)) add("bhk", "BHK", "partial", beds + " BHK");
            else add("bhk", "BHK", "miss", beds + " BHK");
        }

        // Parking
        if (req.parking_required) {
            const park = parseNumber(p.parking);
            if (park == null) add("parking", "Parking", "unknown", "Parking not listed");
            else add("parking", "Parking", park >= 1 ? "match" : "miss", park >= 1 ? park + " parking" : "No parking");
        }

        // Area
        const minArea = parseNumber(req.min_area_sqft);
        if (minArea != null && minArea > 0) {
            const area = parseNumber(p.built_up_area);
            if (area == null) add("area", "Area", "unknown", "Built-up area not listed");
            else if (area >= minArea) add("area", "Area", "match", p.built_up_area);
            else if (area >= minArea * 0.9) add("area", "Area", "partial", p.built_up_area);
            else add("area", "Area", "miss", p.built_up_area);
        }

        // Facing / Furnishing
        [["facing", "Facing"], ["furnishing", "Furnishing"]].forEach(([key, label]) => {
            const wanted = (req[key] || []).map(norm).filter(Boolean);
            if (!wanted.length) return;
            const v = norm(p[key]);
            if (!v) add(key, label, "unknown", label + " not listed");
            else add(key, label, wanted.indexOf(v) !== -1 ? "match" : "miss", p[key]);
        });

        const possible = factors.reduce((t, f) => t + f.weight, 0);
        const earned = factors.reduce((t, f) => t + f.earned, 0);
        return {
            eligible: transactionMatches(req, p),
            score: possible ? Math.round((earned / possible) * 100) : null,
            factors
        };
    }

    // Returns [{ property, score, factors }] sorted best first.
    function rank(req, properties, opts) {
        opts = opts || {};
        const minScore = opts.minScore != null ? opts.minScore : 50;
        return (properties || [])
            .map((p) => Object.assign({ property: p }, score(req, p)))
            .filter((r) => r.eligible && r.score != null && r.score >= minScore)
            .sort((a, b) => b.score - a.score);
    }

    const api = { score, rank, WEIGHTS, parseNumber };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    root.AventrixMatching = api;
})(typeof window !== "undefined" ? window : globalThis);
