const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { TextEncoder } = require("node:util");

const source = fs.readFileSync(
    path.join(__dirname, "../js/property-translations.js"),
    "utf8"
);

async function sha256(value) {
    return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function createSupabase(property, translations) {
    let translationRequests = 0;
    return {
        get translationRequests() { return translationRequests; },
        from(table) {
            const query = {
                select() { return this; },
                eq() { return this; },
                in() { return this; },
                order() { return this; },
                limit() { return this; },
                maybeSingle() { return this; },
                then(resolve, reject) {
                    if (table === "property_translations") translationRequests++;
                    const data = table === "properties"
                        ? property
                        : translations;
                    return Promise.resolve({ data, error: null }).then(resolve, reject);
                }
            };
            return query;
        }
    };
}

async function runPropertyQuery(lang, property, translations) {
    const supabaseClient = createSupabase(property, translations);
    const window = {
        supabaseClient,
        avxI18n: { getLocale: () => lang }
    };
    const context = {
        window,
        location: { pathname: "/property.html", search: `?lang=${lang}` },
        document: {
            readyState: "complete",
            body: { appendChild() {} },
            getElementById() { return null; },
            addEventListener() {}
        },
        sessionStorage: {
            getItem() { return null; },
            setItem() {}
        },
        URLSearchParams,
        crypto: crypto.webcrypto,
        TextEncoder,
        console
    };
    vm.runInNewContext(source, context);
    const result = await window.supabaseClient.from("properties").select("*").maybeSingle();
    return { result, supabaseClient };
}

test("applies approved current text and feature translations without changing facts", async () => {
    const property = {
        id: "p1",
        slug: "plot",
        title: "Original title",
        description: "Source with 2,100 sq.ft",
        location: "Chennai",
        seo_title: "Source SEO title",
        seo_description: "Source SEO description",
        features: ["30 ft road", "North facing"],
        price_display: "₹25 lakh"
    };
    const translations = [
        { property_id: "p1", field: "title", value: "Localized title", status: "approved", source_hash: await sha256(property.title) },
        { property_id: "p1", field: "description", value: "Stale translated description", status: "approved", source_hash: await sha256("old source") },
        { property_id: "p1", field: "seo_title", value: "Localized SEO title", status: "approved", source_hash: await sha256(property.seo_title) },
        { property_id: "p1", field: "seo_description", value: "Localized SEO description", status: "approved", source_hash: await sha256(property.seo_description) },
        { property_id: "p1", field: "features", value: ["Translated road", "Translated facing"], status: "approved", source_hash: await sha256(property.features.join("\n")) }
    ];

    const { result } = await runPropertyQuery("ta", property, translations);
    assert.equal(result.data.title, "Localized title");
    assert.equal(result.data.description, property.description);
    assert.equal(result.data.seo_title, "Localized SEO title");
    assert.equal(result.data.seo_description, "Localized SEO description");
    assert.deepEqual(Array.from(result.data.features), ["Translated road", "Translated facing"]);
    assert.equal(result.data.price_display, "₹25 lakh");
    assert.equal(result.data.id, property.id);
});

test("falls back to English when a translation is missing and makes no lookup in English", async () => {
    const property = {
        id: "p2",
        slug: "house",
        title: "English title",
        short_description: "English summary",
        price_display: "₹1 crore"
    };
    const ta = await runPropertyQuery("ta", property, []);
    assert.equal(ta.result.data.title, property.title);
    assert.equal(ta.result.data.short_description, property.short_description);
    assert.equal(ta.supabaseClient.translationRequests, 1);

    const en = await runPropertyQuery("en", property, []);
    assert.equal(en.result.data.title, property.title);
    assert.equal(en.supabaseClient.translationRequests, 0);
});
