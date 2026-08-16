/*
 * AVENTRIX REALTY — INSIGHTS MODULE
 * -------------------------------------------
 * CRUD for the `insights` table (articles shown on insights.html).
 * Body uses a rich-text (Quill) editor. No artificial article-count
 * limit. See js/public-insights.js for the public rendering.
 */

const InsightsModule = (function () {
    let editingId = null;
    let bodyQuill = null;
    const els = {};

    function cacheEls() {
        [
            "insightsTableBody", "insightsEmptyState",
            "insightModalOverlay", "insightModalTitle", "insightForm",
            "iTitle", "iSlug", "iExcerpt", "iCoverImageUrl", "iCategory",
            "iSeoTitle", "iSeoDescription", "iSeoKeywords",
            "iDisplayOrder", "iPublishStatus"
        ].forEach((id) => (els[id] = document.getElementById(id)));
    }

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    async function load() {
        const rows = await CrudEngine.list("insights", { orderBy: "display_order", ascending: true });
        renderTable(rows);
    }

    function renderTable(rows) {
        els.insightsEmptyState.style.display = rows.length ? "none" : "block";
        els.insightsTableBody.innerHTML = rows.map((a) => `
            <tr>
                <td><strong>${escapeHtml(a.title)}</strong></td>
                <td><span class="helper-text">${escapeHtml(a.category)}</span></td>
                <td>${a.publish_status === "Published" ? '<span class="badge badge-published">Published</span>' : '<span class="badge badge-draft">Draft</span>'}</td>
                <td class="admin-actions-cell">
                    <button class="icon-btn" title="Edit" onclick="InsightsModule.openEdit('${a.id}')"><i class="fas fa-pen"></i></button>
                    <button class="icon-btn danger" title="Delete" onclick="InsightsModule.remove('${a.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join("");
    }

    function ensureQuill() {
        const el = document.getElementById("insightBodyEditor");
        if (!el || typeof Quill === "undefined") return;
        if (bodyQuill) { bodyQuill.root.innerHTML = ""; return; }
        bodyQuill = new Quill(el, {
            theme: "snow",
            modules: { toolbar: [["bold", "italic"], [{ header: [2, 3, false] }], ["link", "image"], [{ list: "ordered" }, { list: "bullet" }], ["clean"]] }
        });
    }

    function resetForm() {
        editingId = null;
        els.insightForm.reset();
        els.iDisplayOrder.value = 0;
        els.iPublishStatus.value = "Draft";
        els.insightModalTitle.textContent = "Add Insight";
        ensureQuill();
    }

    function openAdd() {
        resetForm();
        els.insightModalOverlay.classList.add("open");
    }

    async function openEdit(id) {
        resetForm();
        const a = await CrudEngine.getOne("insights", id);
        editingId = id;
        els.insightModalTitle.textContent = "Edit Insight";
        els.iTitle.value = a.title || "";
        els.iSlug.value = a.slug || "";
        els.iExcerpt.value = a.excerpt || "";
        els.iCoverImageUrl.value = a.cover_image_url || "";
        els.iCategory.value = a.category || "";
        els.iSeoTitle.value = a.seo_title || "";
        els.iSeoDescription.value = a.seo_description || "";
        els.iSeoKeywords.value = a.seo_keywords || "";
        els.iDisplayOrder.value = a.display_order ?? 0;
        els.iPublishStatus.value = a.publish_status || "Draft";
        if (bodyQuill) bodyQuill.root.innerHTML = a.body || "";
        els.insightModalOverlay.classList.add("open");
    }

    function closeModal() {
        els.insightModalOverlay.classList.remove("open");
    }

    async function remove(id) {
        if (!confirm("Delete this insight? This can't be undone.")) return;
        try {
            await CrudEngine.remove("insights", id);
            showToast("Insight deleted");
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
        const btn = document.getElementById("saveInsightBtn");
        btn.disabled = true;
        btn.textContent = "Saving...";
        try {
            const wasDraft = !editingId;
            const record = {
                title: els.iTitle.value.trim(),
                slug: els.iSlug.value.trim() || slugify(els.iTitle.value),
                excerpt: els.iExcerpt.value.trim(),
                body: bodyQuill ? bodyQuill.root.innerHTML : "",
                cover_image_url: els.iCoverImageUrl.value.trim(),
                category: els.iCategory.value.trim(),
                seo_title: els.iSeoTitle.value.trim(),
                seo_description: els.iSeoDescription.value.trim(),
                seo_keywords: els.iSeoKeywords.value.trim(),
                display_order: parseInt(els.iDisplayOrder.value, 10) || 0,
                publish_status: els.iPublishStatus.value
            };
            if (record.publish_status === "Published") record.published_at = new Date().toISOString();

            if (editingId) {
                await CrudEngine.update("insights", editingId, record);
                showToast("Insight updated");
            } else {
                await CrudEngine.insert("insights", record);
                showToast("Insight created");
            }
            closeModal();
            load();
        } catch (err) {
            console.error(err);
            showToast("Save failed: " + err.message, true);
        } finally {
            btn.disabled = false;
            btn.textContent = "Save Insight";
        }
    }

    function bindEvents() {
        document.getElementById("addInsightBtn").addEventListener("click", openAdd);
        document.getElementById("closeInsightModal").addEventListener("click", closeModal);
        document.getElementById("cancelInsightBtn").addEventListener("click", closeModal);
        els.insightForm.addEventListener("submit", handleSubmit);
    }

    document.addEventListener("DOMContentLoaded", () => {
        cacheEls();
        bindEvents();
    });

    return { load, openEdit, remove };
})();

window.InsightsModule = InsightsModule;
