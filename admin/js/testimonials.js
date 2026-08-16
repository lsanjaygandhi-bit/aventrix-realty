/*
 * AVENTRIX REALTY — TESTIMONIALS MODULE
 * -------------------------------------------
 * CRUD for the `testimonials` table. Drives the "What Our Clients
 * Say" grid on the homepage (see js/public-testimonials.js).
 * No artificial limit on the number of testimonials.
 */

const TestimonialsModule = (function () {
    let editingId = null;
    const els = {};

    function cacheEls() {
        [
            "testimonialsTableBody", "testimonialsEmptyState",
            "testimonialModalOverlay", "testimonialModalTitle", "testimonialForm",
            "tName", "tRole", "tQuote", "tPhotoUrl", "tDisplayOrder", "tPublishStatus"
        ].forEach((id) => (els[id] = document.getElementById(id)));
    }

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    async function load() {
        const rows = await CrudEngine.list("testimonials", { orderBy: "display_order", ascending: true });
        renderTable(rows);
    }

    function renderTable(rows) {
        els.testimonialsEmptyState.style.display = rows.length ? "none" : "block";
        els.testimonialsTableBody.innerHTML = rows.map((t) => `
            <tr>
                <td><strong>${escapeHtml(t.client_name)}</strong></td>
                <td><span class="helper-text">${escapeHtml(t.client_role)}</span></td>
                <td><span class="helper-text">${escapeHtml((t.quote || "").slice(0, 60))}${(t.quote || "").length > 60 ? "…" : ""}</span></td>
                <td>${t.publish_status === "Published" ? '<span class="badge badge-published">Published</span>' : '<span class="badge badge-draft">Draft</span>'}</td>
                <td class="admin-actions-cell">
                    <button class="icon-btn" title="Edit" onclick="TestimonialsModule.openEdit('${t.id}')"><i class="fas fa-pen"></i></button>
                    <button class="icon-btn danger" title="Delete" onclick="TestimonialsModule.remove('${t.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join("");
    }

    function resetForm() {
        editingId = null;
        els.testimonialForm.reset();
        els.tDisplayOrder.value = 0;
        els.tPublishStatus.value = "Published";
        els.testimonialModalTitle.textContent = "Add Testimonial";
    }

    function openAdd() {
        resetForm();
        els.testimonialModalOverlay.classList.add("open");
    }

    async function openEdit(id) {
        resetForm();
        const t = await CrudEngine.getOne("testimonials", id);
        editingId = id;
        els.testimonialModalTitle.textContent = "Edit Testimonial";
        els.tName.value = t.client_name || "";
        els.tRole.value = t.client_role || "";
        els.tQuote.value = t.quote || "";
        els.tPhotoUrl.value = t.photo_url || "";
        els.tDisplayOrder.value = t.display_order ?? 0;
        els.tPublishStatus.value = t.publish_status || "Published";
        els.testimonialModalOverlay.classList.add("open");
    }

    function closeModal() {
        els.testimonialModalOverlay.classList.remove("open");
    }

    async function remove(id) {
        if (!confirm("Delete this testimonial? This can't be undone.")) return;
        try {
            await CrudEngine.remove("testimonials", id);
            showToast("Testimonial deleted");
            load();
        } catch (err) {
            showToast("Delete failed: " + err.message, true);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const btn = document.getElementById("saveTestimonialBtn");
        btn.disabled = true;
        btn.textContent = "Saving...";
        try {
            const record = {
                client_name: els.tName.value.trim(),
                client_role: els.tRole.value.trim(),
                quote: els.tQuote.value.trim(),
                photo_url: els.tPhotoUrl.value.trim(),
                display_order: parseInt(els.tDisplayOrder.value, 10) || 0,
                publish_status: els.tPublishStatus.value
            };
            if (editingId) {
                await CrudEngine.update("testimonials", editingId, record);
                showToast("Testimonial updated");
            } else {
                await CrudEngine.insert("testimonials", record);
                showToast("Testimonial created");
            }
            closeModal();
            load();
        } catch (err) {
            console.error(err);
            showToast("Save failed: " + err.message, true);
        } finally {
            btn.disabled = false;
            btn.textContent = "Save Testimonial";
        }
    }

    function bindEvents() {
        document.getElementById("addTestimonialBtn").addEventListener("click", openAdd);
        document.getElementById("closeTestimonialModal").addEventListener("click", closeModal);
        document.getElementById("cancelTestimonialBtn").addEventListener("click", closeModal);
        els.testimonialForm.addEventListener("submit", handleSubmit);
    }

    document.addEventListener("DOMContentLoaded", () => {
        cacheEls();
        bindEvents();
    });

    return { load, openEdit, remove };
})();

window.TestimonialsModule = TestimonialsModule;
