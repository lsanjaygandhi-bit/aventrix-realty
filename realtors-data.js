/*
 * AVENTRIX REALTY — REALTORS DATA
 * ---------------------------------
 * Single source of truth for the "Our Realtors" listing page and
 * individual profile pages. To add a new realtor in the future,
 * simply add a new object to this array — no HTML or layout
 * changes are required. The grid and profile pages render
 * dynamically from this data.
 *
 * Fields:
 *   id            - unique URL-safe identifier (used in
 *                   realtor-profile.html?id=...)
 *   name           - full display name
 *   designation    - role / title
 *   photo          - path to circular card photo
 *   shortIntro     - 1-2 sentence summary shown on the card
 *   profileLink    - OPTIONAL. If set, "View Profile" links to this
 *                    URL instead of the dynamic profile template
 *                    (used for the two existing dedicated pages).
 *   about          - longer bio paragraph for the profile page
 *   expertise      - array of areas of expertise
 *   experience     - years of experience, as a string (e.g. "10+ Years")
 *   languages      - array of languages spoken
 *   specializations- array of specializations
 *   phone          - contact number (tel: link format, e.g. "+919176887770")
 *   email          - contact email
 *   whatsapp       - WhatsApp number, digits only (e.g. "919176887770")
 */

const REALTORS_DATA = [
    {
        id: "gnanasekaran-p",
        name: "Gnanasekaran P",
        designation: "Founder",
        photo: "images/founder.jpg",
        shortIntro: "Visionary leader guiding Aventrix Realty with strategic direction and long-term growth.",
        profileLink: "gnanasekaran.html",
        about: "Visionary leader guiding Aventrix Realty with strategic direction and long-term growth.",
        expertise: ["Land Advisory", "Strategic Growth", "Client Relationships"],
        experience: "15+ Years",
        languages: ["English", "Tamil"],
        specializations: ["Residential", "Land & Plots", "Joint Ventures"],
        phone: "+917092356222",
        email: "info@aventrixrealty.com",
        whatsapp: "917092356222"
    },
    {
        id: "sanjay-gandhi-l",
        name: "L. Sanjay Gandhi",
        designation: "Co-Founder & Managing Partner",
        photo: "images/sanjay.jpg",
        shortIntro: "Leading business operations, client relationships, sales and real estate advisory.",
        profileLink: "sanjay.html",
        about: "Leading business operations, client relationships, sales and real estate advisory.",
        expertise: ["Sales Strategy", "Client Advisory", "Business Operations"],
        experience: "10+ Years",
        languages: ["English", "Tamil"],
        specializations: ["Commercial", "Residential", "Joint Ventures"],
        phone: "+919176887770",
        email: "info@aventrixrealty.com",
        whatsapp: "919176887770"
    },
    {
        id: "sample-realtor",
        name: "Sample Realtor",
        designation: "Senior Property Consultant",
        photo: "images/sample-realtor.jpg",
        shortIntro: "A dedicated property consultant helping clients find the right home, plot or investment across Chennai.",
        about: "This is placeholder information for a future team member. A dedicated property consultant helping clients find the right home, plot or investment across Chennai, with a strong focus on transparent, trustworthy advisory at every stage of the property journey.",
        expertise: ["Residential Sales", "Investment Advisory", "First-Time Buyers"],
        experience: "5+ Years",
        languages: ["English", "Tamil"],
        specializations: ["Apartments", "Villas", "Residential Plots"],
        phone: "+919176887770",
        email: "info@aventrixrealty.com",
        whatsapp: "919176887770"
    }

    // To add a new realtor: copy the block above, give it a unique
    // "id", and fill in their details. That's it — both the grid
    // and profile pages will pick it up automatically.
];
