-- ============================================================
-- AVENTRIX REALTY — CMS SEED CONTENT
-- Run AFTER sql/schema-cms-extension.sql.
--
-- Populates the new CMS tables with the ACTUAL current hardcoded
-- website content, so the site looks identical immediately after
-- go-live. Safe to re-run (on conflict do nothing / update).
-- ============================================================

-- ------------------------------------------------------------
-- PAGES
-- ------------------------------------------------------------

-- HOME — only the sections below the hero (hero already lives in
-- site_settings and stays there — untouched).
insert into pages (page_key, page_label, sections, seo_title, seo_description)
values (
    'home',
    'Homepage',
    '[
        {"key":"about-legacy","eyebrow":"OUR STORY","heading":"Our Legacy","html":"<p class=\"legacy-subtitle\">Where Legacy Meets The Next Generation</p><div class=\"legacy-timeline\"><div class=\"legacy-item\"><div class=\"legacy-year\">1965</div><div class=\"legacy-text\"><h3>TP Builders Founded</h3><p>Long before Aventrix Realty was established, the very place where our office stands today was home to <strong>TP Builders</strong>, founded by <strong>Late Mr. Perumal</strong>. From this very location, he built homes, created lasting relationships, and established a reputation that continues to inspire generations.</p></div></div><div class=\"legacy-item\"><div class=\"legacy-year\">2010</div><div class=\"legacy-text\"><h3>A New Generation</h3><p><strong>Gnanasekaran P</strong> proudly carried forward the vision of his father, preserving the values that earned generations of trust while embracing a modern approach to real estate — where tradition, professionalism, and long-term relationships remain at the heart of every property journey.</p></div></div><div class=\"legacy-item\"><div class=\"legacy-year\">Present</div><div class=\"legacy-text\"><h3>Aventrix Realty Today</h3><p><strong>Sanjay Gandhi L</strong> became part of this new chapter, bringing over a decade of real estate experience across land, residential, commercial and joint venture advisory. Together, he and <strong>Gnanasekaran P</strong> continue to lead <strong>Aventrix Realty</strong> — combining a proud legacy with modern expertise across Chennai.</p></div></div></div><p class=\"about-closing\"><strong>Honouring the past. Building the future.</strong></p>","display_order":1},
        {"key":"testimonials-heading","eyebrow":"CLIENT EXPERIENCES","heading":"What Our Clients Say","html":"<p class=\"testimonials-note\">Client testimonials shown are representative — replace with verified client feedback.</p>","display_order":2},
        {"key":"cta","eyebrow":"","heading":"Ready to Find Your Ideal Property?","html":"<p>From your first enquiry to registration day, Aventrix Realty is with you at every step — trusted guidance, verified properties, and a team that treats your journey as our own.</p>","display_order":3},
        {"key":"leadership-intro","eyebrow":"","heading":"Meet Our Leadership","html":"<p>Leading Aventrix Realty</p>","display_order":4},
        {"key":"faq","eyebrow":"GOT QUESTIONS?","heading":"Frequently Asked Questions","html":"","display_order":5},
        {"key":"office-intro","eyebrow":"VISIT US","heading":"Our Office Locations","html":"<p class=\"office-locations-subtitle\">Head Office and branch locations across Chennai.</p>","display_order":6},
        {"key":"quick-enquiry-intro","eyebrow":"LET''S CONNECT","heading":"Let''s Find Your Ideal Property","html":"<p class=\"quick-enquiry-desc\">Whether you''re buying, selling, investing, or exploring a joint venture opportunity, our experienced property advisors are here to guide you every step of the way. Share your requirements, and we''ll help you discover the right property across Chennai.</p>","display_order":7}
    ]'::jsonb,
    'Aventrix Realty — Premium Properties Across Chennai',
    'Trusted real estate solutions across residential, commercial and land investments in Chennai.'
)
on conflict (page_key) do nothing;

-- JOINT VENTURE
insert into pages (page_key, page_label, hero_eyebrow, hero_title, hero_subtitle, hero_button_text, hero_button_link, sections, seo_title)
values (
    'joint-venture', 'Joint Venture',
    'JOINT VENTURE',
    'Develop Your Land With Confidence',
    'Partner with Aventrix Realty for Joint Venture Development. We work with landowners to unlock the full potential of their property through transparent and professional partnerships.',
    'Apply Now', '#joint-form',
    '[]'::jsonb,
    'Joint Venture | Aventrix Realty'
)
on conflict (page_key) do nothing;

-- NRI SERVICES
insert into pages (page_key, page_label, hero_eyebrow, hero_title, hero_subtitle, hero_button_text, hero_button_link, sections, seo_title)
values (
    'nri-services', 'NRI Services',
    'NRI PROPERTY SERVICES',
    'List Your NRI Property with Aventrix Realty',
    'Own a property in Chennai while living abroad? Aventrix Realty helps Non-Resident Indians (NRIs) sell, lease, and manage their properties with complete transparency and professional support.',
    'Start Listing', '#owner-form',
    '[]'::jsonb,
    'NRI Services | Aventrix Realty'
)
on conflict (page_key) do nothing;

