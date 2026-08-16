/*
 * AVENTRIX REALTY — PUBLIC TESTIMONIALS LOADER
 * ------------------------------------------------
 * Replaces the hardcoded testimonial cards on the homepage with
 * live data from Supabase. Markup matches the original design
 * exactly, so style.css needs zero changes. No-op if the page has
 * no #testimonialsGrid element.
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
            if (!data || !data.length) return; // keep grid empty rather than show a broken state
            grid.innerHTML = data.map((t) => `
                <div class="testimonial-card">
                    <p class="testimonial-quote">"${escapeHtml(t.quote)}"</p>
                    <div class="testimonial-author">
                        <span class="testimonial-name">${escapeHtml(t.client_name)}</span>
                        <span class="testimonial-role">${escapeHtml(t.client_role || "")}</span>
                    </div>
                </div>
            `).join("");
        });
})();
