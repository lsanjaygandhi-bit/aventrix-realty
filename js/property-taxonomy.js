/*
 * AVENTRIX REALTY — PROPERTY TYPE / SUB-TYPE TAXONOMY (shared)
 * -------------------------------------------------------------
 * Single public-site source for the Property Type -> Sub-Type list,
 * moved out of js/properties-search.js unchanged so the homepage hero
 * search (js/home-hero-search.js) and properties.html's filter panel
 * use exactly the same values, and the Admin property form
 * (admin/js/properties.js) reads it too. Load this file BEFORE any of
 * those scripts.
 */
(function () {
    const TYPE_SUBTYPES = {
    residential: [
        { value: "apartment_flat", label: "Apartment / Flat" },
        { value: "villa", label: "Villa" },
        { value: "independent_house", label: "Independent House" },
        { value: "duplex", label: "Duplex" },
        { value: "penthouse", label: "Penthouse" }
    ],
    commercial: [
        { value: "office_space", label: "Office Space" },
        { value: "shop_retail", label: "Shop / Retail" },
        { value: "showroom", label: "Showroom" },
        { value: "commercial_building", label: "Commercial Building" }
    ],
    // Land is its own top-level Property Type (2026-09-24). It uses the
    // "land" category value that existing Land & Plots listings already
    // carry, so no data migration is needed. Residential Plot and
    // Commercial Plot moved here from Residential / Commercial (no
    // listing used either value yet); values stay the same.
    land: [
        { value: "residential_plot", label: "Residential Plot" },
        { value: "commercial_plot", label: "Commercial Plot" },
        { value: "vacant_land", label: "Vacant Land" },
        { value: "development_land", label: "Development Land" },
        { value: "layout_plot", label: "Layout Plot" },
        { value: "other_land", label: "Other Land" }
    ],
    industrial: [
        { value: "factory_manufacturing", label: "Factory / Manufacturing" },
        { value: "warehouse", label: "Warehouse" },
        { value: "industrial_building", label: "Industrial Building" },
        { value: "industrial_plot", label: "Industrial Plot" }
    ],
    special_purpose: [
        { value: "hotel", label: "Hotel" },
        { value: "hospital", label: "Hospital" },
        { value: "school_institution", label: "School / Institution" },
        { value: "resort", label: "Resort" },
        { value: "other_special_purpose", label: "Other Special Purpose" }
    ],
    agricultural: [
        { value: "agricultural_land", label: "Agricultural Land" },
        { value: "farm_land", label: "Farm Land" },
        { value: "plantation_estate", label: "Plantation / Estate" }
    ]
};

    // Top-level Property Types, in display order, with public labels.
    const TYPE_LABELS = {
        residential: "Residential",
        commercial: "Commercial",
        land: "Land",
        industrial: "Industrial",
        special_purpose: "Special Purpose",
        agricultural: "Agricultural"
    };

    window.AventrixPropertyTaxonomy = { TYPE_SUBTYPES: TYPE_SUBTYPES, TYPE_LABELS: TYPE_LABELS };
})();
