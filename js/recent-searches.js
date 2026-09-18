/*
 * AVENTRIX REALTY — RECENT SEARCHES (shared module)
 * ---------------------------------------------------
 * Extracted out of js/home-app-experience.js and fixed to capture the
 * REAL search interactions on properties.html (see root-cause note
 * below), so both index.html's hero bar and properties.html's own
 * filter panel now write to and read from the same place.
 *
 * ROOT CAUSE OF THE BUG THIS FIXES:
 * The previous implementation only listened for a `submit` event on
 * `.property-search-form` — an element that exists ONLY on index.html's
 * homepage hero search bar. properties.html's actual filter panel has
 * NO <form> element at all; it is a plain set of inputs/selects wired
 * via `change`/`input` listeners straight into a Supabase query
 * (js/properties-search.js). A real search performed on properties.html
 * — the page where searching actually happens — therefore never fired
 * a `submit` event and was never recorded. Separately, the Recent
 * Searches UI itself (chips + "All Recent Searches") only existed on
 * index.html, so even a captured search wasn't visible on the page
 * where the user had just searched. This file fixes both: it is called
 * directly by properties-search.js after every successful search, and
 * it is rendered on both pages.
 *
 * Storage key is unchanged from the original implementation
 * (localStorage, key "aventrix_recent_searches") so any searches a
 * user already had saved are preserved, not lost, by this fix.
 */
(function () {
    const RECENT_KEY = "aventrix_recent_searches";
    const MAX_RECENT = 12;
    const COMPACT_LIMIT = 5;

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    function read() {
        try {
            const raw = localStorage.getItem(RECENT_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch {
            return [];
        }
    }

    function write(list) {
        try {
            localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
        } catch {
            // localStorage unavailable (private mode, quota, etc.) — fail
            // silently; search itself still works normally either way.
        }
    }

    // Legacy entries (from before this fix) only have
    // {location, type, transaction, ts} and no `url`/`label`. Both
    // shapes are supported so nobody's existing saved searches vanish.
    function legacyLabel(entry) {
        const TYPE_LABELS = { apartment: "Apartments", villa: "Villas", plot: "Plots", commercial: "Commercial" };
        const txn = entry.transaction === "buy" ? "Buy" : entry.transaction === "lease" ? "Rent" : "";
        const typeLabel = TYPE_LABELS[entry.type] || "";
        const parts = [];
        if (txn) parts.push(txn);
        else if (typeLabel) parts.push(typeLabel);
        if (entry.location) parts.push("in " + entry.location);
        else if (txn && typeLabel) parts.push(typeLabel);
        return parts.length ? parts.join(" ") : "All Properties";
    }
    function legacyUrl(entry) {
        const params = new URLSearchParams();
        if (entry.location) params.set("location", entry.location);
        if (entry.type) params.set("type", entry.type);
        if (entry.transaction) params.set("transaction", entry.transaction);
        const qs = params.toString();
        return "properties.html" + (qs ? "?" + qs : "");
    }

    function labelOf(entry) { return entry.label || legacyLabel(entry); }
    function urlOf(entry) { return entry.url || legacyUrl(entry); }

    // Normalization: `url` is expected to already be a canonical query
    // string with a fixed, deterministic parameter order (properties.html
    // always writes its filter state in the same field order — see
    // writeStateToUrl() in js/properties-search.js — regardless of the
    // order the user actually touched the filters in), so two
    // functionally-identical searches always produce the exact same
    // `url` string and naturally de-duplicate below, rather than
    // creating separate entries just because of parameter ordering.
    function record(entry) {
        const list = read().filter((e) => urlOf(e) !== entry.url);
        list.unshift({ url: entry.url, label: entry.label, ts: Date.now() });
        write(list.slice(0, MAX_RECENT));
    }

    function removeAt(index) {
        const list = read();
        list.splice(index, 1);
        write(list);
    }

    function clearAll() {
        write([]);
    }

    // ---------------------------------------------------------
    // Rendering — compact chip row (unchanged visual style/classes
    // from the original implementation) and an expanded list with
    // per-item remove + Clear All, both reused across index.html and
    // properties.html.
    // ---------------------------------------------------------
    function renderChips(container) {
        if (!container) return;
        const list = read().slice(0, COMPACT_LIMIT);
        if (list.length === 0) {
            container.innerHTML = '<span class="home-app-recent-empty">No recent searches yet.</span>';
            return;
        }
        container.innerHTML = list
            .map((entry) => `<a class="home-app-recent-chip" href="${escapeHtml(urlOf(entry))}">${escapeHtml(labelOf(entry))}</a>`)
            .join("");
    }

    function renderExpandedList(container) {
        if (!container) return;
        const list = read();
        if (list.length === 0) {
            container.innerHTML = '<p class="rs-expanded-empty">No recent searches yet.</p>';
            return;
        }
        container.innerHTML = `
            <ul class="rs-expanded-list">
                ${list.map((entry, i) => `
                    <li class="rs-expanded-item">
                        <a class="rs-expanded-link" href="${escapeHtml(urlOf(entry))}">${escapeHtml(labelOf(entry))}</a>
                        <button type="button" class="rs-remove-btn" data-index="${i}" aria-label="Remove this search">
                            <i class="fas fa-times" aria-hidden="true"></i>
                        </button>
                    </li>`).join("")}
            </ul>
            <button type="button" class="rs-clear-all-btn" id="rsClearAllBtn">Clear All Recent Searches</button>`;

        container.querySelectorAll(".rs-remove-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                removeAt(parseInt(btn.getAttribute("data-index"), 10));
                renderExpandedList(container);
                document.dispatchEvent(new CustomEvent("aventrix:recent-searches-changed"));
            });
        });
        const clearBtn = container.querySelector("#rsClearAllBtn");
        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                clearAll();
                renderExpandedList(container);
                document.dispatchEvent(new CustomEvent("aventrix:recent-searches-changed"));
            });
        }
    }

    window.AventrixRecentSearches = { read, record, removeAt, clearAll, labelOf, urlOf, renderChips, renderExpandedList };
})();
