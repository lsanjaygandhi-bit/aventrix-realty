-- ============================================================
-- AVENTRIX REALTY — WEBSITE CONTENT → ADMIN CMS SYNC (2026-09-26)
-- File: sql/migration-2026-09-26-04-cms-content-sync.sql
--
-- Makes Admin → Website Content show (and control) the text every public
-- page already displays. The content below was read from the pages
-- themselves by tests/cms/extract.js, and tests/cms/fidelity.py proves
-- that applying it back reproduces each page exactly. Nothing invented.
--
-- RULES (enforced by the functions below):
--   * a page with no `pages` row gets one (Published, like the others);
--   * an existing value is NEVER overwritten — hero/SEO fields, section
--     eyebrow/heading/text/image and every structured field are filled
--     only where they are blank;
--   * sections the page has but the row lacks are appended; existing
--     sections keep their text and gain their structured fields/lists and
--     `hooks`/`label` (Admin form metadata);
--   * no row is deleted; publish status, roles, RLS and schema unchanged.
-- ONE restructure: the Homepage "about-legacy" section (shown on About Us)
--   moves from one HTML block into structured fields (subtitle, timeline
--   year/title/text, closing) with the same words; its old HTML copy is
--   cleared ONLY if it is still exactly the original (md5 f48fdb9d68404058977ab1bd5ac6c291),
--   so a later edit would be kept. Reason: the old Quill editor strips the
--   timeline layout on save.
-- Also fills the blank Site Settings RERA agent number with the one the
--   website shows (TN/Agent/0284/2026).
--
-- SAFETY: snapshot first (backup_20260926_cms2). Idempotent: re-running
-- changes nothing. Rollback block at the end.
-- ============================================================
-- ------------------------------------------------------------
-- APPLIED WITH HOLDS (per user approval, 2026-09-27):
--   * privacy-policy and terms page blocks REMOVED from this seed —
--     the drafted legal content is not published without review.
--   * home/why-us: removed the "Trusted Since 1965" and "Every property
--     is legally verified before listing." list items — unverified
--     claims are not published.
--   * home/leadership-intro leaders[].name and the "sanjay" page's
--     page_label/seo_title/seo_description: "Sanjay Gandhi L" ->
--     "L. Sanjay Gandhi" (display-name fields only; body-prose bios
--     that already read "Sanjay Gandhi L" on the live pages are left
--     exactly as published, per the founder-pages wording decision).
--   * migration 05 (founder alternate wording) is NOT run.
--   * home/faq "Do you help with legal verification?" answer reworded
--     (2026-09-27, follow-up correction) from a blanket "every property
--     ... undergoes legal verification" claim to neutral wording that
--     does not promise verification of every listing, and recommends
--     independent verification instead. NOTE: this file was already
--     applied to production with the OLD wording before this correction
--     — a separate follow-up UPDATE is still needed against production
--     to match this file (not run as part of this change; see report).
-- ------------------------------------------------------------
begin;

create schema if not exists backup_20260926_cms2;
revoke all on schema backup_20260926_cms2 from public, anon, authenticated;
create table if not exists backup_20260926_cms2.pages as select * from public.pages;
create table if not exists backup_20260926_cms2.site_settings as select * from public.site_settings;
revoke all on all tables in schema backup_20260926_cms2 from public, anon, authenticated;

-- blank = null or only whitespace
create or replace function pg_temp.blank(v jsonb) returns boolean language sql immutable as $$
  select v is null or jsonb_typeof(v) = 'null' or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '')
$$;

-- object merge: keep every existing non-blank value, fill blanks / missing keys from n
create or replace function pg_temp.fill_obj(e jsonb, n jsonb) returns jsonb language plpgsql immutable as $$
declare k text; r jsonb := coalesce(e, '{}'::jsonb);
begin
  if n is null then return e; end if;
  for k in select jsonb_object_keys(n) loop
    if pg_temp.blank(r -> k) then r := r || jsonb_build_object(k, n -> k); end if;
  end loop;
  return r;
end $$;

create or replace function pg_temp.merge_section(e jsonb, n jsonb) returns jsonb language plpgsql immutable as $$
declare r jsonb := e; k text; lists jsonb;
begin
  foreach k in array array['label','eyebrow','heading','html','image_url'] loop
    if pg_temp.blank(r -> k) and not pg_temp.blank(n -> k) then r := r || jsonb_build_object(k, n -> k); end if;
  end loop;
  if r -> 'hooks' is null and n ? 'hooks' then r := r || jsonb_build_object('hooks', n -> 'hooks'); end if;
  if n ? 'fields' then r := r || jsonb_build_object('fields', pg_temp.fill_obj(r -> 'fields', n -> 'fields')); end if;
  if n ? 'lists' then
    lists := coalesce(r -> 'lists', '{}'::jsonb);
    for k in select jsonb_object_keys(n -> 'lists') loop
      if lists -> k is null or jsonb_array_length(lists -> k) = 0 then lists := lists || jsonb_build_object(k, n -> 'lists' -> k); end if;
    end loop;
    r := r || jsonb_build_object('lists', lists);
  end if;
  return r;
end $$;

create or replace function pg_temp.merge_sections(cur jsonb, add jsonb) returns jsonb language plpgsql immutable as $$
declare s jsonb; out jsonb := '[]'::jsonb; e jsonb; mx int;
begin
  cur := coalesce(cur, '[]'::jsonb);
  -- existing sections, in their order, merged with the page's version
  for e in select value from jsonb_array_elements(cur) loop
    select value into s from jsonb_array_elements(add) where value ->> 'key' = e ->> 'key' limit 1;
    out := out || jsonb_build_array(case when s is null then e else pg_temp.merge_section(e, s) end);
    s := null;
  end loop;
  select coalesce(max((value ->> 'display_order')::int), 0) into mx from jsonb_array_elements(cur);
  -- sections the row doesn't have yet, appended after the existing ones
  for s in select value from jsonb_array_elements(add) loop
    if not exists (select 1 from jsonb_array_elements(cur) c where c.value ->> 'key' = s ->> 'key') then
      mx := mx + 1;
      out := out || jsonb_build_array(s || jsonb_build_object('display_order', mx));
    end if;
  end loop;
  return out;
end $$;

create or replace function pg_temp.fill_text(cur text, n text) returns text language sql immutable as $$
  select case when coalesce(btrim(cur), '') = '' and coalesce(btrim(n), '') <> '' then n else cur end
$$;

