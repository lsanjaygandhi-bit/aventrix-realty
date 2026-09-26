// node tests/matching.test.js — unit tests for js/property-matching.js
const assert = require("assert");
const M = require("../js/property-matching.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("PASS " + name); };

const req = { transaction_type: "buy", preferred_locations: ["Medavakkam"], budget_min: 6000000, budget_max: 9000000,
    bhk: [2], parking_required: true, property_types: ["residential"] };
const perfect = { listing_type: "sale", location: "Medavakkam, Chennai", price_value: 7500000, bedrooms: 2, parking: 1, category: "residential" };

t("perfect match = 100", () => assert.strictEqual(M.score(req, perfect).score, 100));
t("spec example factors all ✓", () => assert.deepStrictEqual(M.score(req, perfect).factors.map(f => f.status), ["match","match","match","match","match"]));
t("sale listing hidden from renters", () => assert.strictEqual(M.score({ ...req, transaction_type: "rent" }, perfect).eligible, false));
t("lease listing shown to renters", () => assert.strictEqual(M.score({ transaction_type: "lease" }, { listing_type: "lease" }).eligible, true));
t("price 5% over max = partial", () => {
    const r = M.score(req, { ...perfect, price_value: 9400000 });
    assert.strictEqual(r.factors.find(f => f.key === "budget").status, "partial");
    assert.strictEqual(r.score, 83); // earned 75 of 90 possible
});
t("unknown price earns nothing but is flagged", () => {
    const r = M.score(req, { ...perfect, price_value: null });
    assert.strictEqual(r.factors.find(f => f.key === "budget").status, "unknown");
    assert.strictEqual(r.score, 67);
});
t("wrong location = miss", () => assert.strictEqual(M.score(req, { ...perfect, location: "Adyar" }).factors.find(f => f.key === "location").status, "miss"));
t("3 BHK vs wanted 2 = partial", () => assert.strictEqual(M.score(req, { ...perfect, bedrooms: 3 }).factors.find(f => f.key === "bhk").status, "partial"));
t("legacy 'apartments' counts as residential", () => assert.strictEqual(M.score({ property_types: ["residential"] }, { category: "apartments" }).score, 100));
t("sub_type match", () => assert.strictEqual(M.score({ property_types: ["villa"] }, { category: "residential", sub_type: "villa" }).score, 100));
t("area parsed from free text", () => assert.strictEqual(M.score({ min_area_sqft: 1000 }, { built_up_area: "1,250 sq.ft" }).score, 100));
t("no criteria → null score (not a fake %)", () => assert.strictEqual(M.score({}, perfect).score, null));
t("rank filters + sorts", () => {
    const list = [perfect, { ...perfect, location: "Adyar" }, { ...perfect, listing_type: "lease" }];
    const r = M.rank(req, list);
    assert.strictEqual(r.length, 2); assert.strictEqual(r[0].score, 100);
});
console.log(`\n${n} passed`);
