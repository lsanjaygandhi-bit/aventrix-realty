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
    }
    // Future modules go here, following the same shape, e.g.:
    // {
    //     key: "blogs",
    //     label: "Blog / Journal",
    //     icon: "fa-newspaper",
    //     table: "blog_posts",
    //     description: "Articles shown on the Insights page."
    // },
    // {
    //     key: "testimonials",
    //     label: "Testimonials",
    //     icon: "fa-quote-right",
    //     table: "testimonials",
    //     description: "Client testimonials shown on the homepage."
    // },
    // {
    //     key: "projects",
    //     label: "Projects",
    //     icon: "fa-city",
    //     table: "projects",
    //     description: "Larger development projects (multi-unit)."
    // },
    // {
    //     key: "developers",
    //     label: "Developers",
    //     icon: "fa-user-tie",
    //     table: "developers",
    //     description: "Partner developer/builder profiles."
    // },
    // {
    //     key: "team",
    //     label: "Team Members",
    //     icon: "fa-users",
    //     table: "team_members",
    //     description: "Staff/agent profiles."
    // }
];
