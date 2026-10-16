/* =====================================================================
   AVENTRIX REALTY — PROPERTY INTELLIGENCE CENTRE (page behaviour)
   Loaded by the Property Tools pages only, after script.js. Each block
   runs only when its own markup is on the page.

     1. Due-diligence checklists     (property-checklists.html)
     2. Indicative valuation          (property-valuation.html)
     3. Commercial investment returns (commercial-investment.html)

   The shared header, mobile drawer, back-to-top, phone numbers and
   wishlist icons are handled by the site's own script.js,
   public-site-settings.js and wishlist-widget.js — nothing here
   touches them. Nothing on these pages writes to Supabase.
   ===================================================================== */
(function () {
    "use strict";

    var $ = function (id) { return document.getElementById(id); };

    /* -------- number parsing & Indian formatting -------- */
    function readNumber(id) {
        var el = $(id);
        if (!el) return NaN;
        var raw = String(el.value).replace(/,/g, "").trim();
        if (raw === "") return NaN;
        var v = Number(raw);
        return Number.isFinite(v) ? v : NaN;
    }
    function inr(v) {
        if (!Number.isFinite(v)) return "—";
        var r = Math.round(v);
        return (r < 0 ? "−₹" : "₹") + Math.abs(r).toLocaleString("en-IN");
    }
    // ₹ in Lakh / Crore for headline figures (exact rupee value shown alongside)
    function inrShort(v) {
        if (!Number.isFinite(v)) return "—";
        var a = Math.abs(v), s = v < 0 ? "−" : "";
        if (a >= 1e7) return s + "₹" + (a / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " Cr";
        if (a >= 1e5) return s + "₹" + (a / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " L";
        return inr(v);
    }
    function pct(v) {
        if (!Number.isFinite(v)) return "—";
        return (v < 0 ? "−" : "") + Math.abs(v * 100).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + "%";
    }
    function sqft(v) {
        if (!Number.isFinite(v)) return "—";
        return Math.round(v).toLocaleString("en-IN") + " sq.ft.";
    }
    function setText(id, text) { var el = $(id); if (el) el.textContent = text; }
    function setError(inputId, msg) {
        var input = $(inputId), err = $(inputId + "-error");
        if (input) input.setAttribute("aria-invalid", msg ? "true" : "false");
        if (err) err.textContent = msg || "";
    }
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    /* =================================================================
       1. CHECKLISTS — item text preserved from the original tool.
       ================================================================= */
    var LISTS = {
        flat: { title: "Flat / Apartment", items: ["Verify parent deed and ownership chain with an advocate.", "Obtain current Encumbrance Certificate for the relevant period.", "Check RERA registration and project disclosures where applicable.", "Verify planning permission, building permit and applicable completion / occupancy certificate.", "Confirm carpet area, UDS, floor, parking rights and common-area terms in writing.", "Check property-tax, maintenance, water, electricity and association dues.", "Inspect structure, waterproofing, plumbing, lifts, fire-safety provisions and common areas.", "Assess waterlogging, flood exposure, access, drainage and neighbourhood conditions.", "Calculate stamp duty, registration, taxes, fit-out, maintenance and other total acquisition costs.", "Review resale demand, rent evidence and financing terms independently."] },
        land: { title: "Land / Plot", items: ["Verify title chain, original deeds and owner identity through an advocate.", "Obtain relevant Patta / Chitta / A-Register / TSLR records where applicable.", "Obtain EC for an advocate-advised period; investigate all entries and gaps.", "Match survey number, subdivision, extent and boundaries with FMB / survey records as applicable.", "Physically verify boundaries, legal road access, frontage and encroachments with a surveyor.", "Verify layout approval and planning jurisdiction; do not rely on brochure claims.", "Check zoning, road widening, acquisition proposals, waterbody and other restrictions.", "Compare guideline value separately from asking prices and transaction evidence.", "Confirm tax dues, mortgages, litigation, easements and co-owner consent.", "Ask a qualified architect to assess current buildability, setbacks and FSI for the actual site."] },
        commercial: { title: "Commercial Investment", items: ["Verify title, permitted use, building approvals and relevant occupancy documentation.", "Review executed lease, tenant covenant, deposit, lock-in, escalation and termination terms.", "Verify actual rent receipts, vacancy history, CAM, taxes, insurance and operating costs.", "Estimate effective rent after vacancy and net operating income (NOI).", "Calculate gross yield, net yield and cash flow after debt service.", "Stress-test rent loss, repairs, interest-rate changes and tenant exit.", "Check parking, access, utilities, fire safety and compliance for the intended use.", "Review GST, income-tax, transaction costs and professional advice as applicable.", "Assess resale liquidity, lease expiry and exit assumptions."] },
        jv: { title: "Joint Venture", items: ["Verify all owners, title chain, EC, mortgages, disputes and restrictions.", "Confirm all owner / co-owner consent and authority to negotiate.", "Record survey number, exact extent, frontage, road width and access.", "Obtain architect's preliminary planning review for jurisdiction, zoning, FSI and setbacks.", "Model saleable area, selling price and downside scenarios using explicit assumptions.", "Include construction, approval, consultant, finance, marketing, tax and contingency costs.", "Show developer capital, target profit, landowner entitlement and payment timing separately.", "Compare area share, cash consideration and hybrid structures without assuming a standard ratio.", "Have an advocate review JV agreement, POA, milestones, security, default, termination and dispute terms.", "Set written conditions for title due diligence, approvals, timelines and exit / delay scenarios."] },
        seller: { title: "Seller / Landowner", items: ["Clarify objective: outright sale, lease, JV or retaining part of the asset.", "Assemble title documents, EC, tax receipts, approvals and survey / area records as applicable.", "List co-owners, mortgages, litigation, tenants and other material disclosures.", "Record exact location, extent, frontage, road access, building age and condition.", "Separate guideline value, asking prices, comparable transactions and formal valuation.", "Define acceptable price range, timeline, negotiation authority and payment terms.", "For a JV, obtain architect feasibility and an independent legal review before committing.", "Redact identity numbers and avoid sending original or sensitive documents through unsecured channels."] }
    };

    function initChecklist() {
        var select = $("checklist-type"), host = $("checklist");
        if (!select || !host) return;

        // Deep links such as property-checklists.html?type=jv (used by the
        // JV and Seller pages) open the matching list.
        try {
            var wanted = new URLSearchParams(window.location.search).get("type");
            if (wanted && LISTS[wanted]) select.value = wanted;
        } catch (e) { /* older browsers: keep the default list */ }

        function progress() {
            var boxes = host.querySelectorAll("input[type=checkbox]");
            var done = Array.prototype.filter.call(boxes, function (b) { return b.checked; }).length;
            setText("check-progress", done + " of " + boxes.length + " items checked. Use Print / Save PDF to keep a copy — ticks are not saved after you leave this page.");
            var bar = $("check-progress-bar");
            if (bar) bar.style.width = (boxes.length ? (done / boxes.length) * 100 : 0) + "%";
        }

        function render() {
            var key = LISTS[select.value] ? select.value : "flat";
            var list = LISTS[key];
            host.innerHTML =
                '<div class="pt-print-brand pt-print-only">' +
                    '<img src="images/aventrix-logo.png" alt="Aventrix Realty logo">' +
                    '<div><p class="pt-print-kicker">PROPERTY INTELLIGENCE CENTRE</p>' +
                    '<h1>AVENTRIX REALTY</h1><p>Property Due-Diligence Checklist</p></div>' +
                '</div>' +
                '<div class="pt-print-meta pt-print-only">' +
                    '<div><span>Checklist</span><strong>' + escapeHtml(list.title) + '</strong></div>' +
                    '<div><span>Date</span><strong>' + escapeHtml(new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })) + '</strong></div>' +
                    '<div><span>Property / Project</span><strong>________________________________</strong></div>' +
                    '<div><span>Location</span><strong>________________________________</strong></div>' +
                    '<div><span>Owner / Contact</span><strong>________________________________</strong></div>' +
                    '<div><span>Reviewed by</span><strong>________________________________</strong></div>' +
                '</div>' +
                '<h2 id="checklist-title">' + escapeHtml(list.title) + " checklist</h2>" +
                '<p class="pt-print-instructions pt-print-only">Tick each item after checking the relevant document or site condition. Mark items that need follow-up and record notes where necessary.</p>' +
                '<div class="pt-print-column-head pt-print-only"><span>Verification item</span><span>Status</span><span>Notes / Follow-up</span></div>' +
                list.items.map(function (text, i) {
                    var id = "chk-" + key + "-" + i;
                    return '<label class="pt-check-item" for="' + id + '"><input type="checkbox" id="' + id + '"><span class="pt-check-label-text">' + escapeHtml(text) + '</span><span class="pt-print-status pt-print-only">☐ Yes&nbsp;&nbsp; ☐ No&nbsp;&nbsp; ☐ N/A</span><span class="pt-print-notes pt-print-only"></span></label>';
                }).join("") +
                '<div class="pt-print-signoff pt-print-only"><div><span>Prepared / Checked by</span><i></i></div><div><span>Signature</span><i></i></div><div><span>Date</span><i></i></div></div>' +
                '<div class="pt-print-disclaimer pt-print-only"><strong>Important:</strong> This checklist is a preparation aid, not a title-clearance certificate, legal opinion or technical certification. Obtain independent legal and technical due diligence from qualified professionals before paying an advance or signing an agreement.' +
                '<small>Aventrix Realty · Chennai, Tamil Nadu · aventrixrealty.com</small></div>';
            host.setAttribute("aria-labelledby", "checklist-title");
            progress();
        }

        host.addEventListener("change", progress);
        select.addEventListener("change", function () {
            render();
            try {
                var url = new URL(window.location.href);
                url.searchParams.set("type", select.value);
                history.replaceState(history.state, "", url.toString());
            } catch (e) { /* ignore */ }
        });
        var printBtn = $("print-checklist"), resetBtn = $("reset-checklist");
        if (printBtn) printBtn.addEventListener("click", function () { window.print(); });
        if (resetBtn) resetBtn.addEventListener("click", function () {
            host.querySelectorAll("input[type=checkbox]").forEach(function (c) { c.checked = false; });
            progress();
        });
        render();
    }

    /* =================================================================
       2. INDICATIVE VALUATION
       Rates come from data/market-rates.json (schema v2). Only rows with
       status "published" are used; "draft" rows are never shown as an
       Aventrix published rate. Locality matching is exact on a normalised
       name or one of the row's aliases — another locality's rate is never
       substituted. Visitors can always switch to their own reference rate.
       ================================================================= */
    var SQFT_PER = { sqft: 1, ground: 2400, cent: 435.6, acre: 43560 };
    var BASIS_LABEL = {
        asking: "Online asking prices (portal / developer published figures)",
        guideline: "Government guideline value",
        registered: "Registered sale (transaction) evidence",
        opinion: "Professional opinion / other",
        unsure: "Not sure of the basis"
    };
    var TYPE_LABEL = { apartment: "Apartment / flat", land: "Residential land / plot", commercial: "Commercial property" };
    var AREA_BASIS_LABEL = { super_built_up: "super built-up area", built_up: "built-up area", carpet: "carpet area", plot_area: "plot area" };
    var CONF_LABEL = { high: "High", medium: "Medium", low: "Low" };

    function normLoc(s) {
        return String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
    }
    function fmtDate(iso) {
        if (!iso) return "—";
        var d = new Date(iso + "T00:00:00");
        return isNaN(d) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }
    function rateText(lo, hi, unitLabel) {
        return inr(lo) + (hi > lo ? " – " + inr(hi) : "") + (unitLabel || " / sq.ft.");
    }
    function validRow(r) {
        return r && r.status === "published" && TYPE_LABEL[r.property_type] && r.locality &&
            Number(r.low) > 0 && Number(r.high) >= Number(r.low) && Array.isArray(r.sources) && r.sources.length > 0 && r.last_checked;
    }

    function initValuation() {
        var form = $("valuation-tool");
        if (!form) return;

        var state = { rows: [], status: "loading", data: null, lastKey: "", userChoseOwn: false };

        function currentType() { return form.elements.propertyType.value; }
        function findPublished(locality, type) {
            var key = normLoc(locality);
            if (!key) return null;
            for (var i = 0; i < state.rows.length; i++) {
                var r = state.rows[i];
                if (r.property_type !== type) continue;
                var names = [r.locality].concat(r.aliases || []);
                for (var j = 0; j < names.length; j++) if (normLoc(names[j]) === key) return r;
            }
            return null;
        }
        function typesFor(locality) {
            var key = normLoc(locality), out = [];
            state.rows.forEach(function (r) {
                var names = [r.locality].concat(r.aliases || []);
                if (names.some(function (n) { return normLoc(n) === key; }) && out.indexOf(r.property_type) < 0) out.push(r.property_type);
            });
            return out;
        }

        function fillLocalities() {
            var sel = $("val-locality");
            if (!sel) return;
            var keep = sel.value, names = [];
            state.rows.forEach(function (r) { if (names.indexOf(r.locality) < 0) names.push(r.locality); });
            names.sort(function (a, b) { return a.localeCompare(b); });
            var short = { apartment: "flat", land: "land", commercial: "commercial" };
            sel.innerHTML = '<option value="">Select a locality</option>' +
                names.map(function (n) {
                    var types = typesFor(n).map(function (t) { return short[t]; }).join(", ");
                    return '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + (types ? " (" + types + ")" : "") + "</option>";
                }).join("") +
                '<option value="__other">Other locality (enter your own rate)</option>';
            if (keep && Array.prototype.some.call(sel.options, function (o) { return o.value === keep; })) sel.value = keep;
        }

        function renderPublishedPanel(row, locality, type) {
            var panel = $("val-published-panel");
            if (!panel) return;
            var loc = locality.trim();
            if (state.status === "loading") { panel.innerHTML = '<p class="pt-hint">Loading Aventrix published rates…</p>'; return; }
            if (state.status === "error") {
                panel.innerHTML = '<p class="pt-error">The Aventrix rate table could not be loaded. Please enter your own reference rate below, or try again later.</p>';
                return;
            }
            if (!loc) { panel.innerHTML = '<p class="pt-hint">Select a locality above to use its Aventrix published rate.</p>'; return; }
            if (loc === "__other") { panel.innerHTML = '<p class="pt-hint">No published rate for other localities — enter your own reference rate below.</p>'; return; }
            if (!row) {
                var other = typesFor(loc).filter(function (t) { return t !== type; });
                panel.innerHTML = '<p class="pt-error" role="status"><strong>Rate not yet available for this locality/property type.</strong></p>' +
                    '<p class="pt-hint">No Aventrix published rate for ' + escapeHtml(TYPE_LABEL[type].toLowerCase()) + ' in “' + escapeHtml(loc) + '”. Enter your own reference rate below.' +
                    (other.length ? " A published rate exists for " + other.map(function (t) { return escapeHtml(TYPE_LABEL[t].toLowerCase()); }).join(" and ") + " in this locality." : "") + "</p>";
                return;
            }
            panel.innerHTML =
                '<div class="pt-rate-card">' +
                '<p class="pt-rate-figure"><strong>' + escapeHtml(rateText(Number(row.low), Number(row.high))) + "</strong>" +
                (row.high > row.low ? ' <span class="pt-hint">midpoint ' + escapeHtml(inr(Number(row.mid))) + "</span>" : "") + "</p>" +
                '<p class="pt-hint">' + escapeHtml(row.locality) + " · " + escapeHtml(TYPE_LABEL[row.property_type]) + " · " + escapeHtml(BASIS_LABEL[row.rate_basis] || row.rate_basis) +
                " · quoted on " + escapeHtml(AREA_BASIS_LABEL[row.area_basis] || "area as listed") +
                " · confidence: " + escapeHtml(CONF_LABEL[row.confidence] || row.confidence) +
                " · last checked " + escapeHtml(fmtDate(row.last_checked)) + "</p>" +
                "</div>";
        }

        function renderRateTable() {
            var body = $("rate-table-body");
            if (!body) return;
            if (state.status === "error") {
                body.innerHTML = '<tr><td colspan="5" class="pt-empty">The rate table could not be loaded.</td></tr>';
                return;
            }
            if (!state.rows.length) {
                body.innerHTML = '<tr><td colspan="5" class="pt-empty">No Aventrix published rates yet.</td></tr>';
                return;
            }
            var rows = state.rows.slice().sort(function (a, b) {
                return a.locality.localeCompare(b.locality) || a.property_type.localeCompare(b.property_type);
            });
            body.innerHTML = rows.map(function (r) {
                return "<tr><td>" + escapeHtml(r.locality) + "</td><td>" + escapeHtml(TYPE_LABEL[r.property_type]) +
                    "</td><td>" + escapeHtml(rateText(Number(r.low), Number(r.high))) +
                    "</td><td>" + escapeHtml(CONF_LABEL[r.confidence] || r.confidence || "—") + "</td><td>" + escapeHtml(fmtDate(r.last_checked)) + "</td></tr>";
            }).join("");
            var gaps = $("rate-table-gaps");
            if (gaps && state.data) {
                var drafts = (state.data.rates || []).filter(function (r) { return r && r.status !== "published"; })
                    .map(function (r) { return r.locality + " (" + (TYPE_LABEL[r.property_type] || r.property_type).toLowerCase() + ")"; });
                gaps.textContent = "Not yet available: " + (drafts.length ? drafts.join(", ") : "none") +
                    ". Commercial property: no published rates yet.";
            }
        }

        function syncTypeUi() {
            var type = currentType();
            var isLand = type === "land";
            var areaUnit = $("val-area-unit"), rateUnit = $("val-rate-unit");
            Array.prototype.forEach.call(areaUnit.options, function (o) { o.disabled = !isLand && o.value !== "sqft"; });
            if (!isLand) areaUnit.value = "sqft";
            Array.prototype.forEach.call(rateUnit.options, function (o) { o.disabled = !isLand && o.value !== "sqft"; });
            if (!isLand) rateUnit.value = "sqft";
            $("val-area-basis-wrap").hidden = type !== "apartment";
        }

        function syncSource(row) {
            var pub = $("val-source-published"), own = $("val-source-own");
            var locVal = $("val-locality").value;
            var noLocality = locVal === "";
            var key = normLoc(locVal) + "|" + currentType();
            // Before a locality is chosen the published option stays selectable
            // (it is the default); it is disabled only when the chosen locality
            // has no published rate for this property type.
            pub.disabled = !row && !noLocality;
            if (key !== state.lastKey) {
                // New locality / property type: use the published rate when one exists.
                state.lastKey = key;
                state.userChoseOwn = false;
                if (row || noLocality) pub.checked = true; else own.checked = true;
            } else if (!row && !noLocality && pub.checked) {
                own.checked = true;
            } else if (row && !state.userChoseOwn && !own.checked) {
                pub.checked = true;
            }
            $("val-own-rate").hidden = !own.checked;
        }

        function compute() {
            syncTypeUi();
            var type = currentType(), locality = $("val-locality").value;
            var row = state.status === "ok" ? findPublished(locality, type) : null;
            syncSource(row);
            renderPublishedPanel(row, locality, type);

            var areaRaw = readNumber("val-area"), areaUnit = $("val-area-unit").value;
            var areaSqft = areaRaw * (SQFT_PER[areaUnit] || 1);
            var usePublished = $("val-source-published").checked && row;
            var low, high, basis, sourceText, rateUnit = "sqft", ok = true;

            if ($("val-area").value === "") { ok = false; setError("val-area", ""); }
            else if (!(areaRaw > 0)) { ok = false; setError("val-area", "Enter an area greater than zero."); }
            else if (areaSqft > 5e7) { ok = false; setError("val-area", "That area looks too large — please check the number and unit."); }
            else setError("val-area", "");

            if (usePublished) {
                low = Number(row.low); high = Number(row.high); basis = row.rate_basis;
                sourceText = "Aventrix published rate · checked " + fmtDate(row.last_checked);
                ["val-rate-low", "val-rate-high"].forEach(function (id) { setError(id, ""); });
            } else {
                rateUnit = $("val-rate-unit").value;
                low = readNumber("val-rate-low");
                high = readNumber("val-rate-high");
                basis = $("val-rate-basis").value;
                sourceText = "Your entered reference rate";
                if ($("val-rate-low").value === "") { ok = false; setError("val-rate-low", ""); }
                else if (!(low > 0)) { ok = false; setError("val-rate-low", "Enter a rate greater than zero."); }
                else setError("val-rate-low", "");
                if ($("val-rate-high").value !== "" && !(high > 0)) { ok = false; setError("val-rate-high", "Enter a rate greater than zero, or leave it blank."); }
                else if (high > 0 && low > 0 && high < low) { setError("val-rate-high", "The high rate is below the low rate — the two have been swapped."); var t = low; low = high; high = t; }
                else setError("val-rate-high", "");
                if (!(high > 0)) high = low;
            }

            var out = $("val-output"), empty = $("val-output-empty");
            if (!ok) { out.hidden = true; empty.hidden = false; updateShare(null); return; }

            var perLow = low / (SQFT_PER[rateUnit] || 1), perHigh = high / (SQFT_PER[rateUnit] || 1);
            var vLow = areaSqft * perLow, vHigh = areaSqft * perHigh, vMid = (vLow + vHigh) / 2;
            var single = Math.round(vLow) === Math.round(vHigh);

            out.hidden = false; empty.hidden = true;
            setText("val-result-value", single ? inrShort(vLow) : inrShort(vLow) + " – " + inrShort(vHigh));
            setText("val-result-sub", single ? inr(vLow) : inr(vLow) + " to " + inr(vHigh));
            setText("val-r-low", inr(vLow));
            setText("val-r-mid", single ? "—" : inr(vMid));
            setText("val-r-high", inr(vHigh));
            $("val-r-mid-row").hidden = single;
            setText("val-r-area", sqft(areaSqft) + (areaUnit !== "sqft" ? " (" + areaRaw.toLocaleString("en-IN") + " " + areaUnit + (areaRaw === 1 ? "" : "s") + ")" : ""));
            setText("val-r-rate", rateText(perLow, perHigh));
            $("val-r-ground-row").hidden = type !== "land";
            setText("val-r-ground", rateText(perLow * 2400, perHigh * 2400, " / ground"));
            setText("val-r-basis", BASIS_LABEL[basis] || BASIS_LABEL.unsure);
            setText("val-r-source", sourceText);

            var note;
            if (type === "apartment") {
                var chosen = $("val-area-basis").value;
                note = "Area entered as " + AREA_BASIS_LABEL[chosen] + ". ";
                if (usePublished && chosen !== "super_built_up") {
                    note += "The published rate is a portal asking rate, which is normally quoted on super built-up area. It has been applied to your " +
                        AREA_BASIS_LABEL[chosen] + " exactly as entered — no conversion — so the estimate is likely to be on the low side. For a like-for-like figure, enter the super built-up area.";
                } else if (usePublished) {
                    note += "This matches the basis portals normally quote.";
                } else {
                    note += "Make sure your reference rate is quoted on the same area basis.";
                }
            } else if (type === "land") {
                note = "1 ground = 2,400 sq.ft.; 1 cent = 435.6 sq.ft. Road frontage, shape, approvals and title can move the value of a specific plot well outside a locality rate.";
            } else {
                note = "Commercial value depends heavily on lease terms, rent and use. For let property, also run the Commercial Investment calculator.";
            }
            setText("val-r-note", note);
            updateShare({ areaSqft: areaSqft, vLow: vLow, vHigh: vHigh, single: single, basis: basis, perLow: perLow, perHigh: perHigh, published: !!usePublished });
        }

        function updateShare(r) {
            var wa = $("val-whatsapp");
            if (!wa) return;
            var lines = ["Aventrix Realty — valuation discussion", "Property type: " + (TYPE_LABEL[currentType()] || "")];
            var loc = $("val-locality").value.trim();
            if (loc) lines.push("Locality: " + loc);
            if (r) {
                lines.push("Area: " + sqft(r.areaSqft));
                lines.push("Rate used: " + rateText(r.perLow, r.perHigh) + " (" + (r.published ? "Aventrix published rate" : "my reference rate") + ")");
                lines.push("Indicative value from the website tool: " + (r.single ? inr(r.vLow) : inr(r.vLow) + " – " + inr(r.vHigh)));
            }
            lines.push("I would like a professional valuation review.");
            // Only builds the link. Nothing is sent unless the visitor taps it and presses Send in WhatsApp.
            wa.href = "https://wa.me/919176887770?text=" + encodeURIComponent(lines.join("\n"));
        }

        $("val-source-own").addEventListener("change", function () { state.userChoseOwn = true; });
        $("val-source-published").addEventListener("change", function () { state.userChoseOwn = false; });
        form.addEventListener("input", compute);
        form.addEventListener("change", compute);
        form.addEventListener("submit", function (e) { e.preventDefault(); compute(); });
        var resetBtn = $("val-reset");
        if (resetBtn) resetBtn.addEventListener("click", function () {
            window.setTimeout(function () {
                ["val-area", "val-rate-low", "val-rate-high"].forEach(function (id) { setError(id, ""); });
                state.lastKey = "";
                compute();
            }, 0);
        });

        compute();
        fetch("data/market-rates.json", { cache: "no-cache" })
            .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
            .then(function (data) {
                if (!data || !Array.isArray(data.rates)) throw new Error("bad format");
                // Source details stay in the data file for maintainers; the page does not display them.
                state.data = data;
                state.rows = data.rates.filter(validRow);
                state.status = "ok";
                setText("rate-table-reviewed", "Last checked: " + fmtDate(data.last_reviewed) + ".");
            })
            .catch(function () {
                state.status = "error";
                state.rows = [];
                setText("rate-table-reviewed", "Rate table unavailable.");
            })
            .then(function () { state.lastKey = ""; fillLocalities(); renderRateTable(); compute(); });
    }

    /* =================================================================
       3. COMMERCIAL INVESTMENT
       Formulas (all annual, before tax):
         Gross rent         = monthly rent × 12
         Effective rent     = gross rent × (1 − vacancy %)
         NOI                = effective rent − operating costs
         Cash flow          = NOI − annual loan payments
         Gross yield        = gross rent ÷ purchase price
         Net yield          = NOI ÷ purchase price
         Net yield on cost  = NOI ÷ (purchase price + acquisition / fit-out)
         Cash-on-cash       = cash flow ÷ own cash invested   (only if entered)
         Payback (simple)   = (purchase + fit-out) ÷ NOI
         Equity payback     = own cash invested ÷ cash flow   (only if entered)
       ================================================================= */
    function initInvestment() {
        var form = $("investment-tool");
        if (!form) return;

        function compute() {
            var purchase = readNumber("purchase"), rent = readNumber("rent");
            var vacancy = readNumber("vacancy"), operating = readNumber("operating");
            var loan = readNumber("loan"), fitout = readNumber("fitout"), equity = readNumber("equity");
            var ok = true;

            function req(id, v, label) {
                if (!(v > 0)) { ok = false; setError(id, $(id).value === "" ? "" : label + " must be greater than zero."); }
                else setError(id, "");
            }
            function opt(id, v, label, max) {
                if (Number.isFinite(v) && v < 0) { ok = false; setError(id, label + " cannot be negative."); return 0; }
                if (max !== undefined && v > max) { ok = false; setError(id, label + " cannot be more than " + max + "%."); return 0; }
                setError(id, "");
                return Number.isFinite(v) ? v : 0;
            }
            req("purchase", purchase, "Purchase price");
            req("rent", rent, "Monthly rent");
            vacancy = opt("vacancy", vacancy, "Vacancy allowance", 100);
            operating = opt("operating", operating, "Operating costs");
            loan = opt("loan", loan, "Loan payments");
            fitout = opt("fitout", fitout, "Acquisition / fit-out");
            equity = opt("equity", equity, "Own cash invested");

            var out = $("investment-output"), empty = $("investment-output-empty");
            if (!ok) { out.hidden = true; empty.hidden = false; return; }
            out.hidden = false; empty.hidden = true;

            var gross = rent * 12;
            var effective = gross * (1 - vacancy / 100);
            var noi = effective - operating;
            var cash = noi - loan;
            var totalCost = purchase + fitout;

            setText("i-noi-head", inr(noi));
            setText("i-noi-sub", "Net operating income per year, before tax and loan payments");
            setText("i-gross", inr(gross));
            setText("i-effective", inr(effective));
            setText("i-noi", inr(noi));
            setText("i-grossyield", pct(gross / purchase));
            setText("i-netyield", pct(noi / purchase));
            setText("i-yieldcost", pct(noi / totalCost));
            setText("i-cash", inr(cash));
            setText("i-payback", noi > 0 ? (totalCost / noi).toLocaleString("en-IN", { maximumFractionDigits: 1 }) + " years" : "No payback — NOI is not positive");
            var cocRow = $("i-coc-row"), eqRow = $("i-equity-payback-row");
            var hasEquity = equity > 0;
            cocRow.hidden = !hasEquity; eqRow.hidden = !hasEquity;
            if (hasEquity) {
                setText("i-coc", pct(cash / equity));
                setText("i-equity-payback", cash > 0 ? (equity / cash).toLocaleString("en-IN", { maximumFractionDigits: 1 }) + " years" : "No payback — cash flow is not positive");
            }
            ["i-noi", "i-cash"].forEach(function (id) {
                var el = $(id); if (el) el.classList.toggle("is-negative", /−/.test(el.textContent));
            });
            var warn = $("investment-warning");
            if (warn) {
                var msgs = [];
                if (loan > 0 && !hasEquity) msgs.push("You entered loan payments. Add your own cash invested to see cash-on-cash return; the yields above are measured on the full price.");
                if (noi <= 0) msgs.push("Operating costs exceed the effective rent at these assumptions.");
                else if (cash < 0) msgs.push("Loan payments exceed NOI, so the property needs extra cash each year at these assumptions.");
                warn.textContent = msgs.join(" ");
                warn.hidden = msgs.length === 0;
            }
        }

        form.addEventListener("input", compute);
        form.addEventListener("submit", function (e) { e.preventDefault(); compute(); });
        compute();
    }

    function boot() {
        initChecklist();
        initValuation();
        initInvestment();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();
