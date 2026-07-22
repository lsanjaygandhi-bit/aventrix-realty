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
            form_type: document.title.split("|")[0].trim() || "Enquiry",
            source_page: window.location.pathname.split("/").pop() || "index.html",
            name: name,
            phone: phone,
            email: email,
            payload: payload,
            status: "new"
        };

        try {
            const { error } = await sb.from("enquiries").insert(record);

            if (!error) {
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
