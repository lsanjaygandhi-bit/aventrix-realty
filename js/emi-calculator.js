/* =====================================================================
   AVENTRIX REALTY — EMI CALCULATOR (emi-calculator.html)
   Plain JavaScript, no libraries. All figures are calculated here from
   the inputs; nothing is hard-coded.

   Reducing-balance EMI:  EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)
     P = loan amount, r = annual rate / 12 / 100, n = months.
   The EMI is rounded to the nearest rupee, and every total is built from
   that rounded EMI, so the figures on screen always reconcile:
     Total Amount Payable = EMI × n = Principal + Total Interest
     Principal % + Interest % = 100%
   ===================================================================== */
(function () {
    "use strict";

    var LIMITS = {
        amount: { min: 100000, max: 50000000, step: 100000 },   // ₹1 Lakh – ₹5 Cr
        rate:   { min: 5, max: 20, step: 0.05 },                // % per year
        years:  { min: 1, max: 30, step: 1 },
        months: { min: 12, max: 360, step: 1 }
    };

    // ---------- Maths (pure; also used by the test page) ----------
    function calculate(principal, annualRate, months) {
        var P = Math.max(0, Number(principal) || 0);
        var n = Math.max(1, Math.round(Number(months) || 1));
        var r = (Number(annualRate) || 0) / 12 / 100;
        var exact = r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
        var emi = Math.round(exact);
        var total = emi * n;
        var interest = total - P;
        var principalPct = total > 0 ? Math.round(P / total * 1000) / 10 : 100;
        var interestPct = Math.round((100 - principalPct) * 10) / 10;
        return {
            principal: P, months: n, annualRate: Number(annualRate) || 0,
            monthlyRate: r * 100, emi: emi, emiExact: exact,
            totalInterest: interest, totalPayable: total,
            principalPct: principalPct, interestPct: interestPct
        };
    }

    // ---------- Formatting (Indian system) ----------
    var inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
    function rupees(v) { return "₹" + inr.format(Math.round(v)); }
    function trimNum(v, dp) { return String(Number(v.toFixed(dp))); }
    function shortRupees(v) {
        if (v >= 10000000) return "₹" + (v / 10000000).toFixed(2) + " Cr";
        if (v >= 100000) {
            var l = v / 100000;
            return "₹" + (Math.abs(l - Math.round(l)) < 1e-9 ? String(Math.round(l)) : l.toFixed(2)) + " Lakh";
        }
        return rupees(v);
    }
    function pct(v) { return (Math.round(v * 10) / 10).toFixed(1) + "%"; }
    function rateText(v) {
        var s = trimNum(v, 2);
        return (s.indexOf(".") === -1 ? s + ".0" : s) + "%";
    }
    function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
    function snap(v, step, lo) { return Math.round((v - lo) / step) * step + lo; }

    // Accepts "5000000", "50,00,000", "50 lakh", "50L", "1.2 cr", "1.2Cr"
    function parseAmount(text) {
        var t = String(text || "").toLowerCase().replace(/[₹,\s]/g, "");
        var m = t.match(/^(\d+(?:\.\d+)?)(cr|crore|crores|l|lac|lakh|lakhs|k)?$/);
        if (!m) return NaN;
        var v = parseFloat(m[1]);
        if (m[2] === "cr" || m[2] === "crore" || m[2] === "crores") v *= 10000000;
        else if (m[2] && m[2].charAt(0) === "l") v *= 100000;
        else if (m[2] === "k") v *= 1000;
        return Math.round(v);
    }

    window.AventrixEMI = { calculate: calculate, shortRupees: shortRupees, rupees: rupees, parseAmount: parseAmount, LIMITS: LIMITS };

    // ---------- Page wiring ----------
    var root = document.getElementById("emiCalculator");
    if (!root) return;
    var $ = function (id) { return document.getElementById(id); };

    var els = {
        amountRange: $("emiAmountRange"), amountInput: $("emiAmountInput"),
        rateRange: $("emiRateRange"), rateInput: $("emiRateInput"),
        tenureRange: $("emiTenureRange"), tenureInput: $("emiTenureInput"),
        tenureMin: $("emiTenureMin"), tenureMax: $("emiTenureMax"), tenureUnitLabel: $("emiTenureUnitLabel"),
        unitBtns: root.querySelectorAll("[data-emi-unit]")
    };

    var state = { amount: 5000000, rate: 8.5, months: 240, unit: "yr" };

    function setFill(range) {
        var lo = Number(range.min), hi = Number(range.max), v = Number(range.value);
        range.style.setProperty("--emi-fill", ((v - lo) / (hi - lo) * 100) + "%");
    }

    function tenureLimits() { return state.unit === "yr" ? LIMITS.years : LIMITS.months; }
    function tenureValue() { return state.unit === "yr" ? state.months / 12 : state.months; }

    function render(source) {
        var res = calculate(state.amount, state.rate, state.months);

        // inputs (don't overwrite the box the visitor is typing in)
        els.amountRange.value = String(clamp(state.amount, LIMITS.amount.min, LIMITS.amount.max));
        els.amountRange.setAttribute("aria-valuetext", shortRupees(state.amount));
        if (source !== "amountInput") els.amountInput.value = document.activeElement === els.amountInput ? inr.format(state.amount) : shortRupees(state.amount);
        els.rateRange.value = String(state.rate);
        els.rateRange.setAttribute("aria-valuetext", rateText(state.rate) + " per year");
        if (source !== "rateInput") els.rateInput.value = trimNum(state.rate, 2);

        var tl = tenureLimits();
        els.tenureRange.min = tl.min; els.tenureRange.max = tl.max; els.tenureRange.step = tl.step;
        els.tenureRange.value = String(tenureValue());
        var tText = state.unit === "yr" ? trimNum(state.months / 12, 2) + (state.months === 12 ? " year" : " years") : state.months + " months";
        els.tenureRange.setAttribute("aria-valuetext", tText);
        if (source !== "tenureInput") els.tenureInput.value = trimNum(tenureValue(), 2);
        els.tenureInput.min = tl.min; els.tenureInput.max = tl.max; els.tenureInput.step = state.unit === "yr" ? "1" : "1";
        els.tenureMin.textContent = state.unit === "yr" ? "1 Yr" : "12 Mo";
        els.tenureMax.textContent = state.unit === "yr" ? "30 Yr" : "360 Mo";
        els.tenureUnitLabel.textContent = state.unit === "yr" ? "years" : "months";
        els.tenureInput.setAttribute("aria-label", "Loan tenure in " + (state.unit === "yr" ? "years" : "months"));
        Array.prototype.forEach.call(els.unitBtns, function (b) {
            var on = b.getAttribute("data-emi-unit") === state.unit;
            b.classList.toggle("is-active", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        [els.amountRange, els.rateRange, els.tenureRange].forEach(setFill);

        // results
        var put = function (sel, text) { root.querySelectorAll(sel).forEach(function (n) { n.textContent = text; }); };
        put("[data-emi-out=emi]", rupees(res.emi));
        put("[data-emi-out=principal]", rupees(res.principal));
        put("[data-emi-out=interest]", rupees(res.totalInterest));
        put("[data-emi-out=total]", rupees(res.totalPayable));
        put("[data-emi-out=months]", res.months + (res.months === 1 ? " month" : " months"));
        put("[data-emi-out=principal-pct]", pct(res.principalPct));
        put("[data-emi-out=interest-pct]", pct(res.interestPct));
        put("[data-emi-out=monthly-rate]", trimNum(res.monthlyRate, 3) + "%");
        put("[data-emi-out=rate]", rateText(res.annualRate));

        // donut: circumference is 100 (r = 15.9155), so dash = percentage
        var arc = $("emiDonutInterest");
        if (arc) {
            arc.setAttribute("stroke-dasharray", res.interestPct + " " + (100 - res.interestPct));
        }
        var chart = $("emiDonut");
        if (chart) chart.setAttribute("aria-label", "Principal " + pct(res.principalPct) + ", interest " + pct(res.interestPct) + " of the total amount payable");
        root.setAttribute("data-emi-ready", "1");
    }

    // sliders
    els.amountRange.addEventListener("input", function () { state.amount = Number(els.amountRange.value); render("amountRange"); });
    els.rateRange.addEventListener("input", function () { state.rate = Number(els.rateRange.value); render("rateRange"); });
    els.tenureRange.addEventListener("input", function () {
        var v = Number(els.tenureRange.value);
        state.months = state.unit === "yr" ? v * 12 : v;
        render("tenureRange");
    });

    // typed amount: plain number while editing, short form (₹50 Lakh) otherwise
    // The whole value is selected at once, so whatever the visitor types
    // replaces it (never appends to it).
    var keepSelection = false;
    els.amountInput.addEventListener("focus", function () {
        els.amountInput.value = inr.format(state.amount);
        try { els.amountInput.setSelectionRange(0, els.amountInput.value.length); } catch (e) {}
        keepSelection = true;
    });
    // a tap/click that focused the box would otherwise collapse the selection
    els.amountInput.addEventListener("mouseup", function (e) {
        if (keepSelection) { e.preventDefault(); keepSelection = false; }
    });
    els.amountInput.addEventListener("keydown", function () { keepSelection = false; });
    els.amountInput.addEventListener("input", function () {
        var v = parseAmount(els.amountInput.value);
        if (!isNaN(v) && v >= LIMITS.amount.min && v <= LIMITS.amount.max) { state.amount = v; render("amountInput"); }
    });
    function commitAmount() {
        var v = parseAmount(els.amountInput.value);
        if (!isNaN(v)) state.amount = clamp(v, LIMITS.amount.min, LIMITS.amount.max);
        els.amountInput.value = shortRupees(state.amount);
        render("amountCommit");
    }
    els.amountInput.addEventListener("blur", commitAmount);
    els.amountInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); els.amountInput.blur(); } });

    // typed rate
    els.rateInput.addEventListener("input", function () {
        var v = parseFloat(els.rateInput.value);
        if (!isNaN(v) && v >= LIMITS.rate.min && v <= LIMITS.rate.max) { state.rate = Math.round(v * 100) / 100; render("rateInput"); }
    });
    function commitRate() {
        var v = parseFloat(els.rateInput.value);
        if (!isNaN(v)) state.rate = clamp(Math.round(v * 100) / 100, LIMITS.rate.min, LIMITS.rate.max);
        render("rateCommit");
    }
    els.rateInput.addEventListener("change", commitRate);
    els.rateInput.addEventListener("blur", commitRate);

    // typed tenure
    els.tenureInput.addEventListener("input", function () {
        var v = Math.round(parseFloat(els.tenureInput.value)), tl = tenureLimits();
        if (!isNaN(v) && v >= tl.min && v <= tl.max) { state.months = state.unit === "yr" ? v * 12 : v; render("tenureInput"); }
    });
    function commitTenure() {
        var v = Math.round(parseFloat(els.tenureInput.value)), tl = tenureLimits();
        if (!isNaN(v)) { v = clamp(v, tl.min, tl.max); state.months = state.unit === "yr" ? v * 12 : v; }
        render("tenureCommit");
    }
    els.tenureInput.addEventListener("change", commitTenure);
    els.tenureInput.addEventListener("blur", commitTenure);

    // Yr / Mo toggle (a months value that isn't whole years rounds to the nearest year)
    Array.prototype.forEach.call(els.unitBtns, function (b) {
        b.addEventListener("click", function () {
            var unit = b.getAttribute("data-emi-unit");
            if (unit === state.unit) return;
            state.unit = unit;
            if (unit === "yr") state.months = clamp(Math.round(state.months / 12), 1, 30) * 12;
            render("unit");
        });
    });

    render("init");

    // ---------- Floating WhatsApp / Back-to-top ----------
    // On phones and narrow windows the fixed buttons sit over the right
    // edge of the content. While any part of the calculator is under
    // them, they step aside (fade out); they return as soon as the
    // calculator has scrolled past, e.g. over the hero, CTA and footer.
    var zone = $("emiFloatZone");
    function floatsOverlap() {
        var narrow = document.documentElement.classList.contains("is-mobile") || window.innerWidth <= 768;
        if (!narrow || !zone) return false;
        var r = zone.getBoundingClientRect();
        var h = window.innerHeight;
        // buttons occupy roughly the bottom 230px of the viewport
        return r.bottom > h - 230 && r.top < h;
    }
    var ticking = false;
    function updateFloats() {
        ticking = false;
        document.body.classList.toggle("emi-floats-aside", floatsOverlap());
    }
    function queue() { if (!ticking) { ticking = true; requestAnimationFrame(updateFloats); } }
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    updateFloats();
})();
