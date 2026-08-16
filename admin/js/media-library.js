/*
 * AVENTRIX REALTY — MEDIA LIBRARY MODULE
 * -------------------------------------------
 * Central browse/upload/delete for images used across every CMS
 * module. Uses the same Storage bucket + CrudEngine.uploadImage
 * already used by Properties, indexed in `media_library` for
 * browsing and reuse. Clicking "Copy URL" is the intended way to
 * reuse an image across Pages / Testimonials / Realtors / Insights.
 */

const MediaLibraryModule = (function () {
    const els = {};

    function cacheEls() {
        ["mediaGrid", "mediaEmptyState", "mediaUploadInput"].forEach((id) => (els[id] = document.getElementById(id)));
    }

    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    async function load() {
        const rows = await CrudEngine.list("media_library", { orderBy: "uploaded_at", ascending: false });
        renderGrid(rows);
    }

    function renderGrid(rows) {
        els.mediaEmptyState.style.display = rows.length ? "none" : "block";
        els.mediaGrid.innerHTML = rows.map((m) => `
            <div class="media-item" data-id="${m.id}">
                <img src="${escapeHtml(m.file_url)}" alt="${escapeHtml(m.alt_text)}" loading="lazy">
                <div class="media-item-actions">
                    <button class="icon-btn" title="Copy URL" onclick="MediaLibraryModule.copyUrl('${escapeHtml(m.file_url)}')"><i class="fas fa-copy"></i></button>
                    <button class="icon-btn danger" title="Delete" onclick="MediaLibraryModule.remove('${m.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join("");
    }

    function copyUrl(url) {
        navigator.clipboard.writeText(url).then(() => showToast("Image URL copied"));
    }

    async function remove(id) {
        if (!confirm("Remove this image from the Media Library? (The underlying file in Storage is not deleted, in case it's still used elsewhere.)")) return;
        try {
            await CrudEngine.remove("media_library", id);
            showToast("Removed from Media Library");
            load();
        } catch (err) {
            showToast("Remove failed: " + err.message, true);
        }
    }

    async function upload(files) {
        if (!files || !files.length) return;
        try {
            const urls = await CrudEngine.uploadImagesWithProgress("site-media", Array.from(files), "media-library", (p) => {
                showToast(`Uploading ${p.done}/${p.total}…`);
            });
            for (const url of urls) {
                await CrudEngine.insert("media_library", { file_url: url, file_name: url.split("/").pop() });
            }
            showToast("Upload complete");
            load();
        } catch (err) {
            showToast("Upload failed: " + err.message, true);
        }
    }

    function bindEvents() {
        els.mediaUploadInput.addEventListener("change", (e) => upload(e.target.files));
    }

    document.addEventListener("DOMContentLoaded", () => {
        cacheEls();
        bindEvents();
    });

    return { load, copyUrl, remove };
})();

window.MediaLibraryModule = MediaLibraryModule;
