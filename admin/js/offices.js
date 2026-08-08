/*
 * AVENTRIX REALTY — OFFICE LOCATIONS MODULE
 * -------------------------------------------
 * CRUD for the `office_locations` table: Head Office plus any future
 * branches (e.g. Adyar Branch). Drives the "Office" block on the
 * homepage Contact section and the office address in the site footer
 * (see js/public-offices.js for how it's applied on the public site).
 *
 * The Head Office row is protected from deletion in this UI — it can
 * still be edited (e.g. to fix a typo), but removing it here is
 * blocked so a future branch addition can never accidentally take
 * down the Head Office listing. Add as many branches as needed; each
 * new row appears on the site automatically, no code changes.
 */

const OfficesModule = (function () {
    let editingId = null;
    const els = {};

    function cacheEls() {
        [
            "officesTableBody", "officesEmptyState",
            "officeModalOverlay", "officeModalTitle", "officeForm",
            "oName", "oAddress", "oPhone", "oWhatsapp", "oMapsUrl",
            "oDisplayOrder", "oPublishStatus", "oIsHeadOffice"
        ].forEach((id) => (els[id] = document.getElementById(id)));
    }

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    async function load() {
        const rows = await CrudEngine.list("office_locations", { orderBy: "display_order", ascending: true });
        renderTable(rows);
    }

    function renderTable(rows) {
        els.officesEmptyState.style.display = rows.length ? "none" : "block";
        els.officesTableBody.innerHTML = rows.map((o) => `
            <tr>
                <td><strong>${escapeHtml(o.name)}</strong></td>
                <td><span class="helper-text">${escapeHtml(o.address)}</span></td>
                <td>${o.maps_url ? '<span class="badge badge-published">Verified</span>' : '<span class="badge badge-draft">Not set</span>'}</td>
                <td>${o.is_head_office ? '<span class="badge badge-featured">Head Office</span>' : '<span class="helper-text">Branch</span>'}</td>
                <td class="admin-actions-cell">
                    <button class="icon-btn" title="Edit" onclick="OfficesModule.openEdit('${o.id}')"><i class="fas fa-pen"></i></button>
                    ${o.is_head_office
                        ? `<button class="icon-btn" title="Head Office can't be deleted" disabled style="opacity:.4; cursor:not-allowed;"><i class="fas fa-lock"></i></button>`
                        : `<button class="icon-btn danger" title="Delete" onclick="OfficesModule.remove('${o.id}')"><i class="fas fa-trash"></i></button>`}
                </td>
            </tr>
        `).join("");
    }

    function resetForm() {
        editingId = null;
        els.officeForm.reset();
        els.oDisplayOrder.value = 0;
        els.oPublishStatus.value = "Published";
        els.oIsHeadOffice.checked = false;
        els.officeModalTitle.textContent = "Add Office";
    }

    function openAdd() {
        resetForm();
        els.officeModalOverlay.classList.add("open");
    }

    async function openEdit(id) {
        resetForm();
        const o = await CrudEngine.getOne("office_locations", id);
        editingId = id;

        els.officeModalTitle.textContent = "Edit Office";
        els.oName.value = o.name || "";
        els.oAddress.value = o.address || "";
        els.oPhone.value = o.phone || "";
        els.oWhatsapp.value = o.whatsapp || "";
        els.oMapsUrl.value = o.maps_url || "";
        els.oDisplayOrder.value = o.display_order ?? 0;
        els.oPublishStatus.value = o.publish_status || "Published";
        els.oIsHeadOffice.checked = !!o.is_head_office;

        els.officeModalOverlay.classList.add("open");
    }

    function closeModal() {
        els.officeModalOverlay.classList.remove("open");
    }

    async function remove(id) {
        if (!confirm("Delete this office location? This can't be undone.")) return;
        try {
            await CrudEngine.remove("office_locations", id);
            showToast("Office deleted");
            load();
        } catch (err) {
            showToast("Delete failed: " + err.message, true);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const btn = document.getElementById("saveOfficeBtn");
        btn.disabled = true;
        btn.textContent = "Saving...";

        try {
            const record = {
                name: els.oName.value.trim(),
                address: els.oAddress.value.trim(),
                phone: els.oPhone.value.trim(),
                whatsapp: els.oWhatsapp.value.trim(),
                maps_url: els.oMapsUrl.value.trim(), // stays empty until a verified link is added
                display_order: parseInt(els.oDisplayOrder.value, 10) || 0,
                publish_status: els.oPublishStatus.value,
                is_head_office: els.oIsHeadOffice.checked
            };

            if (editingId) {
                await CrudEngine.update("office_locations", editingId, record);
                showToast("Office updated");
            } else {
                await CrudEngine.insert("office_locations", record);
                showToast("Office created");
            }

            closeModal();
            load();
        } catch (err) {
            console.error(err);
            showToast("Save failed: " + err.message, true);
        } finally {
            btn.disabled = false;
            btn.textContent = "Save Office";
        }
    }

    function bindEvents() {
        document.getElementById("addOfficeBtn").addEventListener("click", openAdd);
        document.getElementById("closeOfficeModal").addEventListener("click", closeModal);
        document.getElementById("cancelOfficeBtn").addEventListener("click", closeModal);
        els.officeForm.addEventListener("submit", handleSubmit);
    }

    document.addEventListener("DOMContentLoaded", () => {
        cacheEls();
        bindEvents();
    });

    return { load, openEdit, remove };
})();

window.OfficesModule = OfficesModule;
