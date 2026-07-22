/*
 * AVENTRIX REALTY — ENQUIRIES MODULE
 * -------------------------------------------
 * Read-only inbox for every enquiry submitted through any form on the
 * public site (general enquiry, free valuation, list-with-us, NRI
 * services, joint venture). Each row's full field set (which differs
 * per form) is stored as JSON in `payload` and shown in the detail
 * modal.
 */

const EnquiriesModule = (function () {
    let rows = [];

    async function load() {
        const filter = document.getElementById("filterEnquiryStatus").value;
        rows = await CrudEngine.list("enquiries", { filters: { status: filter } });
        render();
    }

    function render() {
        const body = document.getElementById("enquiriesTableBody");
        const empty = document.getElementById("enquiriesEmptyState");
        empty.style.display = rows.length ? "none" : "block";

        body.innerHTML = rows.map((r) => `
            <tr>
                <td><span class="helper-text">${new Date(r.created_at).toLocaleString()}</span></td>
                <td>${escapeHtml(r.form_type || "")}</td>
                <td>${escapeHtml(r.name || "—")}</td>
                <td>${escapeHtml(r.phone || "—")}</td>
                <td>${escapeHtml(r.email || "—")}</td>
                <td><span class="badge ${r.status === "new" ? "badge-available" : "badge-draft"}">${escapeHtml(r.status)}</span></td>
                <td class="admin-actions-cell">
                    <button class="icon-btn" title="View" onclick="EnquiriesModule.view('${r.id}')"><i class="fas fa-eye"></i></button>
                    <button class="icon-btn danger" title="Delete" onclick="EnquiriesModule.remove('${r.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join("");
    }

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    async function view(id) {
        const r = rows.find((x) => x.id === id);
        if (!r) return;

        const fields = Object.entries(r.payload || {})
            .map(([k, v]) => `<p style="margin:6px 0;"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`)
            .join("");

        document.getElementById("enquiryDetailContent").innerHTML = `
            <p class="helper-text">${r.form_type} · ${new Date(r.created_at).toLocaleString()} · from ${escapeHtml(r.source_page)}</p>
            <hr style="border:none; border-top:1px solid var(--admin-border); margin:12px 0;">
            ${fields}
        `;
        document.getElementById("enquiryModalOverlay").classList.add("open");

        if (r.status === "new") {
            await CrudEngine.update("enquiries", id, { status: "read" });
            r.status = "read";
            render();
        }
    }

    async function remove(id) {
        if (!confirm("Delete this enquiry?")) return;
        await CrudEngine.remove("enquiries", id);
        showToast("Enquiry deleted");
        load();
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("filterEnquiryStatus").addEventListener("change", load);
        document.getElementById("closeEnquiryModal").addEventListener("click", () => {
            document.getElementById("enquiryModalOverlay").classList.remove("open");
        });
    });

    return { load, view, remove };
})();

window.EnquiriesModule = EnquiriesModule;
