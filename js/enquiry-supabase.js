/*
 * AVENTRIX REALTY — ENQUIRY FORM HANDLER (SUPABASE)
 * ----------------------------------------------------
 * Replaces the old Formspree POST with a Supabase insert into the
 * `enquiries` table. Works generically across every page's form —
 * each page has different fields (Free Valuation, List With Us, NRI
 * Services, Joint Venture, general Enquiry) so instead of hardcoding
 * columns, all fields are captured as JSON in `payload`, with a best
 * -effort name/phone/email pulled out for easy scanning in the admin
 * enquiry inbox.
 *
 * PROPERTY ENQUIRIES: when a page is opened as
 * enquiry.html?property=<slug> (the "Send an enquiry about this
 * property" link on property.html), the slug is sent as
 * property_slug. The database resolves it to the property's id and
 * AVX code itself (only for Published listings), so the lead arrives
 * in Admin → Leads already linked to the right property.
 *
 * LOGGED-IN BUYERS: submitted_by is set to their user id, so the
 * enquiry also appears under "My Enquiries" on account.html.
 *
 * NOTE: file inputs (e.g. property photo uploads on some forms) are
 * not uploaded to storage by this handler — only the filename is
 * recorded. Wiring those to Supabase Storage is a small follow-up if
 * needed.
 */

(function () {
    const sb = window.supabaseClient;
    const form = document.getElementById("propertyForm") || document.querySelector("form");
    if (!sb || !form) return;

    // Avoid double-binding if this script is somehow included twice.
    if (form.dataset.supabaseBound) return;
    form.dataset.supabaseBound = "true";

    // Property context (enquiry.html?property=<slug>)
    const propertySlug = (new URLSearchParams(window.location.search).get("property") || "").trim() || null;
    if (propertySlug) {
        sb.from("properties")
            .select("title, property_code, location")
            .eq("slug", propertySlug)
            .eq("publish_status", "Published")
            .maybeSingle()
            .then(({ data }) => {
                if (!data) return;
                const note = document.createElement("p");
                note.className = "enquiry-property-context";
                note.textContent = "Enquiring about: " + (data.property_code ? data.property_code + " – " : "") +
                    data.title + (data.location ? ", " + data.location : "");
                form.parentNode.insertBefore(note, form);
                const subject = form.querySelector('[name="Subject"]');
                if (subject && !subject.value) subject.value = "Enquiry: " + (data.property_code || data.title);
            });
    }

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const formData = new FormData(form);
        const payload = {};
        let name = null, phone = null, email = null;

        for (const [key, value] of formData.entries()) {
            if (value instanceof File) {
                payload[key] = value.name || null;
                continue;
            }
            payload[key] = value;

            const k = key.toLowerCase();
            if (!name && k.includes("name")) name = value;
            if (!phone && (k.includes("mobile") || k.includes("phone") || k.includes("whatsapp"))) phone = value;
            if (!email && k.includes("email")) email = value;
        }

        const record = {
            // A form can name its own type via data-form-type (used by
            // the Joint Venture page so its inbox label stays "Joint
            // Venture" even though its <title> is longer); every other
            // form keeps the original title-based label.
            form_type: form.dataset.formType || document.title.split("|")[0].trim() || "Enquiry",
            source_page: window.location.pathname.split("/").pop() || "index.html",
            name: name,
            phone: phone,
            email: email,
            payload: payload,
            status: "new"
        };
        if (propertySlug) record.property_slug = propertySlug;

        try {
            const { data: sessionData } = await sb.auth.getSession();
            const user = sessionData && sessionData.session && sessionData.session.user;
            if (user) record.submitted_by = user.id;
        } catch (err) { /* anonymous submit is fine */ }

        try {
            let { error } = await sb.from("enquiries").insert(record);
            // Safety net if the P1 database migration hasn't been run
            // yet (no property_slug column): never lose the enquiry.
            if (error && record.property_slug && /property_slug/.test(error.message || "")) {
                delete record.property_slug;
                record.payload = Object.assign({}, record.payload, { "Property": propertySlug });
                ({ error } = await sb.from("enquiries").insert(record));
            }

            if (!error) {
                if (propertySlug && window.AventrixTracking) window.AventrixTracking.track(propertySlug, "enquiry");
                form.style.display = "none";
                const successEl = document.getElementById("success-message");
                if (successEl) {
                    successEl.style.display = "block";
                } else {
                    alert("Thank you — your enquiry has been submitted successfully.");
                }
                form.reset();
            } else {
                console.error(error);
                alert("Something went wrong submitting your enquiry. Please try again or call us directly.");
            }
        } catch (err) {
            console.error(err);
            alert("Something went wrong submitting your enquiry. Please try again or call us directly.");
        }
    });
})();
