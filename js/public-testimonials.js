/*
 * AVENTRIX REALTY — PUBLIC TESTIMONIALS LOADER
 * ------------------------------------------------
 * Renders Published testimonials from Supabase into the homepage
 * section. The section (and its scroll-indicator dash) ships HIDDEN
 * with no static cards, and is revealed only when at least one
 * genuine Published testimonial exists — so no placeholder or
 * unverified testimonial is ever shown, including when Supabase is
 * unreachable. No-op if the page has no #testimonialsGrid element.
 */

(function () {
    const sb = window.supabaseClient;
    if (!sb) return;

    const grid = document.getElementById("testimonialsGrid");
    if (!grid) return;

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    sb.from("testimonials")
        .select("*")
        .eq("publish_status", "Published")
        .order("display_order", { ascending: true })
        .then(({ data }) => {
            if (!data || !data.length) return; // nothing genuine to show → section stays hidden
            grid.innerHTML = data.map((t) => `
                <div class="testimonial-card">
                    <p class="testimonial-quote">"${escapeHtml(t.quote)}"</p>
                    <div class="testimonial-author">
                        <span class="testimonial-name">${escapeHtml(t.client_name)}</span>
                        <span class="testimonial-role">${escapeHtml(t.client_role || "")}</span>
                    </div>
                </div>
            `).join("");
            const section = document.getElementById("testimonials");
            if (section) section.hidden = false;
            const dash = document.querySelector('.ssi-segment[data-target="testimonials"]');
            if (dash) dash.hidden = false;
        })
        .catch(() => { /* Supabase unreachable → section stays hidden */ });
})();