create temp table cms_seed(doc jsonb) on commit drop;
insert into cms_seed(doc) select value from jsonb_array_elements($cms$[
 {
  "page_key": "home",
  "sections": [
   {
    "key": "leadership-intro",
    "label": "Meet Our Leadership (founders)",
    "eyebrow": "",
    "heading": "Meet Our Leadership",
    "html": "<p>Leading Aventrix Realty</p>",
    "image_url": "",
    "lists": {
     "leaders": [
      {
       "photo": "images/founder.jpg",
       "name": "Gnanasekaran P",
       "label": "— MEET OUR FOUNDER",
       "role": "Founder",
       "bio": "With over 15 years of experience in Chennai's real estate market, Gnanasekaran P provides the strategic direction and leadership behind Aventrix Realty. His deep understanding of local market cycles and neighbourhood trends shapes how the company sources and evaluates properties across residential, commercial and land segments. Over the years, he has built trusted, long-standing relationships with clients, landowners and developers, grounded in transparency and professional conduct at every stage of a transaction. His focus remains on steady, sustainable business development — growing Aventrix Realty's presence across Chennai while holding firmly to the standards of integrity that lasting real estate relationships depend on.",
       "link_text": "View Profile →",
       "profile_link": "gnanasekaran.html"
      },
      {
       "photo": "images/sanjay.jpg",
       "name": "L. Sanjay Gandhi",
       "label": "— MEET OUR CO-FOUNDER",
       "role": "Co-Founder & Managing Partner",
       "rera": "TNRERA Reg. No.: TN/Agent/0284/2026",
       "bio": "Sanjay Gandhi L brings over 15 years of hands-on real estate experience to his role as Co-Founder and Managing Partner of Aventrix Realty, where he leads day-to-day business and operational activity. His work spans the full property lifecycle — buying, selling and leasing — coordinating property marketing and transaction execution while managing negotiations through to closure. With close familiarity with Chennai's neighbourhoods and property values, he works directly with buyers, sellers, investors and property owners to guide each transaction with clarity and care. His approach is centred on building long-term client relationships, backed by practical market knowledge and dependable, on-ground support.",
       "link_text": "View Profile →",
       "profile_link": "sanjay.html"
      }
     ]
    },
    "hooks": [
     "heading",
     "html"
    ],
    "display_order": 1
   },
   {
    "key": "future-properties",
    "label": "Future Properties (heading; cards are the latest 20 Published properties, Featured first — Admin → Properties)",
    "eyebrow": "",
    "heading": "Future Properties",
    "html": "",
    "image_url": "",
    "fields": {
     "subtitle": "Handpicked properties for your future.",
     "link_text": "See All <span aria-hidden=\"true\">→</span>",
     "link": "properties.html"
    },
    "hooks": [
     "heading"
    ],
    "display_order": 2
   },
   {
    "key": "property-categories",
    "label": "Property Categories",
    "eyebrow": "BROWSE BY TYPE",
    "heading": "Property Categories",
    "html": "",
    "image_url": "",
    "lists": {
     "categories": [
      {
       "link": "properties.html?category=residential",
       "image": "images/cat-residential.jpg",
       "label": "Residential"
      },
      {
       "link": "properties.html?category=commercial",
       "image": "images/cat-commercial.jpg",
       "label": "Commercial"
      },
      {
       "link": "properties.html?category=land",
       "image": "images/cat-land-plots.jpg",
       "label": "Land & Plots"
      },
      {
       "link": "properties.html?category=villas",
       "image": "images/cat-luxury-villas.jpg",
       "label": "Luxury Villas"
      },
      {
       "link": "properties.html?category=apartments",
       "image": "images/cat-apartments.jpg",
       "label": "Apartments"
      },
      {
       "link": "properties.html?category=investment",
       "image": "images/cat-investment.jpg",
       "label": "Investment Properties"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 3
   },
   {
    "key": "what-we-do",
    "label": "What We Do (service cards)",
    "eyebrow": "WHAT WE DO",
    "heading": "Featured Services",
    "html": "",
    "image_url": "",
    "lists": {
     "services": [
      {
       "link": "properties.html?transaction=buy",
       "icon": "fas fa-home",
       "title": "Buy",
       "text": "Find verified homes, apartments and plots.",
       "link_text": "Learn More →"
      },
      {
       "link": "list-with-us.html",
       "icon": "fas fa-hand-holding-usd",
       "title": "Sell",
       "text": "List and sell your property with expert guidance.",
       "link_text": "Learn More →"
      },
      {
       "link": "properties.html?transaction=lease",
       "icon": "fas fa-key",
       "title": "Lease",
       "text": "Residential and Commercial Leasing.",
       "link_text": "Learn More →"
      },
      {
       "link": "joint-venture.html",
       "icon": "fas fa-people-arrows",
       "title": "Joint Venture",
       "text": "Developer and landowner partnerships, built on trust.",
       "link_text": "Learn More →"
      },
      {
       "link": "services.html#property-advisory",
       "icon": "fas fa-user-tie",
       "title": "Property Advisory",
       "text": "Expert guidance for every stage of your property journey.",
       "link_text": "Learn More →"
      },
      {
       "link": "nri-services.html",
       "icon": "fas fa-globe-asia",
       "title": "NRI Services",
       "text": "Remote-friendly property solutions for NRI clients.",
       "link_text": "Learn More →"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 4
   },
   {
    "key": "why-us",
    "label": "Why Aventrix (6 points)",
    "eyebrow": "WHY AVENTRIX",
    "heading": "The Aventrix Standard",
    "html": "",
    "image_url": "",
    "lists": {
     "points": [
      {
       "title": "Local Market Expertise",
       "text": "Deep knowledge of Chennai's neighborhoods and value trends."
      },
      {
       "title": "Transparent Process",
       "text": "Clear pricing, documentation and communication at every step."
      },
      {
       "title": "Professional Guidance",
       "text": "Expert support from search to registration."
      },
      {
       "title": "Dedicated Support",
       "text": "A responsive team, available throughout your journey."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 5
   },
   {
    "key": "testimonials-heading",
    "label": "Testimonials (heading; quotes come from Admin → Testimonials)",
    "eyebrow": "CLIENT EXPERIENCES",
    "heading": "What Our Clients Say",
    "html": "",
    "image_url": "",
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 6
   },
   {
    "key": "cta",
    "label": "Call to action band",
    "eyebrow": "",
    "heading": "Ready to Find Your Ideal Property?",
    "html": "<p> From your first enquiry to registration day, Aventrix Realty is with you at every step — trusted guidance, verified properties, and a team that treats your journey as our own. </p>",
    "image_url": "",
    "lists": {
     "buttons": [
      {
       "text": "Explore Properties",
       "link": "properties.html"
      },
      {
       "text": "Let's Connect",
       "link": "#contact"
      }
     ]
    },
    "hooks": [
     "heading",
     "html"
    ],
    "display_order": 7
   },
   {
    "key": "brokerage-teaser",
    "label": "Professional Fees teaser",
    "eyebrow": "TRANSPARENCY",
    "heading": "Professional Fees, Agreed Upfront",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "At Aventrix Realty, brokerage and professional fees are always communicated upfront — no hidden charges, no surprises. Our fee structure is transparent from the very first conversation, so you always know exactly what to expect at every stage of your transaction.",
     "link_text": "How Our Fees Work →",
     "link": "brokerage-fees.html"
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 8
   },
   {
    "key": "why-invest",
    "label": "Why Invest in Chennai",
    "eyebrow": "THE OPPORTUNITY",
    "heading": "Why Invest in Chennai",
    "html": "",
    "image_url": "",
    "fields": {
     "link_text": "Explore Chennai Investment Opportunities →",
     "link": "insights.html"
    },
    "lists": {
     "points": [
      {
       "title": "Growth Corridors",
       "text": "Rapidly developing zones offering strong long-term value."
      },
      {
       "title": "Metro & Infrastructure",
       "text": "Expanding transit access and ongoing infrastructure investment across the city."
      },
      {
       "title": "IT & Business Hubs",
       "text": "Proximity to major commercial and technology corridors."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 9
   },
   {
    "key": "faq",
    "label": "Frequently Asked Questions",
    "eyebrow": "GOT QUESTIONS?",
    "heading": "Frequently Asked Questions",
    "html": "",
    "image_url": "",
    "lists": {
     "faqs": [
      {
       "question": "How do I buy a property?",
       "answer": "<p>Share your requirements through our Quick Enquiry form or a phone call. Our advisors shortlist verified properties matching your budget and preferences, arrange site visits, and guide you through documentation and registration.</p>"
      },
      {
       "question": "How does Joint Venture work?",
       "answer": "<p>We partner landowners with reputable developers, structuring agreements that balance land value with construction investment — handling negotiations, legal documentation and project coordination throughout.</p>"
      },
      {
       "question": "How does property valuation work?",
       "answer": "<p>Our team assesses location, market trends, property condition and comparable sales to provide a fair, data-backed valuation — free of cost, with no obligation.</p>"
      },
      {
       "question": "Do you assist NRIs?",
       "answer": "<p>Yes. We offer remote-friendly services for NRI clients, including virtual property tours, document handling, power-of-attorney coordination and end-to-end transaction support.</p>"
      },
      {
       "question": "Do you help with legal verification?",
       "answer": "<p>We review the documents and approval status shared for each property and guide you through the checks involved. We also recommend verifying title and legal details independently with a qualified professional before making a decision.</p>"
      },
      {
       "question": "Can you help sell my property?",
       "answer": "<p>Absolutely. Our team markets your property to verified buyers, manages inquiries and negotiations, and supports you through to a smooth registration.</p>"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 10
   },
   {
    "key": "office-intro",
    "label": "Office Locations (heading; offices come from Admin → Office Locations)",
    "eyebrow": "VISIT US",
    "heading": "Our Office Locations",
    "html": "<p>Head Office and branch locations across Chennai.</p>",
    "image_url": "",
    "hooks": [
     "eyebrow",
     "heading",
     "html"
    ],
    "display_order": 11
   },
   {
    "key": "quick-enquiry-intro",
    "label": "Quick Enquiry (intro text)",
    "eyebrow": "LET'S CONNECT",
    "heading": "Let's Find Your Ideal Property",
    "html": "<p> Whether you're buying, selling, investing, or exploring a joint venture opportunity, our experienced property advisors are here to guide you every step of the way. Share your requirements, and we'll help you discover the right property across Chennai. </p>",
    "image_url": "",
    "hooks": [
     "eyebrow",
     "heading",
     "html"
    ],
    "display_order": 12
   },
   {
    "key": "about-legacy",
    "label": "Our Legacy — shown on About Us",
    "eyebrow": "Our Story",
    "heading": "Our Legacy",
    "html": "",
    "image_url": "",
    "fields": {
     "subtitle": "Where Legacy Meets The Next Generation",
     "closing": "<strong>Honouring the past. Building the future.</strong>"
    },
    "lists": {
     "timeline": [
      {
       "year": "1965",
       "title": "TP Builders Founded",
       "text": "Long before Aventrix Realty was established, the very place where our office stands today was home to <strong>TP Builders</strong>, founded by <strong>Late Mr. Perumal</strong>. From this very location, he built homes, created lasting relationships, and established a reputation that continues to inspire generations."
      },
      {
       "year": "2010",
       "title": "A New Generation",
       "text": "<strong>Gnanasekaran P</strong> proudly carried forward the vision of his father, preserving the values that earned generations of trust while embracing a modern approach to real estate — where tradition, professionalism, and long-term relationships remain at the heart of every property journey."
      },
      {
       "year": "Present",
       "title": "Aventrix Realty Today",
       "text": "<strong>Sanjay Gandhi L</strong> became part of this new chapter, bringing over a decade of real estate experience across land, residential, commercial and joint venture advisory. Together, he and <strong>Gnanasekaran P</strong> continue to lead <strong>Aventrix Realty</strong> — combining a proud legacy with modern expertise across Chennai."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 13
   }
  ],
  "page_label": "Homepage",
  "hero_button_text": "Post Property <span>FREE</span>",
  "hero_button_link": "list-with-us.html",
  "hero_image_url": "images/hero-poster.jpg",
  "seo_title": "Aventrix Realty",
  "seo_description": "Aventrix Realty — trusted real estate advisory in Chennai for residential, commercial, land and joint venture properties. TNRERA-registered agent. Buy, sell, rent or invest with expert local guidance.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/chennai-marina.jpg"
 },
 {
  "page_key": "about",
  "sections": [
   {
    "key": "about-statement",
    "label": "Brand statement",
    "eyebrow": "",
    "heading": "Clear answers make <span class=\"about-accent\">confident decisions.</span>",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "At Aventrix Realty, we believe every property decision should begin with a clear understanding of the opportunity, the market and the objective behind it. Our role is to simplify the process, present the right information and support our clients from the first conversation to the next step."
    },
    "hooks": [
     "heading"
    ],
    "display_order": 1
   },
   {
    "key": "who-we-are",
    "label": "Who We Are",
    "eyebrow": "Who We Are",
    "heading": "Local Knowledge. Professional Guidance.",
    "html": "",
    "image_url": "images/valuation-bg.png",
    "fields": {
     "text": "Aventrix Realty works across a wide range of property requirements — buying, selling, leasing, investment, land, residential properties, commercial properties and joint development opportunities. Every engagement begins with a clear conversation about what the client is trying to achieve, whether that means finding the right property, positioning one for sale, or exploring a development opportunity for a piece of land.",
     "text2": "Once the requirement is well understood, our team works to match it with property opportunities that genuinely fit — rather than presenting options that don't serve the client's actual objective."
    },
    "lists": {
     "tags": [
      {
       "label": "Buying"
      },
      {
       "label": "Selling"
      },
      {
       "label": "Leasing"
      },
      {
       "label": "Investment"
      },
      {
       "label": "Land"
      },
      {
       "label": "Residential Properties"
      },
      {
       "label": "Commercial Properties"
      },
      {
       "label": "Joint Development"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading",
     "image_url"
    ],
    "display_order": 2
   },
   {
    "key": "our-approach",
    "label": "Our Approach (4 cards)",
    "eyebrow": "Our Approach",
    "heading": "A More Thoughtful Way to Handle Property.",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "number": "01",
       "title": "The Brief Comes First",
       "text": "We start with a conversation, not a shortlist — understanding the purpose, budget, location and timeline behind a requirement before recommending a single property."
      },
      {
       "number": "02",
       "title": "Read the Market",
       "text": "We consider location, property characteristics, pricing context and current market conditions before presenting an opportunity."
      },
      {
       "number": "03",
       "title": "Present Clearly",
       "text": "We keep property information straightforward so clients can evaluate opportunities without unnecessary complexity."
      },
      {
       "number": "04",
       "title": "Support the Process",
       "text": "We stay involved through discussions, coordination and the practical steps that follow a property decision."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 3
   },
   {
    "key": "about-services",
    "label": "Our Services (6 cards)",
    "eyebrow": "Our Services",
    "heading": "From Property Search to Strategic Opportunities.",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "number": "01",
       "title": "Buy",
       "text": "Helping buyers identify suitable properties based on location, requirement and budget."
      },
      {
       "number": "02",
       "title": "Sell",
       "text": "Supporting property owners with positioning, enquiries and transaction coordination."
      },
      {
       "number": "03",
       "title": "Lease",
       "text": "Connecting suitable properties with genuine leasing requirements."
      },
      {
       "number": "04",
       "title": "Invest",
       "text": "Helping clients evaluate property opportunities with a practical, information-led approach."
      },
      {
       "number": "05",
       "title": "Joint Development",
       "text": "Supporting landowners and development opportunities through structured discussions and coordination."
      },
      {
       "number": "06",
       "title": "Property Advisory",
       "text": "Providing practical guidance around property requirements and available opportunities."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 4
   },
   {
    "key": "about-leadership",
    "label": "Leadership heading (people are edited under Homepage → Meet Our Leadership)",
    "eyebrow": "Our Leadership",
    "heading": "People Behind Aventrix Realty.",
    "html": "",
    "image_url": "",
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 5
   },
   {
    "key": "about-network",
    "label": "Our Network",
    "eyebrow": "Beyond the Property",
    "heading": "Strong Property Decisions Start With the Right Connections.",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "A property transaction rarely involves just one person. Aventrix Realty works through a professional network that brings together property owners, buyers, sellers, tenants, developers, investors, local property contacts and professional service partners — helping connect the right people at the right stage of a transaction.",
     "link_text": "Explore Our Realtors",
     "link": "our-realtors.html"
    },
    "lists": {
     "tags": [
      {
       "label": "Property Owners"
      },
      {
       "label": "Buyers"
      },
      {
       "label": "Sellers"
      },
      {
       "label": "Tenants"
      },
      {
       "label": "Developers"
      },
      {
       "label": "Investors"
      },
      {
       "label": "Local Property Contacts"
      },
      {
       "label": "Professional Service Partners"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 6
   },
   {
    "key": "about-why",
    "label": "Why Aventrix (5 points)",
    "eyebrow": "Why Aventrix Realty",
    "heading": "Clear Thinking. Practical Execution.",
    "html": "",
    "image_url": "",
    "lists": {
     "points": [
      {
       "number": "01",
       "title": "Requirement First",
       "text": "We focus on understanding the client's actual requirement before suggesting a property."
      },
      {
       "number": "02",
       "title": "Local Perspective",
       "text": "We bring practical knowledge of Chennai's property markets and locations."
      },
      {
       "number": "03",
       "title": "Straightforward Communication",
       "text": "We aim to keep property information and discussions clear and easy to understand."
      },
      {
       "number": "04",
       "title": "Professional Coordination",
       "text": "We help coordinate conversations and next steps between the relevant parties."
      },
      {
       "number": "05",
       "title": "Long-Term Relationships",
       "text": "We value professional relationships beyond a single property transaction."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 7
   },
   {
    "key": "about-declaration",
    "label": "Commitment statement",
    "eyebrow": "Our Commitment",
    "heading": "A property decision should never feel like a guess.<br> <span class=\"about-accent\">We make sure it doesn't.</span>",
    "html": "",
    "image_url": "",
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 8
   },
   {
    "key": "final-cta",
    "label": "Closing call to action",
    "eyebrow": "",
    "heading": "Looking for the Right Property Opportunity?",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "Tell us what you are looking for, and our team can help you explore the next step."
    },
    "lists": {
     "buttons": [
      {
       "text": "View Properties",
       "link": "properties.html"
      },
      {
       "text": "Contact Aventrix",
       "link": "contact.html"
      }
     ]
    },
    "hooks": [
     "heading"
    ],
    "display_order": 9
   }
  ],
  "page_label": "About Us",
  "hero_eyebrow": "ABOUT AVENTRIX REALTY",
  "hero_title": "Real Estate. With Clarity<br>and Purpose.",
  "hero_subtitle": "Aventrix Realty brings together local market understanding, professional guidance and practical execution to help clients make confident property decisions.",
  "seo_title": "About Us | Aventrix Realty",
  "seo_description": "Aventrix Realty brings together local market understanding, professional guidance and practical execution to help clients make confident property decisions across Chennai.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/chennai-marina.jpg"
 },
 {
  "page_key": "services",
  "sections": [
   {
    "key": "services-list",
    "label": "Services (7 cards)",
    "eyebrow": "OUR PORTFOLIO",
    "heading": "Everything We Offer, In One Place",
    "html": "",
    "image_url": "",
    "lists": {
     "services": [
      {
       "title": "Residential Sales",
       "text": "Apartments, Villas & Independent Homes.",
       "link_text": "Learn More →",
       "link": "properties.html?transaction=buy"
      },
      {
       "title": "Commercial Properties",
       "text": "Office, Retail & Investment Spaces.",
       "link_text": "Learn More →",
       "link": "properties.html"
      },
      {
       "title": "Land & Plots",
       "text": "DTCP & CMDA Approved Properties.",
       "link_text": "Learn More →",
       "link": "properties.html"
      },
      {
       "title": "Leasing",
       "text": "Residential and Commercial Leasing.",
       "link_text": "Learn More →",
       "link": "properties.html?transaction=lease"
      },
      {
       "title": "Joint Venture",
       "text": "Developer & Landowner Partnerships.",
       "link_text": "Learn More →",
       "link": "joint-venture.html"
      },
      {
       "title": "Property Advisory",
       "text": "Expert guidance for every stage of your property journey.",
       "link_text": "Learn More →",
       "link": "contact.html"
      },
      {
       "title": "NRI Services",
       "text": "Remote-friendly property solutions for NRI clients.",
       "link_text": "Learn More →",
       "link": "nri-services.html"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 1
   }
  ],
  "page_label": "Services",
  "hero_eyebrow": "WHAT WE OFFER",
  "hero_title": "Our Services",
  "hero_subtitle": "A complete range of real estate services in Chennai — from residential sales and commercial properties to land & plots, leasing, joint venture development, property advisory and dedicated NRI services. Whatever stage of your property journey you're at, Aventrix Realty is with you.",
  "seo_title": "Our Services | Aventrix Realty",
  "seo_description": "Explore Aventrix Realty's complete range of real estate services in Chennai — residential sales, commercial properties, land & plots, leasing, joint venture development, property advisory and NRI services.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/chennai-marina.jpg"
 },
 {
  "page_key": "properties",
  "sections": [],
  "page_label": "Properties (search page header)",
  "hero_eyebrow": "SEARCH PROPERTIES",
  "hero_title": "Find Your Next Property",
  "hero_subtitle": "Browse every published Aventrix Realty listing — filter by location, type, budget and more.",
  "seo_title": "Search Properties | Aventrix Realty",
  "seo_description": "Search Aventrix Realty's full property listings across Chennai — filter by location, type, buy or rent, price, bedrooms, bathrooms and area.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/chennai-marina.jpg"
 },
 {
  "page_key": "list-with-us",
  "sections": [
   {
    "key": "why-list",
    "label": "Why list with Aventrix (4 cards)",
    "eyebrow": "Property Owner Services",
    "heading": "Why List With Aventrix Realty?",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "number": "01",
       "title": "Wider Buyer Reach",
       "text": "Your property is presented to genuine buyers, tenants and investors actively looking across Chennai."
      },
      {
       "number": "02",
       "title": "Professional Marketing",
       "text": "Clear, well-organised property information helps your listing stand out and get noticed."
      },
      {
       "number": "03",
       "title": "End-to-End Support",
       "text": "From listing to closing, our team stays involved with you at every step of the process."
      },
      {
       "number": "04",
       "title": "Confidential Handling",
       "text": "Your property and contact details are handled discreetly and shared only with relevant parties."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 1
   },
   {
    "key": "owner-benefits",
    "label": "What you gain (6)",
    "eyebrow": "Owner Benefits",
    "heading": "What You Gain by Listing With Us",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "title": "Better Visibility",
       "text": "Your property gets proper presentation across our active buyer and tenant network."
      },
      {
       "title": "Relevant Connections",
       "text": "We match your property to buyers and tenants whose requirements genuinely fit."
      },
      {
       "title": "Professional Presentation",
       "text": "Clear property details and organised information make a stronger first impression."
      },
      {
       "title": "Sensible Market Positioning",
       "text": "We help position your property sensibly based on its location and category."
      },
      {
       "title": "Transaction Coordination",
       "text": "Our team coordinates communication and next steps through the process."
      },
      {
       "title": "Ongoing Owner Communication",
       "text": "You stay informed and involved throughout, through a single point of contact."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 2
   },
   {
    "key": "form-intro",
    "label": "Listing form (heading and intro)",
    "eyebrow": "",
    "heading": "Share Your Property Details",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "Tell us about your property and what you're looking to do with it — our team will review the details and get in touch to discuss the next steps. <br><br> <strong>🔒 Your information is kept confidential and used only for property-related communication.</strong>"
    },
    "hooks": [
     "heading"
    ],
    "display_order": 3
   },
   {
    "key": "property-types",
    "label": "Property types we handle (6)",
    "eyebrow": "Property Types",
    "heading": "Property Types We Handle",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "title": "Residential Properties",
       "text": "Homes for sale or rent, across a range of budgets and configurations."
      },
      {
       "title": "Commercial Properties",
       "text": "Office spaces, showrooms and commercial units suited for business use."
      },
      {
       "title": "Land & Plots",
       "text": "Residential and investment plots across Chennai and its surrounding areas."
      },
      {
       "title": "Independent Houses",
       "text": "Standalone homes suited for owners looking for more space and privacy."
      },
      {
       "title": "Apartments",
       "text": "Flats across a range of configurations, from compact homes to larger units."
      },
      {
       "title": "Joint Development Opportunities",
       "text": "Suitable land matched with development partners for joint development."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 4
   },
   {
    "key": "why-owners",
    "label": "Why owners work with us (6 cards)",
    "eyebrow": "Why Aventrix",
    "heading": "Why Property Owners Work With Us",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "number": "01",
       "title": "Real Estate Experience",
       "text": "Led by professionals with 15+ years of real estate experience in the Chennai market."
      },
      {
       "number": "02",
       "title": "Local Market Knowledge",
       "text": "A team familiar with Chennai's localities, property categories and buyer behaviour."
      },
      {
       "number": "03",
       "title": "Professional Property Marketing",
       "text": "Your property is presented clearly and professionally, every time."
      },
      {
       "number": "04",
       "title": "Buyer & Investor Network",
       "text": "Access to a network of buyers, tenants and investors actively engaging with our team."
      },
      {
       "number": "05",
       "title": "Transparent Communication",
       "text": "We keep you informed with honest, straightforward updates through the process."
      },
      {
       "number": "06",
       "title": "End-to-End Coordination",
       "text": "One team coordinates the process from your first enquiry to the final transaction."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 5
   },
   {
    "key": "listing-process",
    "label": "Listing process (5 steps)",
    "eyebrow": "How It Works",
    "heading": "Our Property Listing Process",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "number": "01",
       "title": "Share Your Property",
       "text": "Fill in your property and contact details through our simple listing form."
      },
      {
       "number": "02",
       "title": "Property Review",
       "text": "Our team reviews the information you've shared to understand your property better."
      },
      {
       "number": "03",
       "title": "Market Positioning",
       "text": "We consider your property's location, category and condition to position it sensibly."
      },
      {
       "number": "04",
       "title": "Buyer / Tenant Outreach",
       "text": "Your property is shared with relevant buyers, tenants or investors in our network."
      },
      {
       "number": "05",
       "title": "Transaction Coordination",
       "text": "We stay involved through discussions, follow-ups and the steps that follow."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 6
   },
   {
    "key": "situations",
    "label": "Common situations (6)",
    "eyebrow": "Common Situations",
    "heading": "Wherever You Are With Your Property, We Can Help",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "title": "Selling a Property",
       "text": "Looking to sell? We help you reach genuine buyers and manage the process end-to-end."
      },
      {
       "title": "Leasing a Property",
       "text": "Want to lease your property? We connect you with suitable tenants and coordinate the details."
      },
      {
       "title": "Managing an Investment Property",
       "text": "Own a property purely as an investment? We help you stay on top of its market position."
      },
      {
       "title": "Land or Plot Sale",
       "text": "Selling land or a plot? We help present it clearly to genuinely interested buyers."
      },
      {
       "title": "Joint Development Opportunity",
       "text": "Have land suited for development? We can discuss joint development possibilities with our partners."
      },
      {
       "title": "Property Advisory Requirement",
       "text": "Not sure of your next step? Our team can walk you through the options available to you."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 7
   },
   {
    "key": "owner-faq",
    "label": "Owner FAQs (7)",
    "eyebrow": "FAQ",
    "heading": "Questions Property Owners Ask",
    "html": "",
    "image_url": "",
    "lists": {
     "faqs": [
      {
       "question": "What information do I need to provide?",
       "answer": "<p>Basic contact details along with your property's type, location, area and what you're looking to do with it (sale, rental or joint venture). Anything else can be added under Additional Details.</p>"
      },
      {
       "question": "Can I list residential and commercial property?",
       "answer": "<p>Yes. Our form covers residential property types such as apartments, villas and independent houses, as well as commercial properties.</p>"
      },
      {
       "question": "Can you help with land and plots?",
       "answer": "<p>Yes, land and plots are among the property types we regularly assist with — for sale, investment or joint development purposes.</p>"
      },
      {
       "question": "How does property marketing work?",
       "answer": "<p>Once we understand your property, our team presents it clearly to genuine buyers, tenants or investors within our network, based on its category and location.</p>"
      },
      {
       "question": "Can I list a property for lease?",
       "answer": "<p>Yes — select \"Rental / Leasing\" under Listing Requirement in the form and our team will assist accordingly.</p>"
      },
      {
       "question": "Can you assist with joint development opportunities?",
       "answer": "<p>Yes. If your land may be suited for joint development, select \"Joint Venture\" in the form and our team will discuss the possibilities with you.</p>"
      },
      {
       "question": "What happens after I submit my property?",
       "answer": "<p>Our team reviews the details you've shared and gets in touch to discuss your property and the next steps.</p>"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 8
   },
   {
    "key": "final-cta",
    "label": "Closing call to action",
    "eyebrow": "",
    "heading": "Let's Talk About Your Property",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "Share your property details and our team will get in touch to discuss the best way forward.",
     "button_text": "List Your Property",
     "link": "#owner-form"
    },
    "hooks": [
     "heading"
    ],
    "display_order": 9
   }
  ],
  "page_label": "List With Us",
  "hero_eyebrow": "PROPERTY OWNER SERVICES",
  "hero_title": "Reach the Right Buyers<br> for Your Property",
  "hero_subtitle": "List your property with Aventrix Realty and get professional marketing, wider exposure and dedicated support — from the first enquiry through to the transaction.",
  "hero_button_text": "List Your Property",
  "hero_button_link": "#owner-form",
  "seo_title": "List with Us | Aventrix Realty",
  "seo_description": "List your property for free with Aventrix Realty — reach verified buyers and tenants across Chennai with expert marketing and advisory support.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/chennai-marina.jpg"
 },
 {
  "page_key": "free-valuation",
  "sections": [
   {
    "key": "why-valuation",
    "label": "Why choose a valuation (4 cards)",
    "eyebrow": "Property Valuation",
    "heading": "Why Choose a Property Valuation?",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "number": "01",
       "title": "Current Market Estimate",
       "text": "Understand where your property stands today, based on its location, characteristics and current market conditions."
      },
      {
       "number": "02",
       "title": "Confident Decisions",
       "text": "Get a clearer market perspective before deciding to sell, rent or hold on to your property."
      },
      {
       "number": "03",
       "title": "Future Property Potential",
       "text": "Understand how your property's location and category may support future opportunities."
      },
      {
       "number": "04",
       "title": "Professional Guidance",
       "text": "Our team reviews your property details and shares practical, experience-based guidance."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 1
   },
   {
    "key": "valuation-benefits",
    "label": "What a valuation helps you understand (6)",
    "eyebrow": "Valuation Benefits",
    "heading": "What a Valuation Helps You Understand",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "title": "Indicative Market Value",
       "text": "A general sense of where your property may stand in today's market conditions."
      },
      {
       "title": "Location & Market Context",
       "text": "How the surrounding neighbourhood and nearby developments shape your property's position."
      },
      {
       "title": "Property-Specific Factors",
       "text": "How size, age, layout and current condition influence your property's standing."
      },
      {
       "title": "Rental & Leasing Perspective",
       "text": "Where relevant, a sense of how your property may perform in the rental market."
      },
      {
       "title": "Development & Future Potential",
       "text": "Where applicable, how your land may support future development or joint venture opportunities."
      },
      {
       "title": "A Clear Starting Point",
       "text": "A simple, practical foundation to help you plan your property's next step."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 2
   },
   {
    "key": "form-intro",
    "label": "Valuation form (heading and intro)",
    "eyebrow": "",
    "heading": "Share Your Property Details",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "Tell us about your property and our team will review the information to understand its market position. <br><br> <strong> 🔒 Your information is kept confidential and used only for valuation purposes. </strong>"
    },
    "hooks": [
     "heading"
    ],
    "display_order": 3
   },
   {
    "key": "valuation-includes",
    "label": "What your valuation includes (5 cards)",
    "eyebrow": "What You Receive",
    "heading": "What Your Valuation Includes",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "number": "01",
       "title": "Market Value Perspective",
       "text": "An indicative view of your property's current position in the market."
      },
      {
       "number": "02",
       "title": "Location & Demand Insight",
       "text": "An understanding of how your property's location and category influence buyer or tenant interest."
      },
      {
       "number": "03",
       "title": "Property Condition Review",
       "text": "A look at how your property's size, age and condition affect its standing."
      },
      {
       "number": "04",
       "title": "Suitable Next Steps",
       "text": "Practical suggestions on how to move forward, whether selling, renting or holding."
      },
      {
       "number": "05",
       "title": "Professional Guidance",
       "text": "Direct guidance from our team to help you plan with clarity."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 4
   },
   {
    "key": "valuation-process",
    "label": "Our valuation process (4 steps)",
    "eyebrow": "How It Works",
    "heading": "Our Valuation Process",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "number": "01",
       "title": "Submit Property Information",
       "text": "Fill out the property valuation form with your contact and property details."
      },
      {
       "number": "02",
       "title": "Team Review",
       "text": "Our team reviews the details you've shared along with your property's location and category."
      },
      {
       "number": "03",
       "title": "Market Assessment",
       "text": "We assess relevant market conditions and trends for your property's area."
      },
      {
       "number": "04",
       "title": "Receive Guidance",
       "text": "You receive a clear market perspective along with practical guidance from our team."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 5
   },
   {
    "key": "who-for",
    "label": "Who is this for",
    "eyebrow": "Who We Help",
    "heading": "Who Is This For?",
    "html": "",
    "image_url": "",
    "lists": {
     "tags": [
      {
       "label": "Property Owners"
      },
      {
       "label": "Sellers"
      },
      {
       "label": "Landowners"
      },
      {
       "label": "Investors"
      },
      {
       "label": "Landlords"
      },
      {
       "label": "Developers"
      },
      {
       "label": "NRI Property Owners"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 6
   },
   {
    "key": "final-cta",
    "label": "Closing call to action",
    "eyebrow": "",
    "heading": "Understand Your Property's Market Position",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "Start with your property details and let our team help you understand its current market perspective.",
     "button_text": "Request Property Valuation",
     "link": "#valuation-form"
    },
    "hooks": [
     "heading"
    ],
    "display_order": 7
   }
  ],
  "page_label": "Free Property Valuation",
  "hero_eyebrow": "FREE PROPERTY VALUATION",
  "hero_title": "Know Your Property.<br> Plan With Confidence.",
  "hero_subtitle": "Get a professional view of your property's current market position, based on its location, property characteristics and relevant market conditions.",
  "hero_button_text": "Request Property Valuation",
  "hero_button_link": "#valuation-form",
  "seo_title": "Free Property Valuation | Aventrix Realty",
  "seo_description": "Request a free property valuation from Aventrix Realty. Our Chennai property experts review your land, apartment, villa or commercial property to share its current market position.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/chennai-marina.jpg"
 },
 {
  "page_key": "joint-venture",
  "sections": [
   {
    "key": "what-is-jv",
    "label": "What is a Joint Venture",
    "eyebrow": "The Basics",
    "heading": "What Is a Joint Venture?",
    "html": "",
    "image_url": "",
    "fields": {
     "lead": "A Joint Venture is a development arrangement in which a landowner contributes the property, or agreed development rights, and a development partner takes on agreed development responsibilities. The commercial benefits are then shared according to terms both parties agree to.",
     "text": "It allows a landowner to take part in the development of their property without having to undertake the entire development process on their own. What each party contributes, and what each party receives, is set out in the Joint Venture agreement."
    },
    "lists": {
     "flow": [
      {
       "title": "Landowner",
       "note": "Owns the property"
      },
      {
       "title": "Land / Agreed Development Rights",
       "note": "Contributed to the project"
      },
      {
       "title": "Joint Venture Agreement",
       "note": "Sets out terms and responsibilities"
      },
      {
       "title": "Development Partner",
       "note": "Undertakes agreed responsibilities"
      },
      {
       "title": "Project Development",
       "note": "Planning, approvals and construction"
      },
      {
       "title": "Agreed Entitlement / Benefit",
       "note": "Delivered as per the agreement"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 1
   },
   {
    "key": "why-jv",
    "label": "Why consider a Joint Venture",
    "eyebrow": "Why Consider a Joint Venture?",
    "heading": "Your Land Can Do More Than Simply Remain an Asset",
    "html": "",
    "image_url": "",
    "fields": {
     "lead": "Not every landowner wants an outright sale. Some would rather take part in what their land can become, through a development arrangement shaped around their own priorities.",
     "note": "What is possible depends on the property, the project and the terms agreed. Returns and appreciation are not guaranteed.",
     "list_label": "Depending on the arrangement, a Joint Venture may allow you to:"
    },
    "lists": {
     "benefits": [
      {
       "text": "Retain developed property"
      },
      {
       "text": "Receive an agreed share of developed units or area"
      },
      {
       "text": "Partially monetise your entitlement"
      },
      {
       "text": "Combine property entitlement with financial consideration"
      },
      {
       "text": "Hold developed units as a long-term investment"
      },
      {
       "text": "Work with a development partner instead of developing on your own"
      },
      {
       "text": "Explore redevelopment of an existing property"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 2
   },
   {
    "key": "structures",
    "label": "Your land, your structure (6 options)",
    "eyebrow": "Flexible Structures",
    "heading": "Your Land. Your Objective. Your Structure.",
    "html": "",
    "image_url": "",
    "fields": {
     "subhead": "There is no one-size-fits-all Joint Venture structure.",
     "intro": "Every landowner starts with a different objective. Depending on the project structure, feasibility and mutually agreed terms, the arrangement can be shaped in different ways.",
     "footnote": "Not every structure is available for every property. What is possible depends on feasibility and the terms agreed between the parties."
    },
    "lists": {
     "options": [
      {
       "letter": "A",
       "title": "Retain Developed Property",
       "text": "Receive your entitlement as developed units or area and keep them, for your family's use or for the future."
      },
      {
       "letter": "B",
       "title": "Partial Monetisation",
       "text": "Retain part of your entitlement and sell another part, where the project structure allows it."
      },
      {
       "letter": "C",
       "title": "Property + Financial Consideration",
       "text": "A combination of developed property and a financial component, subject to the terms agreed with the development partner."
      },
      {
       "letter": "D",
       "title": "Long-Term Holding",
       "text": "Hold developed units as a long-term asset, for your own use or for rental, depending on your plans."
      },
      {
       "letter": "E",
       "title": "Redevelopment",
       "text": "For older buildings or under-used properties, explore whether redevelopment is feasible and what it could involve."
      },
      {
       "letter": "F",
       "title": "Custom Project Structure",
       "text": "Where several owners, larger parcels or specific objectives are involved, the structure can be tailored to the project, subject to feasibility."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 3
   },
   {
    "key": "our-role",
    "label": "What Aventrix Realty does (9 roles)",
    "eyebrow": "Our Role",
    "heading": "We Help Structure the Opportunity",
    "html": "",
    "image_url": "",
    "fields": {
     "intro": "Aventrix Realty works as an advisory and transaction coordination partner. We do not develop every project ourselves. Our role is to understand your property and your objective, and to coordinate the process with the right people.",
     "disclaimer": "Aventrix Realty does not provide legal, tax or technical advice. Legal, technical, tax and statutory matters should be reviewed by qualified professionals."
    },
    "lists": {
     "roles": [
      {
       "number": "01",
       "title": "Property Understanding",
       "text": "Location, extent, access and the current state of the property."
      },
      {
       "number": "02",
       "title": "Landowner Objective Assessment",
       "text": "What you want from the property, and what matters most to you."
      },
      {
       "number": "03",
       "title": "Preliminary Development Opportunity Assessment",
       "text": "An initial view of how the property could potentially be developed."
      },
      {
       "number": "04",
       "title": "Development Partner Identification",
       "text": "Identifying development partners whose capability suits the property."
      },
      {
       "number": "05",
       "title": "Commercial Discussion Coordination",
       "text": "Organising and following through on discussions between the parties."
      },
      {
       "number": "06",
       "title": "Negotiation Coordination",
       "text": "Helping both sides work through the commercial terms."
      },
      {
       "number": "07",
       "title": "Due-Diligence Coordination",
       "text": "Coordinating document collection and reviews with the relevant professionals."
      },
      {
       "number": "08",
       "title": "Documentation Coordination",
       "text": "Coordinating with legal professionals as the agreement is prepared."
      },
      {
       "number": "09",
       "title": "Project / Marketing Coordination",
       "text": "Where applicable, coordination support as the project moves forward."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 4
   },
   {
    "key": "development-partner",
    "label": "What the development partner may bring",
    "eyebrow": "Roles in a Joint Venture",
    "heading": "What the Development Partner May Bring",
    "html": "",
    "image_url": "",
    "fields": {
     "intro": "The exact responsibilities of the development partner are defined by the project structure and final agreement.",
     "owner_label": "The landowner typically contributes",
     "partner_label": "Depending on the agreed structure, the development partner may bring"
    },
    "lists": {
     "owner_contributes": [
      {
       "text": "The land or agreed development rights"
      },
      {
       "text": "Ownership and title documents"
      },
      {
       "text": "Consent of all relevant owners"
      },
      {
       "text": "Cooperation as set out in the agreement"
      }
     ],
     "partner_brings": [
      {
       "text": "Project planning"
      },
      {
       "text": "Architectural coordination"
      },
      {
       "text": "Approval coordination"
      },
      {
       "text": "Project funding / financial arrangements"
      },
      {
       "text": "Construction execution"
      },
      {
       "text": "Contractor management"
      },
      {
       "text": "Consultant coordination"
      },
      {
       "text": "Project management"
      },
      {
       "text": "Marketing and sales"
      },
      {
       "text": "Project completion"
      },
      {
       "text": "Handover"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 5
   },
   {
    "key": "commercial-structures",
    "label": "Commercial structures (4) and factors",
    "eyebrow": "Commercial Terms",
    "heading": "Commercial Structures Are Project-Specific",
    "html": "",
    "image_url": "",
    "fields": {
     "intro": "How the benefits of a Joint Venture are shared is decided project by project. Common approaches include:",
     "factors_label": "Commercial terms depend on factors such as",
     "note": "There is no standard sharing ratio. Any ratio is arrived at through feasibility and negotiation, and is set out in the final agreement."
    },
    "lists": {
     "structures": [
      {
       "letter": "A",
       "title": "Development / Area / Unit Share",
       "text": "The landowner receives an agreed share of the developed area or units, and the development partner retains the rest."
      },
      {
       "letter": "B",
       "title": "Revenue Share",
       "text": "The parties share the sale proceeds of the project in agreed proportions, instead of dividing the built area."
      },
      {
       "letter": "C",
       "title": "Property + Financial Consideration",
       "text": "The landowner receives developed property along with an agreed financial component."
      },
      {
       "letter": "D",
       "title": "Hybrid Structure",
       "text": "A combination of the above, shaped around the property and the objectives of both parties."
      }
     ],
     "factors": [
      {
       "text": "Land value"
      },
      {
       "text": "Location"
      },
      {
       "text": "Land extent"
      },
      {
       "text": "Development potential"
      },
      {
       "text": "Project size"
      },
      {
       "text": "Construction cost"
      },
      {
       "text": "Funding requirements"
      },
      {
       "text": "Development risk"
      },
      {
       "text": "Responsibilities of each party"
      },
      {
       "text": "Market conditions"
      },
      {
       "text": "Negotiation between the parties"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 6
   },
   {
    "key": "before-you-agree",
    "label": "Before you agree (15 points)",
    "eyebrow": "Before You Agree",
    "heading": "Look Beyond the Share Percentage",
    "html": "",
    "image_url": "",
    "fields": {
     "quote": "The important question is not only “What percentage do I receive?” but “What exactly am I receiving, what responsibilities apply to each party, and under what conditions will the entitlement be delivered?”",
     "list_label": "Points a landowner should understand clearly"
    },
    "lists": {
     "points": [
      {
       "text": "What exactly you contribute"
      },
      {
       "text": "What exactly you receive"
      },
      {
       "text": "Unit or area entitlement"
      },
      {
       "text": "Construction responsibilities"
      },
      {
       "text": "Project funding"
      },
      {
       "text": "Approval responsibilities"
      },
      {
       "text": "Cost allocation"
      },
      {
       "text": "Taxes and statutory charges"
      },
      {
       "text": "Project timeline"
      },
      {
       "text": "Sales responsibilities"
      },
      {
       "text": "Delay provisions"
      },
      {
       "text": "Default provisions"
      },
      {
       "text": "Exit and termination provisions"
      },
      {
       "text": "Handover terms"
      },
      {
       "text": "Documentation"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 7
   },
   {
    "key": "your-objective",
    "label": "We start with your objective (8)",
    "eyebrow": "Your Priorities",
    "heading": "We Start With Your Objective",
    "html": "",
    "image_url": "",
    "fields": {
     "intro": "Two landowners with similar plots can want very different things. Before discussing any structure, we take time to understand what you actually want from your property."
    },
    "lists": {
     "objectives": [
      {
       "title": "Maximum Value Exploration",
       "text": "Understanding what the land could achieve through development."
      },
      {
       "title": "Property Retention",
       "text": "Keeping developed property within the family."
      },
      {
       "title": "Partial Sale / Monetisation",
       "text": "Selling part of the entitlement and retaining the rest."
      },
      {
       "title": "Long-Term Investment",
       "text": "Holding developed units for the years ahead."
      },
      {
       "title": "Liquidity Requirement",
       "text": "Needing funds at a particular stage."
      },
      {
       "title": "Hands-Off Development",
       "text": "Taking part without managing the development yourself."
      },
      {
       "title": "Family-Owned or Jointly Owned Property",
       "text": "Bringing several owners to a shared decision."
      },
      {
       "title": "Redevelopment",
       "text": "Giving an older building or under-used plot a new purpose."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 8
   },
   {
    "key": "ownership-and-verification",
    "label": "Multiple owners / Due diligence",
    "eyebrow": "",
    "heading": "",
    "html": "",
    "image_url": "",
    "fields": {
     "disclaimer": "Aventrix Realty facilitates coordination. Legal, title, technical, tax and statutory matters should be independently reviewed by appropriately qualified professionals."
    },
    "lists": {
     "panels": [
      {
       "eyebrow": "Shared Ownership",
       "title": "When a Property Has Multiple Owners",
       "text": "Many properties are held by families or by several co-owners. In such cases, a few additional points need to be addressed as discussions move forward:",
       "points": "<li>Ownership interests</li> <li>Consent of all relevant owners</li> <li>Distribution of entitlement</li> <li>Decision-making</li> <li>Authority to negotiate</li> <li>Documentation</li> <li>Succession or legal considerations, where applicable</li>"
      },
      {
       "eyebrow": "Due Diligence",
       "title": "Before Development Comes Verification",
       "text": "Before any development commitment is made, the property needs to be reviewed carefully. This typically covers:",
       "points": "<li>Title and ownership</li> <li>Encumbrances</li> <li>Survey and measurements</li> <li>Access</li> <li>Existing structures</li> <li>Existing occupants or tenants, where applicable</li> <li>Planning and development parameters</li> <li>Existing liabilities</li> <li>Other project-specific matters</li>"
      }
     ]
    },
    "hooks": [],
    "display_order": 9
   },
   {
    "key": "jv-process",
    "label": "From land to development (9 steps)",
    "eyebrow": "The Process",
    "heading": "From Land to Development",
    "html": "",
    "image_url": "",
    "fields": {
     "intro": "A typical sequence. The time each stage takes depends on the property, the parties and the project."
    },
    "lists": {
     "steps": [
      {
       "number": "01",
       "title": "Submit Your Property"
      },
      {
       "number": "02",
       "title": "Understand Your Objective"
      },
      {
       "number": "03",
       "title": "Preliminary Property Assessment"
      },
      {
       "number": "04",
       "title": "Explore Development Options"
      },
      {
       "number": "05",
       "title": "Development Partner Discussion"
      },
      {
       "number": "06",
       "title": "Commercial Negotiation"
      },
      {
       "number": "07",
       "title": "Due Diligence"
      },
      {
       "number": "08",
       "title": "Documentation"
      },
      {
       "number": "09",
       "title": "Development"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 10
   },
   {
    "key": "alignment",
    "label": "Alignment before agreement",
    "eyebrow": "What Makes a Joint Venture Work",
    "heading": "Alignment Before Agreement",
    "html": "",
    "image_url": "",
    "fields": {
     "intro": "A Joint Venture is more likely to move forward smoothly when these elements are aligned before the agreement is signed.",
     "result": "A Structured Development Opportunity"
    },
    "lists": {
     "elements": [
      {
       "label": "Landowner",
       "value": "Expectations"
      },
      {
       "label": "Development Partner",
       "value": "Capability"
      },
      {
       "label": "Property",
       "value": "Development Potential"
      },
      {
       "label": "Project Economics",
       "value": "Commercial Viability"
      },
      {
       "label": "Documentation",
       "value": "Clear Responsibilities"
      },
      {
       "label": "Execution",
       "value": "Timelines & Accountability"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 11
   },
   {
    "key": "why-aventrix",
    "label": "Why Aventrix Realty (6 principles)",
    "eyebrow": "Our Approach",
    "heading": "Why Aventrix Realty?",
    "html": "",
    "image_url": "",
    "fields": {
     "intro": "We focus on understanding the property and the landowner's objective before exploring suitable development opportunities."
    },
    "lists": {
     "principles": [
      {
       "title": "Property First",
       "text": "We start with the land itself: its location, extent, access and potential."
      },
      {
       "title": "Objective Driven",
       "text": "Your objective shapes which development routes are worth exploring."
      },
      {
       "title": "Partner Focused",
       "text": "We look for development partners whose capability suits the property."
      },
      {
       "title": "Transparent Discussions",
       "text": "Terms, responsibilities and open questions are discussed openly with you."
      },
      {
       "title": "Professional Coordination",
       "text": "We coordinate with legal, technical and other professionals where needed."
      },
      {
       "title": "Project Specific",
       "text": "Every property is assessed on its own merits, not through a fixed formula."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 12
   },
   {
    "key": "who-can-approach",
    "label": "Who can approach us",
    "eyebrow": "Who Can Approach Us",
    "heading": "Have Land With Development Potential?",
    "html": "",
    "image_url": "",
    "fields": {
     "intro": "We welcome enquiries from owners of:",
     "note": "Every property is subject to preliminary evaluation and project feasibility."
    },
    "lists": {
     "owners": [
      {
       "text": "Residential development land"
      },
      {
       "text": "Large land parcels"
      },
      {
       "text": "Commercial development properties"
      },
      {
       "text": "Redevelopment opportunities"
      },
      {
       "text": "Strategic properties"
      },
      {
       "text": "Family-owned properties"
      },
      {
       "text": "Jointly owned properties"
      },
      {
       "text": "Existing properties requiring redevelopment"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 13
   },
   {
    "key": "jv-faq",
    "label": "Joint Venture FAQs (10)",
    "eyebrow": "Questions",
    "heading": "Joint Venture FAQs",
    "html": "",
    "image_url": "",
    "lists": {
     "faqs": [
      {
       "question": "Do I have to sell my land to enter a Joint Venture?",
       "answer": "<p>Not necessarily. In a Joint Venture, the landowner contributes the land or agreed development rights in return for an agreed entitlement, instead of an outright sale. How ownership and rights are dealt with is set out in the agreement and should be reviewed with your legal adviser.</p>"
      },
      {
       "question": "Can I retain some of the developed property?",
       "answer": "<p>Depending on the project structure and the terms agreed, a landowner may receive their entitlement as developed units or area and retain them.</p>"
      },
      {
       "question": "Can I sell part of my entitlement?",
       "answer": "<p>In some structures, yes. Whether, and when, part of an entitlement can be sold depends on the agreement and the project.</p>"
      },
      {
       "question": "Is the sharing ratio always 50:50?",
       "answer": "<p>No. There is no standard ratio. The share depends on factors such as land value, location, development potential, construction cost, funding and the responsibilities of each party, and is settled through negotiation.</p>"
      },
      {
       "question": "Does Aventrix Realty construct the project?",
       "answer": "<p>No. Aventrix Realty works as an advisory and coordination partner. Construction and other development responsibilities are undertaken by the development partner, as defined in the final agreement.</p>"
      },
      {
       "question": "How long does a Joint Venture take?",
       "answer": "<p>It varies. Assessment, partner discussions, due diligence, documentation, approvals and construction each take time, and the overall timeline depends on the property and the project. Agreed timelines are recorded in the agreement.</p>"
      },
      {
       "question": "Can multiple family members jointly approach Aventrix Realty?",
       "answer": "<p>Yes. Co-owners can approach us together. Consent of all relevant owners, authority to negotiate and the distribution of entitlement will need to be addressed as discussions progress.</p>"
      },
      {
       "question": "Will every property qualify for a Joint Venture?",
       "answer": "<p>No. Every property is subject to preliminary evaluation and project feasibility. Title, access, extent, location and development parameters all affect whether a Joint Venture is practical.</p>"
      },
      {
       "question": "Who handles legal documentation?",
       "answer": "<p>Legal documentation should be prepared and reviewed by qualified legal professionals. Aventrix Realty coordinates between the parties and the professionals involved, but does not provide legal advice.</p>"
      },
      {
       "question": "How is the final commercial structure decided?",
       "answer": "<p>Through discussion and negotiation between the landowner and the development partner, based on feasibility, the landowner's objective and the responsibilities of each party. The agreed terms are then recorded in the final agreement.</p>"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 14
   },
   {
    "key": "final-cta",
    "label": "Closing call to action",
    "eyebrow": "",
    "heading": "Your Land Has Potential. Let's Explore It.",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "Whether you are looking to develop, retain, monetise or explore the possibilities of your property, Aventrix Realty can help you understand potential development routes and coordinate suitable opportunities."
    },
    "lists": {
     "buttons": [
      {
       "text": "Discuss Your Property",
       "link": "https://wa.me/919176887770"
      },
      {
       "text": "Submit Your Land",
       "link": "#joint-form"
      }
     ]
    },
    "hooks": [
     "heading"
    ],
    "display_order": 15
   },
   {
    "key": "form-intro",
    "label": "Enquiry form (heading and intro)",
    "eyebrow": "",
    "heading": "Let's Discuss Your Property",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "Tell us about your property and your development objective. Our team will review the information and contact you to discuss the next steps."
    },
    "hooks": [
     "heading"
    ],
    "display_order": 16
   }
  ],
  "page_label": "Joint Venture",
  "hero_eyebrow": "JOINT VENTURE & DEVELOPMENT SOLUTIONS",
  "hero_title": "Turn Your Land Into a Development Opportunity",
  "hero_subtitle": "Explore Joint Venture and development opportunities with Aventrix Realty. We help landowners understand their objectives, identify suitable development opportunities and coordinate discussions with potential development partners.",
  "hero_button_text": "Discuss Your Property",
  "hero_button_link": "https://wa.me/919176887770",
  "seo_title": "Joint Venture & Development Solutions in Chennai | Aventrix Realty",
  "seo_description": "Joint Venture and development options for land in Chennai. Aventrix Realty helps landowners assess their objectives and coordinate with development partners.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/chennai-marina.jpg"
 },
 {
  "page_key": "nri-services",
  "sections": [
   {
    "key": "local-support",
    "label": "Local support while overseas (5)",
    "eyebrow": "Local Presence",
    "heading": "Local Support While You're Overseas",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "title": "Local Coordination",
       "text": "Our Chennai-based team handles the on-ground parts of your property matter on your behalf."
      },
      {
       "title": "Regular Communication",
       "text": "You stay updated through calls, messages or email, in whichever way suits you."
      },
      {
       "title": "Property Visits, Where Applicable",
       "text": "Our team can visit your property or arrange viewings when required."
      },
      {
       "title": "Local Market Understanding",
       "text": "We keep track of local conditions relevant to your property's category and location."
      },
      {
       "title": "Transaction Support",
       "text": "From documentation coordination to closing, we stay involved through the process."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 1
   },
   {
    "key": "how-we-help",
    "label": "How Aventrix helps NRIs (6 cards)",
    "eyebrow": "How We Help",
    "heading": "How Aventrix Helps NRIs",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "number": "01",
       "title": "Property Purchase Assistance",
       "text": "Guidance and support if you're looking to buy property in Chennai."
      },
      {
       "number": "02",
       "title": "Property Sale Support",
       "text": "Help presenting and positioning your property for sale, on your behalf."
      },
      {
       "number": "03",
       "title": "Rental / Leasing Assistance",
       "text": "Support finding suitable tenants and managing the leasing process."
      },
      {
       "number": "04",
       "title": "Property Management Coordination",
       "text": "Coordination for the upkeep and oversight of your property while you're away."
      },
      {
       "number": "05",
       "title": "Investment Guidance",
       "text": "General guidance on property options that suit your investment goals."
      },
      {
       "number": "06",
       "title": "Documentation & Transaction Coordination",
       "text": "Coordination of paperwork and communication through the transaction process."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 2
   },
   {
    "key": "form-intro",
    "label": "Enquiry form (heading and intro)",
    "eyebrow": "",
    "heading": "Share Your Property Requirement",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "Tell us what you need — buying, selling, leasing or managing a property — and our team will get in touch to discuss the next steps. <br><br> <strong>🔒 Your information is kept confidential and used only for property-related communication.</strong>"
    },
    "hooks": [
     "heading"
    ],
    "display_order": 3
   },
   {
    "key": "categories",
    "label": "Property categories we assist with",
    "eyebrow": "Property Categories",
    "heading": "Property Categories We Assist With",
    "html": "",
    "image_url": "",
    "lists": {
     "tags": [
      {
       "label": "Residential Properties"
      },
      {
       "label": "Commercial Properties"
      },
      {
       "label": "Land & Plots"
      },
      {
       "label": "Independent Houses"
      },
      {
       "label": "Apartments"
      },
      {
       "label": "Joint Development Opportunities"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 4
   },
   {
    "key": "why-local",
    "label": "Why NRIs choose local support (5)",
    "eyebrow": "Why It Helps",
    "heading": "Why NRIs Choose Local Support",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "title": "Fewer Trips Required",
       "text": "With a local team handling coordination, you don't need to travel for every step, where applicable."
      },
      {
       "title": "Consistent Updates",
       "text": "You're kept informed at each stage, instead of having to follow up repeatedly yourself."
      },
      {
       "title": "Local Visibility",
       "text": "Your property gets proper visibility in the local market, even while you're away."
      },
      {
       "title": "Prompt Attention to Local Matters",
       "text": "Property-related tasks that need someone on the ground are handled without unnecessary delay."
      },
      {
       "title": "Single Point of Contact",
       "text": "One team coordinates communication, so you're not juggling multiple contacts."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 5
   },
   {
    "key": "getting-started",
    "label": "Getting started (5 steps)",
    "eyebrow": "How It Works",
    "heading": "Getting Started as an NRI Client",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "number": "01",
       "title": "Share Your Requirement",
       "text": "Tell us what you need — whether it's buying, selling, leasing or managing a property."
      },
      {
       "number": "02",
       "title": "Understand Your Property Need",
       "text": "Our team reviews your requirement to understand what matters most to you."
      },
      {
       "number": "03",
       "title": "Local Market / Property Review",
       "text": "We assess the relevant property or market context on the ground in Chennai."
      },
      {
       "number": "04",
       "title": "Coordinate Visits / Discussions",
       "text": "Where needed, we arrange property visits or discussions on your behalf."
      },
      {
       "number": "05",
       "title": "Support the Transaction",
       "text": "We stay involved through documentation, communication and the steps that follow."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 6
   },
   {
    "key": "nri-faq",
    "label": "NRI FAQs (6)",
    "eyebrow": "FAQ",
    "heading": "Questions NRI Clients Ask",
    "html": "",
    "image_url": "",
    "lists": {
     "faqs": [
      {
       "question": "Can NRIs buy property in Chennai?",
       "answer": "<p>Yes, NRIs can generally purchase most types of residential and commercial property in India, subject to RBI and FEMA guidelines. As rules can depend on individual circumstances, we recommend confirming specifics with a qualified legal or tax professional alongside our support.</p>"
      },
      {
       "question": "Can Aventrix help an NRI sell property?",
       "answer": "<p>Yes. We help present your property to genuine buyers and coordinate the process on your behalf, from a distance.</p>"
      },
      {
       "question": "Can you assist with rental requirements?",
       "answer": "<p>Yes, we assist NRI owners with finding suitable tenants and coordinating the leasing process.</p>"
      },
      {
       "question": "Can you coordinate property-related activities locally?",
       "answer": "<p>Yes. Our Chennai-based team can coordinate visits, documentation and other on-ground requirements where applicable.</p>"
      },
      {
       "question": "How can an NRI start a property enquiry?",
       "answer": "<p>Simply fill in the form above with your requirement and contact details, and our team will get in touch with you.</p>"
      },
      {
       "question": "What information should I provide?",
       "answer": "<p>Your contact details, what you need help with (buying, selling, leasing, management or investment), and any relevant property details you already have.</p>"
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 7
   },
   {
    "key": "final-cta",
    "label": "Closing call to action",
    "eyebrow": "",
    "heading": "Stay Connected to Your Property in Chennai",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "Share your requirement and our team will get in touch to help you take the next step, wherever you are.",
     "button_text": "Start Your NRI Property Enquiry",
     "link": "#owner-form"
    },
    "hooks": [
     "heading"
    ],
    "display_order": 8
   }
  ],
  "page_label": "NRI Services",
  "hero_eyebrow": "NRI PROPERTY SERVICES",
  "hero_title": "Your Property in Chennai,<br> Supported From Anywhere",
  "hero_subtitle": "Aventrix Realty helps NRIs buy, sell, lease and manage property in Chennai and Tamil Nadu — with a local team handling the details on the ground.",
  "hero_button_text": "Start Your NRI Enquiry",
  "hero_button_link": "#owner-form",
  "seo_title": "NRI Services | Aventrix Realty",
  "seo_description": "Remote-friendly real estate services for NRIs from Aventrix Realty — virtual property tours, documentation support, power-of-attorney coordination and end-to-end transaction assistance in Chennai.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/chennai-marina.jpg"
 },
 {
  "page_key": "brokerage-fees",
  "sections": [
   {
    "key": "fees-intro",
    "label": "Every assignment is different",
    "eyebrow": "Our Approach",
    "heading": "Every Property Assignment Is Different",
    "html": "",
    "image_url": "",
    "fields": {
     "lead": "A residential purchase, a land transaction, a commercial lease and a Joint Venture assignment can each involve very different levels of work, coordination and responsibility.",
     "text": "That is why Aventrix Realty does not apply one fixed fee to every assignment. We first understand your requirement, define the scope of our involvement, and then agree the applicable professional fee, commonly referred to as brokerage, with you."
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 1
   },
   {
    "key": "fees-factors",
    "label": "What shapes the fee (5 cards)",
    "eyebrow": "What We Consider",
    "heading": "What Shapes the Fee",
    "html": "",
    "image_url": "",
    "lists": {
     "items": [
      {
       "number": "01",
       "title": "Nature of Transaction",
       "text": "Buying, selling, leasing, land, Joint Venture or advisory assignments."
      },
      {
       "number": "02",
       "title": "Property & Transaction Value",
       "text": "The type and value of the property, and of the transaction."
      },
      {
       "number": "03",
       "title": "Scope of Work",
       "text": "The services required and the level of our involvement."
      },
      {
       "number": "04",
       "title": "Complexity",
       "text": "The stakeholders, documentation, negotiations and coordination involved."
      },
      {
       "number": "05",
       "title": "Professional Involvement",
       "text": "The time, expertise and transaction support the assignment calls for."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 2
   },
   {
    "key": "fees-services",
    "label": "Our real estate services (7 rows)",
    "eyebrow": "What We Do",
    "heading": "Our Real Estate Services",
    "html": "",
    "image_url": "",
    "fields": {
     "note": "Professional fees are applicable based on the nature and scope of the assignment."
    },
    "lists": {
     "services": [
      {
       "title": "Buying",
       "text": "Property search, evaluation and transaction support."
      },
      {
       "title": "Selling",
       "text": "Property positioning, buyer engagement and negotiation support."
      },
      {
       "title": "Leasing",
       "text": "Residential and commercial leasing assistance."
      },
      {
       "title": "Land & Plots",
       "text": "Land transactions, opportunity assessment and coordination."
      },
      {
       "title": "Joint Ventures",
       "text": "Coordination between landowners and developers on development opportunities."
      },
      {
       "title": "NRI Property Services",
       "text": "Remote property assistance and transaction coordination."
      },
      {
       "title": "Property Advisory",
       "text": "Requirement-based guidance for property decisions."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 3
   },
   {
    "key": "fees-process",
    "label": "How we agree your fee (4 steps)",
    "eyebrow": "The Process",
    "heading": "How We Agree Your Fee",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "The same four steps apply to every assignment, whatever its size."
    },
    "lists": {
     "steps": [
      {
       "number": "01",
       "title": "Understand",
       "text": "We understand your property, requirement and objectives."
      },
      {
       "number": "02",
       "title": "Define",
       "text": "We establish the scope of our involvement and the services required."
      },
      {
       "number": "03",
       "title": "Agree",
       "text": "The applicable professional fee, payment terms and applicable taxes are discussed and confirmed."
      },
      {
       "number": "04",
       "title": "Proceed",
       "text": "We begin the assignment once the terms are mutually agreed."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 4
   },
   {
    "key": "fees-commitment",
    "label": "Our commitment (4 points)",
    "eyebrow": "What You Can Expect",
    "heading": "Our Commitment",
    "html": "",
    "image_url": "",
    "lists": {
     "points": [
      {
       "title": "Clear Communication",
       "text": "You will know the applicable fee before we proceed."
      },
      {
       "title": "Written Terms",
       "text": "The agreed fee and payment terms are clearly documented where applicable."
      },
      {
       "title": "No Unexpected Changes",
       "text": "The agreed fee does not change unless the scope changes and revised terms are mutually agreed."
      },
      {
       "title": "Professional Transparency",
       "text": "We explain what the fee covers, which party it applies to and when it is payable."
      }
     ]
    },
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 5
   },
   {
    "key": "fees-terms",
    "label": "Taxes & invoicing / Clear terms",
    "eyebrow": "",
    "heading": "",
    "html": "",
    "image_url": "",
    "lists": {
     "panels": [
      {
       "title": "Taxes & Invoicing",
       "text": "Where applicable, GST and other statutory taxes will be charged in accordance with applicable laws. Applicable fees and taxes will be communicated as part of the agreed commercial terms."
      },
      {
       "title": "Clear Terms Before We Proceed",
       "text": "Aventrix Realty charges professional fees for its real estate services. The applicable fee depends on the nature and scope of the assignment and is discussed with the client before proceeding.",
       "text2": "Where a written fee agreement is in place, its agreed terms will apply."
      }
     ]
    },
    "hooks": [],
    "display_order": 6
   },
   {
    "key": "final-cta",
    "label": "Closing call to action",
    "eyebrow": "",
    "heading": "Let's Start With a Conversation",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "Tell us what you are looking to buy, sell, lease or develop. We'll understand your requirement, explain the scope of our involvement and discuss the applicable professional fee with you before proceeding."
    },
    "lists": {
     "buttons": [
      {
       "text": "Talk to Us",
       "link": "contact.html"
      },
      {
       "text": "WhatsApp Us",
       "link": "https://wa.me/919176887770"
      }
     ]
    },
    "hooks": [
     "heading"
    ],
    "display_order": 7
   }
  ],
  "page_label": "Professional Fees",
  "hero_eyebrow": "TRANSPARENCY",
  "hero_title": "Professional Fees,<br>Agreed Upfront",
  "hero_subtitle": "Our professional fee is based on the nature, scope and complexity of your requirement, and is clearly discussed and agreed with you before we proceed.",
  "seo_title": "Professional Fees & Brokerage | Aventrix Realty",
  "seo_description": "How Aventrix Realty approaches professional fees and brokerage in Chennai — the scope is explained clearly and the fee is agreed with you before we proceed.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/chennai-marina.jpg"
 },
 {
  "page_key": "our-realtors",
  "sections": [],
  "page_label": "Our Realtors",
  "hero_eyebrow": "OUR TEAM",
  "hero_title": "Meet Our Real Estate Professionals",
  "hero_subtitle": "Our experienced team is committed to delivering trusted guidance, market expertise and exceptional service across every property journey.",
  "seo_title": "Our Realtors | Aventrix Realty",
  "seo_description": "Meet the Aventrix Realty team — experienced, TNRERA-registered real estate advisors serving buyers, sellers and investors across Chennai.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/chennai-marina.jpg"
 },
 {
  "page_key": "gnanasekaran",
  "sections": [
   {
    "key": "profile-legacy",
    "label": "Legacy paragraph on this profile page",
    "eyebrow": "",
    "heading": "Legacy",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "Long before Aventrix Realty was established, the location where the company's office stands today was home to TP Builders, founded by Late Mr. Perumal. From this location, he built homes, created lasting relationships, and established a reputation that continues to inspire generations. Gnanasekaran P proudly carried forward the vision of his father, preserving the values that earned generations of trust while embracing a modern approach to real estate — where tradition, professionalism, and long-term relationships remain at the heart of every property journey."
    },
    "hooks": [
     "heading"
    ],
    "display_order": 1
   }
  ],
  "page_label": "Founder profile — Gnanasekaran P",
  "seo_title": "Gnanasekaran P | Aventrix Realty",
  "seo_description": "Gnanasekaran P, Founder of Aventrix Realty — carrying forward a real estate legacy rooted in Chennai since 1965 through TP Builders.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/founder.jpg"
 },
 {
  "page_key": "sanjay",
  "sections": [
   {
    "key": "profile-legacy",
    "label": "Legacy paragraph on this profile page",
    "eyebrow": "",
    "heading": "Legacy",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "Sanjay Gandhi L became part of Aventrix Realty's new chapter, bringing over a decade of real estate experience across land, residential, commercial and joint venture advisory. Together with Gnanasekaran P, he continues to lead Aventrix Realty — combining a proud legacy with modern expertise across Chennai."
    },
    "hooks": [
     "heading"
    ],
    "display_order": 1
   },
   {
    "key": "profile-social",
    "label": "Personal social links on this profile page",
    "eyebrow": "",
    "heading": "Connect with Sanjay",
    "html": "",
    "image_url": "",
    "lists": {
     "links": [
      {
       "link": "https://www.facebook.com/share/1JAhc91b79/?mibextid=wwXIfr",
       "label": "Facebook"
      },
      {
       "link": "https://www.instagram.com/sanjaygandhirealty?stkn=MTdjdXB5YnBjZHg2Mw%3D%3D&utm_source=qr",
       "label": "Instagram"
      },
      {
       "link": "https://x.com/sanjaygandhil?s=11",
       "label": "X"
      },
      {
       "link": "https://www.linkedin.com/in/lsanjaygandhi?utm_source=share_via&utm_content=profile&utm_medium=member_ios",
       "label": "LinkedIn"
      }
     ]
    },
    "hooks": [
     "heading"
    ],
    "display_order": 2
   }
  ],
  "page_label": "Co-Founder profile — L. Sanjay Gandhi",
  "seo_title": "L. Sanjay Gandhi | Aventrix Realty",
  "seo_description": "L. Sanjay Gandhi, Co-Founder & Managing Partner of Aventrix Realty — over a decade of experience in Chennai real estate advisory across residential, commercial, land and joint venture transactions.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/sanjay.jpg"
 },
 {
  "page_key": "insights",
  "sections": [],
  "page_label": "Insights",
  "hero_eyebrow": "AVENTRIX INSIGHTS",
  "hero_title": "Market Insights,<br> Property Knowledge &amp; Updates",
  "hero_subtitle": "Stay informed with expert articles, market trends, investment ideas and real estate guidance from Aventrix Realty.",
  "seo_title": "Insights | Aventrix Realty",
  "seo_description": "Real estate insights, market trends and property guidance for Chennai from Aventrix Realty.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/chennai-marina.jpg"
 },
 {
  "page_key": "contact",
  "sections": [
   {
    "key": "offices-intro",
    "label": "Our Offices (heading; offices come from Admin → Office Locations)",
    "eyebrow": "VISIT US",
    "heading": "Our Offices",
    "html": "<p>Head Office and branch locations across Chennai.</p>",
    "image_url": "",
    "hooks": [
     "eyebrow",
     "heading",
     "html"
    ],
    "display_order": 1
   },
   {
    "key": "contact-form-intro",
    "label": "Enquiry form (heading and intro)",
    "eyebrow": "",
    "heading": "Send Us an Enquiry",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "Complete the form below and our team will get back to you shortly."
    },
    "hooks": [
     "heading"
    ],
    "display_order": 2
   },
   {
    "key": "offices-heading",
    "label": "Locate Our Offices (maps come from Admin → Office Locations)",
    "eyebrow": "FIND US",
    "heading": "Locate Our Offices",
    "html": "",
    "image_url": "",
    "hooks": [
     "eyebrow",
     "heading"
    ],
    "display_order": 3
   },
   {
    "key": "contact-hours",
    "label": "Business hours & quick contact (phone/email come from the Head Office)",
    "eyebrow": "",
    "heading": "",
    "html": "",
    "image_url": "",
    "fields": {
     "hours_title": "Business Hours",
     "contact_title": "Quick Contact"
    },
    "lists": {
     "hours": [
      {
       "day": "Monday – Saturday",
       "time": "9:30 AM – 7:00 PM"
      },
      {
       "day": "Sunday",
       "time": "By Appointment"
      }
     ]
    },
    "hooks": [],
    "display_order": 4
   }
  ],
  "page_label": "Contact",
  "hero_eyebrow": "GET IN TOUCH",
  "hero_title": "Contact Aventrix Realty",
  "hero_subtitle": "We're here to assist you with buying, selling, leasing and investment opportunities.",
  "seo_title": "Contact Us | Aventrix Realty",
  "seo_description": "Contact Aventrix Realty — Chennai real estate advisors with offices in Chromepet and Adyar. Call, WhatsApp or send an enquiry for buying, selling or leasing property.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/chennai-marina.jpg"
 },
 {
  "page_key": "enquiry",
  "sections": [
   {
    "key": "form-intro",
    "label": "Enquiry form (heading and intro)",
    "eyebrow": "",
    "heading": "Property Enquiry Form",
    "html": "",
    "image_url": "",
    "fields": {
     "text": "Please complete the form below."
    },
    "hooks": [
     "heading"
    ],
    "display_order": 1
   }
  ],
  "page_label": "Property Enquiry",
  "hero_eyebrow": "PROPERTY ENQUIRY",
  "hero_title": "Send Us Your<br> Property Enquiry",
  "hero_subtitle": "Looking to buy, sell, rent or invest? Complete the enquiry form below and our team will contact you shortly.",
  "hero_button_text": "Enquire Now",
  "hero_button_link": "#enquiry-form",
  "seo_title": "Property Enquiry | Aventrix Realty",
  "seo_description": "Send Aventrix Realty an enquiry about buying, selling, renting or investing in property in Chennai. Our team will contact you shortly.",
  "seo_keywords": "",
  "og_image_url": ""
 },
 {
  "page_key": "sitemap",
  "sections": [],
  "page_label": "Sitemap",
  "hero_eyebrow": "SITEMAP",
  "hero_title": "Sitemap",
  "hero_subtitle": "Every page on the Aventrix Realty website in one place.",
  "seo_title": "Sitemap | Aventrix Realty",
  "seo_description": "Every page on the Aventrix Realty website — properties, services, insights, leadership and legal information.",
  "seo_keywords": "",
  "og_image_url": "https://aventrixrealty.com/images/chennai-marina.jpg"
 }
]$cms$::jsonb);

-- 1. pages that have no row yet
insert into public.pages (page_key, page_label, hero_eyebrow, hero_title, hero_subtitle, hero_button_text, hero_button_link,
                          hero_image_url, sections, seo_title, seo_description, seo_keywords, og_image_url, publish_status)
select d->>'page_key', d->>'page_label', d->>'hero_eyebrow', d->>'hero_title', d->>'hero_subtitle', d->>'hero_button_text',
       d->>'hero_button_link', d->>'hero_image_url', coalesce(d->'sections', '[]'::jsonb), d->>'seo_title', d->>'seo_description',
       nullif(d->>'seo_keywords', ''), nullif(d->>'og_image_url', ''), 'Published'
  from (select doc as d from cms_seed) seed where not exists (select 1 from public.pages p where p.page_key = seed.d->>'page_key');

-- 2. existing rows: fill blanks only, merge sections
update public.pages p set
    hero_eyebrow     = pg_temp.fill_text(p.hero_eyebrow, d->>'hero_eyebrow'),
    hero_title       = pg_temp.fill_text(p.hero_title, d->>'hero_title'),
    hero_subtitle    = pg_temp.fill_text(p.hero_subtitle, d->>'hero_subtitle'),
    hero_button_text = pg_temp.fill_text(p.hero_button_text, d->>'hero_button_text'),
    hero_button_link = pg_temp.fill_text(p.hero_button_link, d->>'hero_button_link'),
    hero_image_url   = pg_temp.fill_text(p.hero_image_url, d->>'hero_image_url'),
    seo_title        = pg_temp.fill_text(p.seo_title, d->>'seo_title'),
    seo_description  = pg_temp.fill_text(p.seo_description, d->>'seo_description'),
    seo_keywords     = pg_temp.fill_text(p.seo_keywords, nullif(d->>'seo_keywords', '')),
    og_image_url     = pg_temp.fill_text(p.og_image_url, nullif(d->>'og_image_url', '')),
    sections         = pg_temp.merge_sections(p.sections, coalesce(d->'sections', '[]'::jsonb))
  from (select doc d from cms_seed) s
 where p.page_key = s.d->>'page_key'
   and (p.sections is distinct from pg_temp.merge_sections(p.sections, coalesce(s.d->'sections', '[]'::jsonb))
        or p.hero_eyebrow is distinct from pg_temp.fill_text(p.hero_eyebrow, s.d->>'hero_eyebrow')
        or p.hero_title is distinct from pg_temp.fill_text(p.hero_title, s.d->>'hero_title')
        or p.hero_subtitle is distinct from pg_temp.fill_text(p.hero_subtitle, s.d->>'hero_subtitle')
        or p.hero_button_text is distinct from pg_temp.fill_text(p.hero_button_text, s.d->>'hero_button_text')
        or p.hero_button_link is distinct from pg_temp.fill_text(p.hero_button_link, s.d->>'hero_button_link')
        or p.hero_image_url is distinct from pg_temp.fill_text(p.hero_image_url, s.d->>'hero_image_url')
        or p.seo_title is distinct from pg_temp.fill_text(p.seo_title, s.d->>'seo_title')
        or p.seo_description is distinct from pg_temp.fill_text(p.seo_description, s.d->>'seo_description')
        or p.seo_keywords is distinct from pg_temp.fill_text(p.seo_keywords, nullif(s.d->>'seo_keywords', ''))
        or p.og_image_url is distinct from pg_temp.fill_text(p.og_image_url, nullif(s.d->>'og_image_url', '')));

-- 3. Our Legacy: the words now live in structured fields; drop the old HTML
--    copy only if nobody has edited it since (exact original).
update public.pages set sections = (
    select jsonb_agg(case when e->>'key' = 'about-legacy' and md5(coalesce(e->>'html', '')) = 'f48fdb9d68404058977ab1bd5ac6c291'
                          then e || jsonb_build_object('html', '') else e end order by ord)
      from jsonb_array_elements(sections) with ordinality as t(e, ord))
 where page_key = 'home'
   and exists (select 1 from jsonb_array_elements(sections) e where e->>'key' = 'about-legacy' and md5(coalesce(e->>'html', '')) = 'f48fdb9d68404058977ab1bd5ac6c291');

-- 4. Site Settings: RERA agent number shown on the website (fill blank only)
update public.site_settings set rera_registration_no = 'TN/Agent/0284/2026'
 where id = 1 and coalesce(btrim(rera_registration_no), '') = '';

commit;

-- ============================================================
-- VERIFY (read-only):
--   select page_key, jsonb_array_length(sections) from public.pages order by page_key;
--   -- expected: 16 rows updated/inserted from this seed (privacy-policy and terms held back per user decision — see header note below)
-- ============================================================
-- ROLLBACK (restores every row exactly as it was before this file; removes the new rows):
--   begin;
--   delete from public.pages p where not exists (select 1 from backup_20260926_cms2.pages b where b.id = p.id);
--   update public.pages p set hero_eyebrow=b.hero_eyebrow, hero_title=b.hero_title, hero_subtitle=b.hero_subtitle,
--     hero_button_text=b.hero_button_text, hero_button_link=b.hero_button_link, hero_image_url=b.hero_image_url,
--     sections=b.sections, seo_title=b.seo_title, seo_description=b.seo_description, seo_keywords=b.seo_keywords,
--     og_image_url=b.og_image_url
--     from backup_20260926_cms2.pages b where b.id = p.id;
--   update public.site_settings s set rera_registration_no = b.rera_registration_no
--     from backup_20260926_cms2.site_settings b where b.id = s.id;
--   commit;
-- ============================================================