-- LIST WITH US
insert into pages (page_key, page_label, hero_eyebrow, hero_title, hero_subtitle, hero_button_text, hero_button_link, sections, seo_title)
values (
    'list-with-us', 'List With Us',
    'PROPERTY OWNER SERVICES',
    'List Your Property with Aventrix Realty',
    'Whether you''re selling, leasing or renting your property, our experienced team will help you reach genuine buyers, tenants and investors across Chennai.',
    'Start Listing', '#owner-form',
    '[]'::jsonb,
    'List with Us | Aventrix Realty'
)
on conflict (page_key) do nothing;

-- FREE VALUATION
insert into pages (page_key, page_label, hero_eyebrow, hero_title, hero_subtitle, hero_button_text, hero_button_link, sections, seo_title)
values (
    'free-valuation', 'Free Property Valuation',
    'FREE PROPERTY VALUATION',
    'Know Your Property''s True Market Value',
    'Get a professional property valuation from Aventrix Realty. Whether you are planning to sell, lease or simply understand your property''s current market value, our experts are here to help.',
    'Get Free Valuation', '#valuation-form',
    '[]'::jsonb,
    'Free Property Valuation | Aventrix Realty'
)
on conflict (page_key) do nothing;

-- INSIGHTS (page hero — articles themselves go in the `insights` table)
insert into pages (page_key, page_label, hero_eyebrow, hero_title, hero_subtitle, sections, seo_title)
values (
    'insights', 'Insights',
    'AVENTRIX INSIGHTS',
    'Market Insights, Property Knowledge & Updates',
    'Stay informed with expert articles, market trends, investment ideas and real estate guidance from Aventrix Realty.',
    '[]'::jsonb,
    'Insights | Aventrix Realty'
)
on conflict (page_key) do nothing;

-- CONTACT
insert into pages (page_key, page_label, hero_eyebrow, hero_title, hero_subtitle, sections, seo_title)
values (
    'contact', 'Contact',
    'GET IN TOUCH',
    'Contact Aventrix Realty',
    'We''re here to assist you with buying, selling, leasing and investment opportunities.',
    '[{"key":"offices-heading","eyebrow":"VISIT US","heading":"Locate Our Offices","html":"","display_order":1}]'::jsonb,
    'Contact | Aventrix Realty'
)
on conflict (page_key) do nothing;

-- OUR REALTORS (intro copy)
insert into pages (page_key, page_label, hero_eyebrow, hero_title, hero_subtitle, sections, seo_title)
values (
    'our-realtors', 'Our Realtors',
    'OUR TEAM',
    'Meet Our Real Estate Professionals',
    'Our experienced team is committed to delivering trusted guidance, market expertise and exceptional service across every property journey.',
    '[]'::jsonb,
    'Our Realtors | Aventrix Realty'
)
on conflict (page_key) do nothing;

-- ------------------------------------------------------------
-- TESTIMONIALS (the 3 existing placeholder testimonials)
-- ------------------------------------------------------------
insert into testimonials (client_name, client_role, quote, display_order)
select * from (values
    ('Ramesh Kumar', 'Purchased Residential Plot, Chromepet', 'Aventrix Realty guided us through every step of purchasing our plot in Chromepet. Transparent, patient, and genuinely trustworthy.', 1),
    ('Priya Venkatesan', 'Sold Commercial Property', 'We sold our commercial space within weeks, at a fair price, with zero surprises. Their advisory team knows the Chennai market well.', 2),
    ('Arvind Balaji', 'Bought Villa, Old Pallavaram', 'Professional, responsive, and honest from the first call to registration day. Exactly what you want in a real estate partner.', 3)
) as t(client_name, client_role, quote, display_order)
where not exists (select 1 from testimonials);

