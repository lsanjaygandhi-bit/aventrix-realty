/* Admin-side generation and human review for property translations. */
(function () {
    "use strict";

    const sb = window.supabaseClient;
    const MAX_RUN_CHARS = 200000;
    const FIELD_LABELS = {
        title: "Title",
        short_description: "Short description",
        description: "Full description",
        location: "Location",
        features: "Features",
        seo_title: "SEO title",
        seo_description: "SEO description",
        seo_keywords: "SEO keywords"
    };

    let estimate = null;
    let loading = false;
    let reviewLoading = false;
    let queueRows = [];
    let propertiesById = {};

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    function sourceValue(property, field) {
        const value = property && property[field];
        if (field === "features") return Array.isArray(value) ? value.join("\n") : "";
        return typeof value === "string" ? value : "";
    }

    function editorValue(value, field) {
        if (field === "features") return Array.isArray(value) ? value.join("\n") : "";
        return typeof value === "string" ? value : "";
    }

    function valueFromEditor(text, field) {
        if (field === "features") return text.split(/\r?\n/).filter((line) => line.trim());
        return text;
    }

    function numericFacts(text) {
        return text.match(/\d+(?:,\d{3})*(?:\.\d+)?%?/g) || [];
    }

    function numericFactsMatch(source, translation) {
        return JSON.stringify(numericFacts(source)) === JSON.stringify(numericFacts(translation));
    }

    async function hashSource(text) {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    }

    async function sourceIsCurrent(property, row) {
        const text = sourceValue(property, row.field);
        return Boolean(text.trim() && row.source_hash && await hashSource(text) === row.source_hash);
    }

    function setStatus(message, isError) {
        const el = document.getElementById("ptStatus");
        if (!el) return;
        el.textContent = message;
        el.classList.toggle("pt-error", Boolean(isError));
    }

    function setBusy(value) {
        loading = value;
        const sourceCharacters = Number(estimate && estimate.source_characters) || 0;
        ["ptDryRunBtn", "ptRunBtn", "ptRefreshBtn", "ptLanguage"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.disabled = value || (id === "ptRunBtn" && (!sourceCharacters || sourceCharacters > MAX_RUN_CHARS));
        });
    }

    async function invokeTranslation(body) {
        const { data, error } = await sb.functions.invoke("translate-property", { body });
        if (error) {
            let message = error.message || "Translation function request failed.";
            if (error.context && typeof error.context.json === "function") {
                try {
                    const detail = await error.context.json();
                    if (detail && typeof detail.error === "string") message = detail.error;
                    if (detail && typeof detail.setup === "string") message += " Setup: " + detail.setup;
                    if (detail && Number.isInteger(detail.written)) {
                        message += " " + detail.written + " translation rows were saved before the run stopped.";
                    }
                } catch (parseError) {
                    console.warn("Could not read the translation function error response.", parseError);
                }
            }
            throw new Error(message);
        }
        if (!data || data.error) throw new Error(data && data.error || "Translation function returned no result.");
        return data;
    }

    async function runEstimate() {
        if (loading) return;
        estimate = null;
        setBusy(true);
        setStatus("Counting missing or stale fields for all published properties…");
        try {
            const lang = document.getElementById("ptLanguage").value;
            estimate = await invokeTranslation({
                langs: [lang],
                dry_run: true,
                max_chars: MAX_RUN_CHARS
            });
            const chars = Number(estimate.source_characters) || 0;
            const runBtn = document.getElementById("ptRunBtn");
            runBtn.disabled = !chars || chars > MAX_RUN_CHARS;
            setStatus(chars
                ? `${estimate.properties} published properties checked. ${estimate.jobs} text fields need ${chars.toLocaleString()} source characters in ${lang}. OpenAI charges by tokens; this count is not a dollar estimate.${chars > MAX_RUN_CHARS ? ` This exceeds the ${MAX_RUN_CHARS.toLocaleString()}-character run limit.` : " Generate only after reviewing this workload estimate."}`
                : `${estimate.properties} published properties checked. No missing or stale fields need translation in ${lang}.`);
        } catch (error) {
            setStatus(error.message || "Could not estimate translations.", true);
        } finally {
            setBusy(false);
        }
    }

    async function generateTranslations() {
        if (loading || !estimate || !estimate.source_characters) return;
        const chars = Number(estimate.source_characters);
        const lang = document.getElementById("ptLanguage").value;
        if (!window.confirm(`Generate ${lang} translations for ${chars.toLocaleString()} source characters? OpenAI charges by tokens, so this is not a dollar estimate. Machine translations remain hidden until reviewed and approved.`)) return;
        setBusy(true);
        setStatus("Generating translations. This can take a little while; completed batches are retained if a later batch fails.");
        try {
            const result = await invokeTranslation({
                langs: [lang],
                dry_run: false,
                max_chars: MAX_RUN_CHARS,
                confirm_characters: chars
            });
            estimate = null;
            document.getElementById("ptRunBtn").disabled = true;
            setStatus(`Generation completed: ${result.written} translation fields saved; ${result.skipped_protected} existing human decisions were protected; ${Number(result.source_characters || 0).toLocaleString()} source characters processed.`);
            await loadReview();
        } catch (error) {
            estimate = null;
            document.getElementById("ptRunBtn").disabled = true;
            setStatus(error.message || "Translation generation failed.", true);
            await loadReview();
        } finally {
            setBusy(false);
        }
    }

    function renderQueue(counts) {
        const countsEl = document.getElementById("ptCounts");
        countsEl.textContent = `Approved: ${counts.approved} · Awaiting review: ${counts.machine} · Stale: ${counts.stale} · Rejected: ${counts.rejected}`;

        const list = document.getElementById("ptReviewList");
        const pending = queueRows.filter((row) => row.status === "machine" || row.status === "stale");
        if (!pending.length) {
            list.innerHTML = '<p class="helper-text">No machine translations are waiting for review in this language.</p>';
            return;
        }

        const groups = new Map();
        pending.forEach((row) => {
            if (!groups.has(row.property_id)) groups.set(row.property_id, []);
            groups.get(row.property_id).push(row);
        });
        list.innerHTML = Array.from(groups.entries()).map(([propertyId, rows]) => {
            const property = propertiesById[propertyId] || {};
            const machineCount = rows.filter((row) => {
                const source = sourceValue(propertiesById[propertyId], row.field);
                const translated = editorValue(row.value, row.field);
                return row.status === "machine" && row.source_current && numericFactsMatch(source, translated);
            }).length;
            const hasStale = rows.some((row) => {
                const source = sourceValue(propertiesById[propertyId], row.field);
                const translated = editorValue(row.value, row.field);
                return row.status === "stale" || !row.source_current || !numericFactsMatch(source, translated);
            });
            const fields = rows.map((row) => {
                const source = sourceValue(property, row.field);
                const translation = editorValue(row.value, row.field);
                const stale = row.status === "stale" || !row.source_current;
                const factsMatch = numericFactsMatch(source, translation);
                const key = `${row.property_id}|${row.field}`;
                return `<article class="pt-translation-row" data-pt-row data-property-id="${escapeHtml(row.property_id)}" data-field="${escapeHtml(row.field)}">
                    <div class="pt-translation-heading">
                        <strong>${escapeHtml(FIELD_LABELS[row.field] || row.field)}</strong>
                        <span class="pt-status-pill ${stale || !factsMatch ? "stale" : "machine"}">${stale ? "Stale — regenerate" : !factsMatch ? "Numeric facts differ — correct before approval" : "Machine — review required"}</span>
                    </div>
                    <div class="pt-comparison">
                        <div><h4>English source</h4><pre>${escapeHtml(source || "(empty source)")}</pre></div>
                        <div><label for="pt-editor-${escapeHtml(key)}">Translation</label><textarea id="pt-editor-${escapeHtml(key)}" data-pt-editor rows="${row.field === "description" ? 6 : row.field === "features" ? 5 : 3}">${escapeHtml(translation)}</textarea></div>
                    </div>
                    <div class="pt-row-actions">
                        <button type="button" class="admin-btn secondary" data-pt-action="save" ${stale ? "disabled" : ""}>Save draft</button>
                        <button type="button" class="admin-btn gold" data-pt-action="approve" ${stale || !factsMatch ? "disabled" : ""}>Approve field</button>
                        <button type="button" class="admin-btn danger" data-pt-action="reject" ${stale ? "disabled" : ""}>Reject field</button>
                    </div>
                </article>`;
            }).join("");
            return `<section class="pt-property-group" data-pt-group="${escapeHtml(propertyId)}">
                <div class="pt-property-heading">
                    <div><h3>${escapeHtml(property.title || "Property")}</h3><span>${escapeHtml(property.slug || propertyId)}</span></div>
                    <button type="button" class="admin-btn gold" data-pt-action="approve-group" ${!machineCount || hasStale ? "disabled" : ""}>Approve all current fields (${machineCount})</button>
                </div>
                ${fields}
            </section>`;
        }).join("");

        list.querySelectorAll("[data-pt-editor]").forEach((editor) => {
            editor.addEventListener("input", () => {
                const row = editor.closest("[data-pt-row]");
                const original = queueRows.find((item) => item.property_id === row.dataset.propertyId && item.field === row.dataset.field);
                if (!original) return;
                const changed = JSON.stringify(valueFromEditor(editor.value, original.field)) !== JSON.stringify(original.value);
                editor.classList.toggle("pt-unsaved", changed);
            });
        });
    }

    async function loadReview() {
        if (reviewLoading) return;
        reviewLoading = true;
        const languageSelect = document.getElementById("ptLanguage");
        languageSelect.disabled = true;
        const list = document.getElementById("ptReviewList");
        list.innerHTML = '<p class="helper-text">Loading translation review queue…</p>';
        try {
            const lang = document.getElementById("ptLanguage").value;
            const { data, error } = await sb.from("property_translations")
                .select("property_id,lang,field,value,source_hash,status,provider")
                .eq("lang", lang)
                .order("property_id")
                .range(0, 1999);
            if (error) throw error;
            queueRows = data || [];
            const ids = Array.from(new Set(queueRows.map((row) => row.property_id)));
            propertiesById = {};
            if (ids.length) {
                const { data: properties, error: propertyError } = await sb.from("properties")
                    .select("id,slug,title,short_description,description,location,features,seo_title,seo_description,seo_keywords")
                    .in("id", ids);
                if (propertyError) throw propertyError;
                (properties || []).forEach((property) => { propertiesById[property.id] = property; });
            }
            const counts = { approved: 0, machine: 0, stale: 0, rejected: 0 };
            queueRows.forEach((row) => {
                if (Object.prototype.hasOwnProperty.call(counts, row.status)) counts[row.status]++;
            });
            await Promise.all(queueRows.map(async (row) => {
                if (row.status !== "machine") return;
                row.source_current = await sourceIsCurrent(propertiesById[row.property_id], row);
            }));
            renderQueue(counts);
        } catch (error) {
            list.innerHTML = "";
            setStatus(`Could not load translations: ${error.message || "database request failed"}`, true);
        } finally {
            reviewLoading = false;
            languageSelect.disabled = loading;
        }
    }

    async function updateRow(rowEl, action) {
        const propertyId = rowEl.dataset.propertyId;
        const field = rowEl.dataset.field;
        const row = queueRows.find((item) => item.property_id === propertyId && item.field === field);
        const editor = rowEl.querySelector("[data-pt-editor]");
        if (!row || !editor) return;
        if (row.status !== "machine" || !row.source_current) {
            setStatus("This translation is stale and cannot be approved. Generate it again from the current English source.", true);
            return;
        }

        const value = valueFromEditor(editor.value, field);
        if (Array.isArray(value) ? !value.length : !value.trim()) {
            setStatus("A translation cannot be saved or approved as empty.", true);
            return;
        }
        if (action === "approve" && !numericFactsMatch(sourceValue(propertiesById[propertyId], field), editor.value)) {
            setStatus("Numeric facts must exactly match the English source before approval.", true);
            return;
        }
        const changes = action === "reject"
            ? { status: "rejected" }
            : action === "approve"
                ? { value, status: "approved", provider: `${row.provider || "unknown"}+human-reviewed` }
                : { value };
        const { data, error } = await sb.from("property_translations").update(changes)
            .eq("property_id", propertyId)
            .eq("lang", row.lang)
            .eq("field", field)
            .eq("status", "machine")
            .select("field");
        if (error) throw error;
        if (!data || !data.length) throw new Error("The row changed before it could be saved. Refresh the review queue.");
        setStatus(action === "approve" ? "Translation approved and now eligible to appear publicly." : action === "reject" ? "Translation rejected; the public site continues to use English." : "Draft translation saved; it remains hidden from the public.");
        await loadReview();
    }

    async function approveGroup(groupEl) {
        const propertyId = groupEl.dataset.ptGroup;
        const groupRows = queueRows.filter((row) => row.property_id === propertyId && row.status === "machine");
        if (!groupRows.length || groupRows.some((row) => !row.source_current)) {
            throw new Error("The group contains stale translations. Regenerate those fields before approval.");
        }
        for (const row of groupRows) {
            const rowEl = groupEl.querySelector(`[data-pt-row][data-field="${CSS.escape(row.field)}"]`);
            const editor = rowEl && rowEl.querySelector("[data-pt-editor]");
            if (!editor || JSON.stringify(valueFromEditor(editor.value, row.field)) !== JSON.stringify(row.value)) {
                throw new Error("Save or approve edited fields individually before bulk approval.");
            }
            if (!numericFactsMatch(sourceValue(propertiesById[propertyId], row.field), editor.value)) {
                throw new Error("A field changes numeric facts. Correct it before bulk approval.");
            }
        }
        if (!window.confirm(`Approve all ${groupRows.length} current machine-translated fields for ${propertiesById[propertyId]?.title || "this property"}?`)) return;
        const lang = document.getElementById("ptLanguage").value;
        const { data, error } = await sb.from("property_translations")
            .update({ status: "approved" })
            .eq("property_id", propertyId)
            .eq("lang", lang)
            .eq("status", "machine")
            .select("field");
        if (error) throw error;
        if (!data || data.length !== groupRows.length) {
            throw new Error(`Only ${data ? data.length : 0} of ${groupRows.length} fields were approved. Refresh and review the current queue.`);
        }
        setStatus(`${data.length} translation fields approved for this property and language.`);
        await loadReview();
    }

    function handleQueueClick(event) {
        if (loading) return;
        const button = event.target.closest("[data-pt-action]");
        if (!button || button.disabled) return;
        const action = button.dataset.ptAction;
        const target = action === "approve-group" ? button.closest("[data-pt-group]") : button.closest("[data-pt-row]");
        if (!target) return;
        setBusy(true);
        const work = action === "approve-group" ? approveGroup(target) : updateRow(target, action);
        Promise.resolve(work).catch((error) => {
            setStatus(error.message || "Could not update translation review status.", true);
        }).finally(() => setBusy(false));
    }

    function init() {
        const section = document.getElementById("section-translations");
        if (!section || section.dataset.ptInitialized) return;
        section.dataset.ptInitialized = "true";
        document.getElementById("ptDryRunBtn").addEventListener("click", runEstimate);
        document.getElementById("ptRunBtn").addEventListener("click", generateTranslations);
        document.getElementById("ptRefreshBtn").addEventListener("click", loadReview);
        document.getElementById("ptLanguage").addEventListener("change", () => {
            estimate = null;
            document.getElementById("ptRunBtn").disabled = true;
            loadReview();
        });
        document.getElementById("ptReviewList").addEventListener("click", handleQueueClick);
    }

    window.PropertyTranslationsModule = {
        load: function () {
            init();
            return loadReview();
        }
    };
})();
