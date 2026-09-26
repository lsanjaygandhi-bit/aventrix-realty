/*
 * AVENTRIX REALTY — LEADS / ENQUIRIES CRM MODULE
 * -------------------------------------------
 * Upgrades the original read-only enquiry inbox into a practical
 * real-estate lead pipeline. Every enquiry submitted through any
 * website form still lands in the same `enquiries` table exactly as
 * before — this screen adds working fields on top of it:
 *
 *   stage · source · assigned realtor · requirement · budget ·
 *   preferred locations · linked property · last contact ·
 *   next follow-up · notes history (lead_notes)
 *
 * Permissions are enforced by Supabase RLS
 * (sql/migration-2026-09-25-02-p1-crm-buyer-analytics.sql):
 *   - admin   → every lead, can assign / delete
 *   - realtor → only leads assigned to them, cannot re-assign
 * The UI hides controls a realtor can't use, but never relies on
 * that for security.
 *
 * The original `status` column (new/read) keeps its meaning:
 * "has anyone opened this yet" — used for the sidebar badge.
 */

const EnquiriesModule = (function () {
    const STAGES = [
        ["NEW", "New"],
        ["CONTACTED", "Contacted"],
        ["REQUIREMENT_CONFIRMED", "Requirement Confirmed"],
        ["PROPERTY_SHARED", "Property Shared"],
        ["SITE_VISIT", "Site Visit"],
        ["NEGOTIATION", "Negotiation"],
        ["BOOKED", "Booked"],
        ["CLOSED", "Closed"],
        ["LOST", "Lost"]
    ];
    const STAGE_LABEL = Object.fromEntries(STAGES);
    const CLOSED_STAGES = ["CLOSED", "LOST"];
    const SOURCES = ["Website", "WhatsApp", "Instagram", "Facebook", "Referral", "Other"];

    let rows = [];
    let staff = [];          // [{ user_id, role, display_name }]
    let staffLoaded = false;
    let currentId = null;    // lead open in the modal (null = new lead)

    const isAdmin = () => window.AventrixAdminRole === "admin";

    // ---------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------
    function escapeHtml(str) {
        return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function fmtDateTime(iso) {
        if (!iso) return "—";
        const d = new Date(iso);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) + ", " +
            d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    }

    function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
    function startOfTomorrow() { const d = startOfToday(); d.setDate(d.getDate() + 1); return d; }

    // 'overdue' | 'today' | 'upcoming' | null
    function followUpBucket(r) {
        if (!r.next_follow_up_at || CLOSED_STAGES.includes(r.lead_stage)) return null;
        const t = new Date(r.next_follow_up_at);
        if (t < startOfToday()) return "overdue";
        if (t < startOfTomorrow()) return "today";
        return "upcoming";
    }

    function staffName(userId) {
        if (!userId) return "Unassigned";
        const s = staff.find((x) => x.user_id === userId);
        return s ? s.display_name : "Staff member";
    }

    function stageBadgeClass(stage) {
        if (stage === "CLOSED" || stage === "BOOKED") return "badge-available";
        if (stage === "LOST") return "badge-sold";
        if (stage === "NEGOTIATION" || stage === "SITE_VISIT") return "badge-negotiation";
        if (stage === "NEW") return "badge-featured";
        return "badge-draft";
    }

    async function loadStaff() {
        if (staffLoaded) return;
        const { data, error } = await CrudEngine.sb.rpc("staff_directory");
        if (!error && data) staff = data;
        staffLoaded = true;
    }

    async function currentUserId() {
        const { data } = await CrudEngine.sb.auth.getUser();
        return data && data.user ? data.user.id : null;
    }

    // ---------------------------------------------------------
    // Load + list
    // ---------------------------------------------------------
    async function fetchRows() {
        rows = await CrudEngine.list("enquiries");
        return rows;
    }

    async function load() {
        try {
            await loadStaff();
            await fetchRows();
            render();
            refreshBadge();
        } catch (err) {
            console.error(err);
            showToast("Couldn't load leads: " + (err.message || err), true);
        }
    }

    function filteredRows() {
        const stage = document.getElementById("filterLeadStage").value;
        const source = document.getElementById("filterLeadSource").value;
        const follow = document.getElementById("filterLeadFollowUp").value;
        const q = document.getElementById("filterLeadSearch").value.trim().toLowerCase();

        return rows.filter((r) => {
            if (stage === "open" && CLOSED_STAGES.includes(r.lead_stage)) return false;
            if (stage && stage !== "open" && r.lead_stage !== stage) return false;
            if (source && r.lead_source !== source) return false;
            if (follow) {
                const b = followUpBucket(r);
                if (follow === "none" ? b !== null : b !== follow) return false;
            }
            if (q) {
                const hay = [r.name, r.phone, r.email, r.property_code, r.form_type, r.requirement]
                    .map((v) => String(v || "").toLowerCase()).join(" ");
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }

    function render() {
        const body = document.getElementById("enquiriesTableBody");
        const empty = document.getElementById("enquiriesEmptyState");
        const list = filteredRows();
        empty.style.display = list.length ? "none" : "block";
        document.getElementById("leadsCount").textContent = `${list.length} of ${rows.length} leads`;

        body.innerHTML = list.map((r) => {
            const bucket = followUpBucket(r);
            const followCls = bucket === "overdue" ? "lead-follow overdue" : bucket === "today" ? "lead-follow today" : "lead-follow";
            return `
            <tr class="${r.status === "new" ? "lead-unread" : ""}">
                <td><span class="helper-text">${escapeHtml(fmtDateTime(r.created_at))}</span><br><span class="helper-text">${escapeHtml(r.form_type || "")}</span></td>
                <td><strong>${escapeHtml(r.name || "—")}</strong><br><span class="helper-text">${escapeHtml(r.phone || r.email || "")}</span></td>
                <td>${r.property_code ? `<span class="code-pill">${escapeHtml(r.property_code)}</span>` : '<span class="helper-text">—</span>'}</td>
                <td>${escapeHtml(r.lead_source || "")}</td>
                <td><span class="badge ${stageBadgeClass(r.lead_stage)}">${escapeHtml(STAGE_LABEL[r.lead_stage] || r.lead_stage || "")}</span></td>
                <td><span class="helper-text">${escapeHtml(staffName(r.assigned_to))}</span></td>
                <td><span class="${followCls}">${r.next_follow_up_at ? escapeHtml(fmtDateTime(r.next_follow_up_at)) : "—"}</span></td>
                <td class="admin-actions-cell">
                    <button class="icon-btn" title="Open" data-lead-open="${escapeHtml(r.id)}"><i class="fas fa-pen-to-square"></i></button>
                    ${isAdmin() ? `<button class="icon-btn danger" title="Delete" data-lead-delete="${escapeHtml(r.id)}"><i class="fas fa-trash"></i></button>` : ""}
                </td>
            </tr>`;
        }).join("");
    }

    // ---------------------------------------------------------
    // Detail / edit modal
    // ---------------------------------------------------------
    function fillSelect(el, pairs, value) {
        el.innerHTML = pairs.map(([v, l]) => `<option value="${escapeHtml(v)}">${escapeHtml(l)}</option>`).join("");
        el.value = value;
    }

    function splitLocal(iso) {
        if (!iso) return ["", ""];
        const d = new Date(iso);
        const pad = (n) => String(n).padStart(2, "0");
        return [`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, `${pad(d.getHours())}:${pad(d.getMinutes())}`];
    }

    function joinLocal(date, time) {
        if (!date) return null;
        const d = new Date(`${date}T${time || "10:00"}`);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }

    async function open(id) {
        await loadStaff();
        currentId = id || null;
        const r = id ? rows.find((x) => x.id === id) : null;
        if (id && !r) return;

        document.getElementById("leadModalTitle").textContent = r ? (r.name || r.phone || "Lead") : "New Lead";

        // Original submission (read-only, always escaped — public input).
        const orig = document.getElementById("leadOriginal");
        if (r) {
            const fields = Object.entries(r.payload || {})
                .map(([k, v]) => `<p class="lead-kv"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`).join("");
            orig.innerHTML = `
                <p class="helper-text">${escapeHtml(r.form_type || "")} · ${escapeHtml(fmtDateTime(r.created_at))} · from ${escapeHtml(r.source_page || "—")}</p>
                ${(r.phone || r.email) ? `<p class="lead-kv"><strong>Contact:</strong> ${escapeHtml(r.phone || "")} ${escapeHtml(r.email || "")}</p>` : ""}
                ${r.property_code ? `<p class="lead-kv"><strong>Property:</strong> <span class="code-pill">${escapeHtml(r.property_code)}</span>${r.property_slug ? ` <a href="../property.html?id=${encodeURIComponent(r.property_slug)}" target="_blank" rel="noopener">View listing ↗</a>` : ""}</p>` : ""}
                ${fields || '<p class="helper-text">No form fields (manually added lead).</p>'}`;
            orig.style.display = "";
        } else {
            orig.innerHTML = "";
            orig.style.display = "none";
        }

        // Contact fields only for manually-created leads, so a website
        // submission's original details are never overwritten.
        document.getElementById("leadContactRow").style.display = r ? "none" : "";
        document.getElementById("leadName").value = "";
        document.getElementById("leadPhone").value = "";
        document.getElementById("leadEmail").value = "";

        fillSelect(document.getElementById("leadStage"), STAGES, r ? r.lead_stage : "NEW");
        fillSelect(document.getElementById("leadSource"), SOURCES.map((s) => [s, s]), r ? r.lead_source : "WhatsApp");

        const assignEl = document.getElementById("leadAssigned");
        const myId = await currentUserId();
        fillSelect(assignEl, [["", "Unassigned"], ...staff.map((s) => [s.user_id, `${s.display_name} (${s.role})`])],
            r ? (r.assigned_to || "") : (isAdmin() ? "" : myId || ""));
        assignEl.disabled = !isAdmin();

        document.getElementById("leadPropertyCode").value = r ? (r.property_code || "") : "";
        document.getElementById("leadRequirement").value = r ? (r.requirement || "") : "";
        document.getElementById("leadBudgetMin").value = r && r.budget_min != null ? r.budget_min : "";
        document.getElementById("leadBudgetMax").value = r && r.budget_max != null ? r.budget_max : "";
        document.getElementById("leadLocations").value = r && r.preferred_locations ? r.preferred_locations.join(", ") : "";
        const [fd, ft] = splitLocal(r && r.next_follow_up_at);
        document.getElementById("leadFollowDate").value = fd;
        document.getElementById("leadFollowTime").value = ft;
        document.getElementById("leadLastContact").textContent = r && r.last_contact_at ? fmtDateTime(r.last_contact_at) : "Not recorded yet";
        document.getElementById("leadNewNote").value = "";
        document.getElementById("leadNotesList").innerHTML = "";

        document.getElementById("leadModalOverlay").classList.add("open");

        if (r) {
            loadNotes(r.id);
            if (r.status === "new") {
                try {
                    await CrudEngine.update("enquiries", r.id, { status: "read" });
                    r.status = "read";
                    render();
                    refreshBadge();
                } catch (err) { console.error(err); }
            }
        }
    }

    function close() {
        document.getElementById("leadModalOverlay").classList.remove("open");
        currentId = null;
    }

    async function loadNotes(enquiryId) {
        const list = document.getElementById("leadNotesList");
        list.innerHTML = '<p class="helper-text">Loading notes…</p>';
        const { data, error } = await CrudEngine.sb.from("lead_notes")
            .select("id, note, author_id, created_at")
            .eq("enquiry_id", enquiryId)
            .order("created_at", { ascending: false });
        if (error) {
            list.innerHTML = '<p class="helper-text">Couldn\'t load notes.</p>';
            return;
        }
        list.innerHTML = data.length
            ? data.map((n) => `<div class="lead-note"><p>${escapeHtml(n.note)}</p><span class="helper-text">${escapeHtml(staffName(n.author_id))} · ${escapeHtml(fmtDateTime(n.created_at))}</span></div>`).join("")
            : '<p class="helper-text">No notes yet.</p>';
    }

    function readForm() {
        const numOrNull = (v) => (v === "" || v == null ? null : Number(v));
        const record = {
            lead_stage: document.getElementById("leadStage").value,
            lead_source: document.getElementById("leadSource").value,
            requirement: document.getElementById("leadRequirement").value.trim() || null,
            budget_min: numOrNull(document.getElementById("leadBudgetMin").value),
            budget_max: numOrNull(document.getElementById("leadBudgetMax").value),
            preferred_locations: document.getElementById("leadLocations").value.split(",").map((s) => s.trim()).filter(Boolean),
            next_follow_up_at: joinLocal(document.getElementById("leadFollowDate").value, document.getElementById("leadFollowTime").value)
        };
        if (isAdmin()) record.assigned_to = document.getElementById("leadAssigned").value || null;
        return record;
    }

    async function resolvePropertyCode(code) {
        code = (code || "").trim().toUpperCase();
        if (!code) return { property_id: null, property_code: null, property_slug: null };
        const { data } = await CrudEngine.sb.from("properties").select("id, property_code, slug").eq("property_code", code).maybeSingle();
        if (!data) throw new Error(`No property found with code ${code}`);
        return { property_id: data.id, property_code: data.property_code, property_slug: data.slug };
    }

    async function save(logContact) {
        const btns = [document.getElementById("leadSaveBtn"), document.getElementById("leadLogContactBtn")];
        btns.forEach((b) => (b.disabled = true));
        try {
            const record = readForm();
            if (record.budget_min != null && record.budget_max != null && record.budget_min > record.budget_max) {
                throw new Error("Budget minimum is higher than the maximum.");
            }
            Object.assign(record, await resolvePropertyCode(document.getElementById("leadPropertyCode").value));
            if (logContact) record.last_contact_at = new Date().toISOString();

            const note = document.getElementById("leadNewNote").value.trim();
            let id = currentId;

            if (!id) {
                const name = document.getElementById("leadName").value.trim();
                const phone = document.getElementById("leadPhone").value.trim();
                if (!name && !phone) throw new Error("Enter at least a name or a phone number.");
                Object.assign(record, {
                    name: name || null,
                    phone: phone || null,
                    email: document.getElementById("leadEmail").value.trim() || null,
                    form_type: "Manual Lead",
                    source_page: "admin",
                    status: "read",
                    payload: {}
                });
                if (!isAdmin()) {
                    // A realtor's own lead is assigned to them so RLS
                    // (assigned leads only) lets them see it.
                    record.assigned_to = await currentUserId();
                }
                const created = await CrudEngine.insert("enquiries", record);
                id = created.id;
            } else {
                await CrudEngine.update("enquiries", id, record);
            }

            if (note) {
                const { error } = await CrudEngine.sb.from("lead_notes").insert({ enquiry_id: id, note });
                if (error) throw error;
            }

            showToast(logContact ? "Saved · contact logged" : "Lead saved");
            await fetchRows();
            render();
            if (logContact || note) open(id); else close();
            if (window.AventrixOverview) window.AventrixOverview.refresh();
        } catch (err) {
            console.error(err);
            showToast(err.message || "Couldn't save lead", true);
        } finally {
            btns.forEach((b) => (b.disabled = false));
        }
    }

    async function remove(id) {
        if (!confirm("Delete this lead and its notes permanently?")) return;
        try {
            await CrudEngine.remove("enquiries", id);
            showToast("Lead deleted");
            load();
        } catch (err) {
            showToast(err.message || "Couldn't delete", true);
        }
    }

    function refreshBadge() {
        const unread = rows.filter((r) => r.status === "new").length;
        const badge = document.getElementById("enquiryBadge");
        if (!badge) return;
        badge.style.display = unread ? "inline-block" : "none";
        badge.textContent = unread;
    }

    // ---------------------------------------------------------
    // Follow-up lists for the Overview dashboard
    // ---------------------------------------------------------
    async function renderFollowUps(containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;
        try {
            await loadStaff();
            await fetchRows();
        } catch (err) {
            el.innerHTML = '<p class="helper-text">Couldn\'t load follow-ups.</p>';
            return;
        }
        refreshBadge();
        const groups = { overdue: [], today: [], upcoming: [] };
        rows.forEach((r) => { const b = followUpBucket(r); if (b) groups[b].push(r); });
        Object.values(groups).forEach((g) => g.sort((a, b) => new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at)));

        const block = (key, title) => `
            <div class="followup-col followup-${key}">
                <h3>${title} <span class="followup-count">${groups[key].length}</span></h3>
                ${groups[key].length ? groups[key].slice(0, 8).map((r) => `
                    <button type="button" class="followup-item" data-lead-open="${escapeHtml(r.id)}">
                        <strong>${escapeHtml(r.name || r.phone || "Lead")}</strong>
                        <span>${escapeHtml(STAGE_LABEL[r.lead_stage] || "")}${r.property_code ? " · " + escapeHtml(r.property_code) : ""}</span>
                        <span class="helper-text">${escapeHtml(fmtDateTime(r.next_follow_up_at))} · ${escapeHtml(staffName(r.assigned_to))}</span>
                    </button>`).join("") : '<p class="helper-text">Nothing here.</p>'}
                ${groups[key].length > 8 ? `<p class="helper-text">+${groups[key].length - 8} more — see Leads.</p>` : ""}
            </div>`;
        el.innerHTML = block("overdue", "Overdue") + block("today", "Today") + block("upcoming", "Upcoming");
    }

    // ---------------------------------------------------------
    // Wiring
    // ---------------------------------------------------------
    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("filterLeadStage").innerHTML =
            '<option value="">All stages</option><option value="open">Open (not closed/lost)</option>' +
            STAGES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
        document.getElementById("filterLeadSource").innerHTML = '<option value="">All sources</option>' +
            SOURCES.map((s) => `<option value="${s}">${s}</option>`).join("");

        ["filterLeadStage", "filterLeadSource", "filterLeadFollowUp"].forEach((idf) =>
            document.getElementById(idf).addEventListener("change", render));
        document.getElementById("filterLeadSearch").addEventListener("input", render);

        document.getElementById("addLeadBtn").addEventListener("click", () => open(null));
        document.getElementById("closeLeadModal").addEventListener("click", close);
        document.getElementById("leadSaveBtn").addEventListener("click", () => save(false));
        document.getElementById("leadLogContactBtn").addEventListener("click", () => save(true));

        // Delegated clicks (lead table + overview follow-up lists).
        document.addEventListener("click", (e) => {
            const openBtn = e.target.closest("[data-lead-open]");
            if (openBtn) {
                const id = openBtn.getAttribute("data-lead-open");
                if (!document.getElementById("section-enquiries").contains(openBtn) && window.AventrixShowSection) {
                    window.AventrixShowSection("enquiries", { skipLoad: true });
                    render();
                }
                open(id);
                return;
            }
            const delBtn = e.target.closest("[data-lead-delete]");
            if (delBtn) remove(delBtn.getAttribute("data-lead-delete"));
        });
    });

    return { load, open, remove, renderFollowUps, refreshBadge };
})();

window.EnquiriesModule = EnquiriesModule;
