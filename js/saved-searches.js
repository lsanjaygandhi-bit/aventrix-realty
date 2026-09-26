/*
 * AVENTRIX REALTY — "SAVE THIS SEARCH" (properties.html)
 * ------------------------------------------------------
 * Saves the current filter set (exactly what's in the URL, so it
 * re-runs identically) to public.saved_searches for the logged-in
 * buyer. Visitors who aren't logged in are sent to account.html.
 * Managed from account.html → Saved Searches. RLS keeps each
 * buyer's searches private.
 */
(function () {
    const sb = window.supabaseClient;
    const btn = document.getElementById("sfSaveSearchBtn");
    const status = document.getElementById("sfSaveSearchStatus");
    if (!btn) return;

    const LABELS = {
        location: (v) => v, beds: (v) => v + "+ BHK", category: (v) => v.replace(/_/g, " "),
        subtype: (v) => v.replace(/_/g, " "), listingType: (v) => (v === "sale" ? "Buy" : "Lease"),
        priceMin: (v) => "from ₹" + fmt(v), priceMax: (v) => "up to ₹" + fmt(v),
        facing: (v) => v + " facing", furnishing: (v) => v, parking: (v) => v + "+ parking"
    };
    function fmt(v) {
        const n = Number(v);
        if (!isFinite(n)) return v;
        if (n >= 1e7) return (n / 1e7).toFixed(2).replace(/\.?0+$/, "") + " Cr";
        if (n >= 1e5) return (n / 1e5).toFixed(2).replace(/\.?0+$/, "") + " L";
        return n.toLocaleString("en-IN");
    }

    function describe(params) {
        const parts = [];
        params.forEach((v, k) => { if (LABELS[k] && v) parts.push(LABELS[k](v)); });
        return parts.join(", ") || "All properties";
    }

    function say(text, isError) {
        status.textContent = text;
        status.className = "sf-save-status" + (isError ? " error" : "");
        status.hidden = !text;
    }

    btn.addEventListener("click", async () => {
        say("");
        if (!sb) { say("Saving isn't available right now.", true); return; }
        const { data } = await sb.auth.getSession();
        const user = data && data.session && data.session.user;
        if (!user) {
            say("");
            status.innerHTML = 'Please <a href="account.html">log in or create a free account</a> to save searches.';
            status.hidden = false;
            return;
        }
        const params = new URLSearchParams(window.location.search);
        params.delete("sort");
        const suggested = describe(params);
        const name = window.prompt("Name this search", suggested);
        if (name === null) return;
        btn.disabled = true;
        const filters = {};
        params.forEach((v, k) => { filters[k] = v; });
        const { error } = await sb.from("saved_searches").insert({
            user_id: user.id,
            name: (name.trim() || suggested).slice(0, 120),
            query_string: params.toString(),
            filters
        });
        btn.disabled = false;
        if (error) { console.error(error); say("Couldn't save this search. Please try again.", true); return; }
        status.innerHTML = 'Search saved. <a href="account.html#searches">View saved searches</a>';
        status.className = "sf-save-status";
        status.hidden = false;
    });
})();
