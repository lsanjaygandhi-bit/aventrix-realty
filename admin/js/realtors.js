/*
 * AVENTRIX REALTY — REALTORS / TEAM MODULE
 * -------------------------------------------
 * CRUD for the `realtors` table — replaces realtors-data.js as the
 * editable source of truth for Our Realtors, Realtor Profile, and
 * (via profile_link) the dedicated Sanjay/Gnanasekaran pages.
 * See js/public-realtors.js for how it renders on the public site.
 */

const RealtorsModule = (function () {
    let editingId = null;
    const els = {};

    function cacheEls() {
        [
            "realtorsTableBody", "realtorsEmptyState",
            "realtorModalOverlay", "realtorModalTitle", "realtorForm",
            "rName", "rSlug", "rDesignation", "rPhotoUrl", "rShortIntro", "rAbout",
            "rExpertise", "rExperience", "rLanguages", "rSpecializations",
            "rPhone", "rEmail", "rWhatsapp", "rProfileLink",
            "rDisplayOrder", "rPublishStatus"
        ].forEach((id) => (els[id] = document.getElementById(id)));
    }

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function toArray(str) {
        return String(str || "").split(",").map((s) => s.trim()).filter(Boolean);
    }

    async function load() {
        const rows = await CrudEngine.list("realtors", { orderBy: "display_order", ascending: true });
        renderTable(rows);
    }

    function renderTable(rows) {
        els.realtorsEmptyState.style.display = rows.length ? "none" : "block";
        els.realtorsTableBody.innerHTML = rows.map((r) => `
            <tr>
                <td><strong>${escapeHtml(r.name)}</strong></td>
                <td><span class="helper-text">${escapeHtml(r.designation)}</span></td>
                <td><span class="helper-text">${escapeHtml(r.slug)}</span></td>
                <td>${r.publish_status === "Published" ? '<span class="badge badge-published">Published</span>' : '<span class="badge badge-draft">Draft</span>'}</td>
                <td class="admin-actions-cell">
                    <button class="icon-btn" title="Edit" onclick="RealtorsModule.openEdit('${r.id}')"><i class="fas fa-pen"></i></button>
                    <button class="icon-btn danger" title="Delete" onclick="RealtorsModule.remove('${r.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join("");
    }

    function resetForm() {
        editingId = null;
        els.realtorForm.reset();
        els.rDisplayOrder.value = 0;
        els.rPublishStatus.value = "Published";
        els.realtorModalTitle.textContent = "Add Realtor";
    }

    function openAdd() {
        resetForm();
        els.realtorModalOverlay.classList.add("open");
    }

    async function openEdit(id) {
        resetForm();
        const r = await CrudEngine.getOne("realtors", id);
        editingId = id;
        els.realtorModalTitle.textContent = "Edit Realtor";
        els.rName.value = r.name || "";
        els.rSlug.value = r.slug || "";
        els.rDesignation.value = r.designation || "";
        els.rPhotoUrl.value = r.photo_url || "";
        els.rShortIntro.value = r.short_intro || "";
        els.rAbout.value = r.about || "";
        els.rExpertise.value = (r.expertise || []).join(", ");
        els.rExperience.value = r.experience || "";
        els.rLanguages.value = (r.languages || []).join(", ");
        els.rSpecializations.value = (r.specializations || []).join(", ");
        els.rPhone.value = r.phone || "";
        els.rEmail.value = r.email || "";
        els.rWhatsapp.value = r.whatsapp || "";
        els.rProfileLink.value = r.profile_link || "";
        els.rDisplayOrder.value = r.display_order ?? 0;
        els.rPublishStatus.value = r.publish_status || "Published";
        els.realtorModalOverlay.classList.add("open");
    }

    function closeModal() {
        els.realtorModalOverlay.classList.remove("open");
    }

    async function remove(id) {
        if (!confirm("Delete this realtor? This can't be undone.")) return;
        try {
            await CrudEngine.remove("realtors", id);
            showToast("Realtor deleted");
            load();
        } catch (err) {
            showToast("Delete failed: " + err.message, true);
        }
    }

    function slugify(str) {
        return String(str || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const btn = document.getElementById("saveRealtorBtn");
        btn.disabled = true;
        btn.textContent = "Saving...";
        try {
            const record = {
                name: els.rName.value.trim(),
                slug: els.rSlug.value.trim() || slugify(els.rName.value),
                designation: els.rDesignation.value.trim(),
                photo_url: els.rPhotoUrl.value.trim(),
                short_intro: els.rShortIntro.value.trim(),
                about: els.rAbout.value.trim(),
                expertise: toArray(els.rExpertise.value),
                experience: els.rExperience.value.trim(),
                languages: toArray(els.rLanguages.value),
                specializations: toArray(els.rSpecializations.value),
                phone: els.rPhone.value.trim(),
                email: els.rEmail.value.trim(),
                whatsapp: els.rWhatsapp.value.trim(),
                profile_link: els.rProfileLink.value.trim(),
                display_order: parseInt(els.rDisplayOrder.value, 10) || 0,
                publish_status: els.rPublishStatus.value
            };
            if (editingId) {
                await CrudEngine.update("realtors", editingId, record);
                showToast("Realtor updated");
            } else {
                await CrudEngine.insert("realtors", record);
                showToast("Realtor created");
            }
            closeModal();
            load();
        } catch (err) {
            console.error(err);
            showToast("Save failed: " + err.message, true);
        } finally {
            btn.disabled = false;
            btn.textContent = "Save Realtor";
        }
    }

    function bindEvents() {
        document.getElementById("addRealtorBtn").addEventListener("click", openAdd);
        document.getElementById("closeRealtorModal").addEventListener("click", closeModal);
        document.getElementById("cancelRealtorBtn").addEventListener("click", closeModal);
        els.realtorForm.addEventListener("submit", handleSubmit);
    }

    document.addEventListener("DOMContentLoaded", () => {
        cacheEls();
        bindEvents();
    });

    return { load, openEdit, remove };
})();

window.RealtorsModule = RealtorsModule;