-- ------------------------------------------------------------
-- REALTORS (migrated from realtors-data.js)
-- ------------------------------------------------------------
insert into realtors (slug, name, designation, photo_url, short_intro, about, expertise, experience, languages, specializations, phone, email, whatsapp, profile_link, display_order)
values
(
    'gnanasekaran-p', 'Gnanasekaran P', 'Founder', 'images/founder.jpg',
    'Visionary leader guiding Aventrix Realty with strategic direction and long-term growth.',
    'Carrying forward a legacy built on trust and integrity, Gnanasekaran P continues the vision of TP Builders while leading Aventrix Realty with a modern approach, strong values, and a long-term commitment to every client relationship.',
    array['Land Advisory','Strategic Growth','Client Relationships'], '15+ Years',
    array['English','Tamil'], array['Land Properties','Residential Properties','Commercial Properties','Joint Venture Support'],
    '+917092356222', 'gnanasekaran@aventrixrealty.com', '917092356222', 'gnanasekaran.html', 1
),
(
    'sanjay-gandhi-l', 'L. Sanjay Gandhi', 'Co-Founder & Managing Partner', 'images/sanjay.jpg',
    'Leading business operations, client relationships, sales and real estate advisory.',
    'Leading business operations, client relationships, sales, and strategic growth at Aventrix Realty.',
    array['Sales Strategy','Client Advisory','Business Operations'], '10+ Years',
    array['English','Tamil'], array['Land Acquisition & Investment','Joint Venture & Developer Solutions','Residential Properties','Commercial Properties'],
    '+919176887770', 'sanjay@aventrixrealty.com', '919176887770', 'sanjay.html', 2
),
(
    'sample-realtor', 'Sample Realtor', 'Senior Property Consultant', 'images/sample-realtor.jpg',
    'A dedicated property consultant helping clients find the right home, plot or investment across Chennai.',
    'This is placeholder information for a future team member. A dedicated property consultant helping clients find the right home, plot or investment across Chennai, with a strong focus on transparent, trustworthy advisory at every stage of the property journey.',
    array['Residential Sales','Investment Advisory','First-Time Buyers'], '5+ Years',
    array['English','Tamil'], array['Apartments','Villas','Residential Plots'],
    '+919176887770', 'info@aventrixrealty.com', '919176887770', null, 3
)
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- INSIGHTS (the 6 existing article cards — published, so the
-- page looks identical on go-live)
-- ------------------------------------------------------------
insert into insights (slug, title, excerpt, cover_image_url, display_order, publish_status, published_at)
values
('why-location-still-matters', 'Why Location Still Matters', 'Discover why location continues to be the most important factor in real estate investment.', 'images/insight-1.jpg', 1, 'Published', now()),
('joint-venture-guide', 'Joint Venture Guide', 'A practical guide to how Joint Venture partnerships work between landowners and developers.', 'images/insight-2.jpg', 2, 'Published', now()),
('commercial-investment', 'Commercial Investment', 'What to evaluate before investing in commercial real estate in Chennai.', 'images/insight-3.jpg', 3, 'Published', now()),
('buying-your-first-property', 'Buying Your First Property', 'A step-by-step guide for first-time buyers navigating the Chennai property market.', 'images/insight-4.jpg', 4, 'Published', now()),
('understanding-property-valuation', 'Understanding Property Valuation', 'How professional valuations are calculated and why they matter.', 'images/insight-5.jpg', 5, 'Published', now()),
('real-estate-market-trends', 'Real Estate Market Trends', 'Current trends shaping residential and commercial demand across Chennai.', 'images/insight-6.jpg', 6, 'Published', now())
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- SITE SETTINGS — fill in the additive columns with today's
-- actual values (existing hero/phone/email columns untouched)
-- ------------------------------------------------------------
update site_settings set
    realtor_phone_1_display = coalesce(realtor_phone_1_display, '+91 91768 87770'),
    realtor_phone_2         = coalesce(realtor_phone_2, '+91 70923 56222'),
    whatsapp_number         = coalesce(whatsapp_number, '9176887770'),
    footer_tagline          = coalesce(footer_tagline, 'Where Legacy Meets The Next Generation'),
    footer_description      = coalesce(footer_description, 'Premium real estate advisory across Chennai — residential, commercial, land and joint venture solutions, guided by trust and decades of local expertise.'),
    copyright_text          = coalesce(copyright_text, '© 2026 Aventrix Realty. All Rights Reserved. | Designed with ❤️ by L. Sanjay Gandhi'),
    social_facebook         = coalesce(social_facebook, 'https://www.facebook.com/aventrixrealty'),
    social_instagram        = coalesce(social_instagram, 'https://www.instagram.com/aventrixrealty'),
    social_linkedin         = coalesce(social_linkedin, 'https://www.linkedin.com/in/lsanjaygandhi'),
    social_youtube          = coalesce(social_youtube, 'https://youtube.com/@sanjaygandhirealty')
where id = 1;

-- ------------------------------------------------------------
-- OFFICE LOCATIONS — fix the Adyar Branch per approved requirements.
-- HEAD OFFICE ROW IS NOT TOUCHED.
-- ------------------------------------------------------------
update office_locations
set
    address  = '2nd Floor, Padmini Complex, No. 85, Gandhi Nagar, 1st Main Road, Adyar, Chennai – 600020',
    maps_url = 'https://maps.app.goo.gl/hX53rqYkHVqpZtJSA?g_st=ic',
    email    = coalesce(email, 'adyar@aventrixrealty.com'),
    phone    = coalesce(phone, '+91 91768 87770')
where name = 'Aventrix Realty – Adyar Branch';

-- Preserve the Head Office's existing iframe embed exactly as-is.
update office_locations
set maps_embed_url = coalesce(maps_embed_url, 'https://www.google.com/maps?q=No.27%2C%201st%20Main%20Road%2C%20Newcolony%2C%20Chromepet%2C%20Chennai%2C%20Tamil%20Nadu&output=embed')
where is_head_office = true;

-- Safety check: confirm the Head Office row is untouched (should
-- return the original seeded values from sql/schema.sql).
-- select * from office_locations where is_head_office = true;
