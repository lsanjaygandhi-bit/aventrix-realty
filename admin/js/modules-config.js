/*
 * AVENTRIX REALTY — ADMIN MODULE REGISTRY
 * -------------------------------------------
 * This is the extension point for the whole admin panel. Every content
 * type managed here (Properties today; Blogs / Testimonials / Projects
 * / Developers / Team Members tomorrow) is described as one config
 * object in ADMIN_MODULES, instead of hand-building a new page.
 *
 * TO ADD A NEW MODULE LATER (e.g. Testimonials):
 *   1. Create the Supabase table (see sql/schema.sql for the pattern:
 *      id, created_at, updated_at, publish_status, plus your fields).
 *   2. Add a new entry to ADMIN_MODULES below with its table name,
 *      sidebar label/icon, and list-view columns.
 *   3. Build its list/edit rendering the same way properties.js does
 *      (fetch → render rows → open modal with a form → insert/update).
 *   4. Add one line to dashboard.html's sidebar nav and one
 *      `case` in dashboard-app.js's router.
 * No other file needs to change — this is what "modular, no
 * restructuring" means in practice.
 */

const ADMIN_MODULES = [
    {
        key: "properties",
        label: "Properties",
        icon: "fa-building",
        table: "properties",
        description: "Property listings shown on the public website."
    },
    {
        key: "offices",
        label: "Office Locations",
        icon: "fa-map-location-dot",
        table: "office_locations",
        description: "Head Office plus any branch locations shown in the Contact section and footer. See admin/js/offices.js."
    },
    {
        key: "pages",
        label: "Website Content",
        icon: "fa-file-lines",
        table: "pages",
        description: "Homepage, Joint Venture, NRI Services, List With Us, Free Valuation, Contact, Insights & Our Realtors page content. See admin/js/page-content.js."
    },
    {
        key: "testimonials",
        label: "Testimonials",
        icon: "fa-quote-right",
        table: "testimonials",
        description: "Client testimonials shown on the homepage. See admin/js/testimonials.js."
    },
    {
        key: "realtors",
        label: "Realtors / Team",
        icon: "fa-users",
        table: "realtors",
        description: "Our Realtors grid, Realtor Profile, Sanjay & Gnanasekaran pages. See admin/js/realtors.js."
    },
    {
        key: "insights",
        label: "Insights",
        icon: "fa-newspaper",
        table: "insights",
        description: "Articles shown on the Insights page. See admin/js/insights.js."
    },
    {
        key: "media",
        label: "Media Library",
        icon: "fa-images",
        table: "media_library",
        description: "Central image browse/upload/reuse across every module. See admin/js/media-library.js."
    }
];
