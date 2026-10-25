(() => {
  "use strict";
  const form = document.querySelector("#tax-form");
  const steps = [...document.querySelectorAll(".form-step")];
  const stepLabels = [...document.querySelectorAll("[data-step-label]")];
  const prev = document.querySelector("#prev");
  const next = document.querySelector("#next");
  const status = document.querySelector("#step-status");
  const summary = document.querySelector("#summary");
  let current = 1;
  const money = value => new Intl.NumberFormat("en-IN", {style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(value || 0));
  const val = name => form.elements[name]?.value ?? "";
  const num = name => Number(val(name) || 0);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function showStep(n) {
    current = n;
    // Full-page mode: never hide a section; step labels scroll to its section.
    steps.forEach(s => s.classList.remove("hidden"));
    stepLabels.forEach(s => {
      const active = Number(s.dataset.stepLabel) === n;
      s.classList.toggle("active", active);
      s.setAttribute("aria-current", active ? "step" : "false");
    });
    if (status) status.textContent = "All sections are shown on this page. Select a section above to jump to it.";
    renderSummary();
    const target = steps.find(s => Number(s.dataset.step) === n);
    if (target) target.scrollIntoView({behavior:"smooth", block:"start"});
  }
  function validCurrentStep() {
    const panel = steps.find(s => Number(s.dataset.step) === current);
    const required = [...panel.querySelectorAll("[required]")];
    for (const field of required) {
      if (!field.checkValidity()) {
        field.reportValidity();
        field.focus();
        return false;
      }
    }
    if (current === 2 && (num("ownershipShare") < 1 || num("ownershipShare") > 100)) {
      form.elements.ownershipShare.setCustomValidity("Enter an ownership share between 1 and 100.");
      form.elements.ownershipShare.reportValidity();
      form.elements.ownershipShare.setCustomValidity("");
      return false;
    }
    return true;
  }
  function renderSummary() {
    const sharePct = Math.min(100, Math.max(0, num("ownershipShare")));
    const share = sharePct / 100;
    const salePrice = num("salePrice");
    const grossSale = salePrice * share;
    const stampValue = num("stampValue") * share;
    const purchase = num("purchasePrice") * share;
    const acquisition = num("acquisitionCosts") * share;
    const improvements = num("improvementCosts") * share;
    const transfers = num("transferCosts") * share;
    const costBasis = purchase + acquisition + improvements;
    const gain = grossSale - costBasis - transfers;
    const purchaseDate = val("purchaseDate") ? new Date(`${val("purchaseDate")}T12:00:00`) : null;
    const saleDate = val("saleDate") ? new Date(`${val("saleDate")}T12:00:00`) : null;
    let classification = "Unable to classify — enter both dates";
    let monthsHeld = null;
    let isLongTerm = false;
    let baseTax = null;
    let surchargeAmount = 0;
    let cessEstimate = null;
    let finalTax = null;
    let taxNote = "Enter valid acquisition and sale dates to classify the holding period.";
    const cautionFlags = [];
    if (purchaseDate && saleDate && !Number.isNaN(+purchaseDate) && !Number.isNaN(+saleDate) && saleDate >= purchaseDate) {
      monthsHeld = (saleDate.getFullYear()-purchaseDate.getFullYear())*12 + saleDate.getMonth()-purchaseDate.getMonth() - (saleDate.getDate() < purchaseDate.getDate() ? 1 : 0);
      if (monthsHeld > 24) {
        isLongTerm = true;
        classification = `Potential long-term holding · ${monthsHeld} months`;
        if (saleDate >= new Date("2024-07-23T12:00:00")) {
          baseTax = Math.max(0, gain) * 0.125;
          surchargeAmount = baseTax * Math.max(0, Math.min(37, num("surchargeRate"))) / 100;
          cessEstimate = (baseTax + surchargeAmount) * 0.04;
          finalTax = baseTax + surchargeAmount + cessEstimate;
          taxNote = "Illustrative calculation only: 12.5% of positive gain plus the entered surcharge assumption and 4% cess. This simplified method does not determine whether the rate applies to your facts, or model exemptions, losses, marginal relief, other income, special cases or all transitional rules. CA review is required.";
        } else {
          taxNote = "The sale date is before 23 July 2024. The current simplified rate method is not applied; professional review of the historical law and indexation rules is required.";
          cautionFlags.push("Historical transfer date: tax calculation not supplied by this simplified engine.");
        }
      } else {
        classification = `Potential short-term holding · ${monthsHeld} months`;
        taxNote = "Short-term gains may be included in other income and taxed under the applicable rules. This prototype deliberately does not calculate a final tax figure for this case.";
        cautionFlags.push("Short-term case: final tax requires the full income profile and applicable slab/rate rules.");
      }
    } else if (saleDate && purchaseDate && saleDate < purchaseDate) {
      taxNote = "Sale date cannot be earlier than acquisition date. Correct the dates before relying on the estimate.";
      cautionFlags.push("Date validation failed: sale date precedes acquisition date.");
    }
    if (["Inherited", "Gifted"].includes(val("acquisitionType"))) {
      cautionFlags.push("Inherited/gifted property: prior-owner cost and holding period may be relevant; obtain CA review.");
      if (!val("priorOwnerDocs") || val("priorOwnerDocs").includes("Not available") || val("priorOwnerDocs").includes("Need")) {
        taxNote += " Prior-owner records are incomplete or need review.";
      }
    }
    if (stampValue > grossSale && stampValue > 0) {
      cautionFlags.push("Entered stamp-duty/guideline value is higher than the sale consideration. A deemed-consideration rule may apply; this prototype does not automatically substitute the value.");
    }
    if (val("indiaStatus").includes("Resident") && !val("indiaStatus").includes("Non-resident")) {
      cautionFlags.push("Selected status is not clearly NRI. Confirm the applicable calculator scope and residential status with a tax professional.");
    }
    if (val("buyerType").includes("Not sure")) cautionFlags.push("Buyer category is unknown; the applicable TDS filing route may differ.");
    const tdsRate = Math.max(0, Math.min(100, num("tdsRate"))) / 100;
    const tdsSurcharge = Math.max(0, Math.min(37, num("surchargeRate"))) / 100;
    const estimatedBuyerTDS = grossSale * tdsRate * (1 + tdsSurcharge) * 1.04;
    const tdsPaid = num("tdsPaid");
    const netProceeds = grossSale - estimatedBuyerTDS - transfers;
    const difference = tdsPaid > 0 && finalTax !== null ? tdsPaid - finalTax : null;
    const fmt = v => money(Math.max(0, v));
    const metrics = document.querySelector("#result-metrics");
    if (metrics) {
      const metricData = [
        ["Sale consideration", fmt(grossSale), `${sharePct.toFixed(2)}% ownership share`, "sale"],
        ["Capital gain / (loss)", money(gain), "After entered costs and transfer expenses", "gain"],
        ["Estimated final tax", finalTax === null ? "CA review required" : fmt(finalTax), isLongTerm ? "Simplified illustrative LTCG method" : "Not computed for this case", "tax"],
        ["Buyer TDS scenario", fmt(estimatedBuyerTDS), `${(tdsRate*100).toFixed(2)}% entered rate + surcharge assumption + 4% cess`, "tds"],
        ["Estimated net proceeds", money(netProceeds), "After scenario TDS and entered transfer costs", "net"]
      ];
      metrics.innerHTML = metricData.map(([label,value,sub,kind]) => `<article class="metric-card metric-${kind}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub)}</small></article>`).join("");
    }
    const rows = [
      ["Residence country", val("residenceCountry")],
      ["Indian status (self-selected; unverified)", val("indiaStatus")],
      ["Tax year selected", val("taxYear")],
      ["Property", `${val("propertyType")} · ${val("city")}, ${val("state")}`],
      ["Acquisition method", val("acquisitionType")],
      ["Ownership share being sold", `${sharePct}%`],
      ["Purchase / acquisition date", val("purchaseDate") || "Not provided"],
      ["Proposed sale date", val("saleDate") || "Not provided"],
      ["Holding period", monthsHeld === null ? "Not determined" : `${monthsHeld} months`],
      ["Holding-period classification", classification],
      ["Sale consideration for your share", money(grossSale)],
      ["Stamp-duty / guideline value for your share", stampValue ? money(stampValue) : "Not provided"],
      ["Purchase cost for your share", money(purchase)],
      ["Purchase stamp duty + registration", money(acquisition)],
      ["Eligible improvement costs entered", money(improvements)],
      ["Transfer expenses", money(transfers)],
      ["Preliminary capital gain / (loss)", money(gain)],
      ["Illustrative base LTCG tax at 12.5%", baseTax === null ? "Not calculated for this case" : fmt(baseTax)],
      ["Surcharge assumption", `${Math.max(0, num("surchargeRate"))}% · ${baseTax === null ? "not applied" : fmt(surchargeAmount)}`],
      ["Illustrative cess at 4%", cessEstimate === null ? "Not calculated for this case" : fmt(cessEstimate)],
      ["Illustrative final tax", finalTax === null ? "CA review required for this case" : fmt(finalTax)],
      ["Buyer TDS rate entered", `${(tdsRate*100).toFixed(2)}% (editable scenario)`],
      ["Illustrative buyer TDS on sale consideration", fmt(estimatedBuyerTDS)],
      ["TDS already deducted / paid", money(tdsPaid)],
      ["TDS versus estimated final tax", difference === null ? "Enter TDS paid and a supported final-tax estimate to compare" : difference >= 0 ? `Potential excess TDS: ${fmt(difference)} (refund not guaranteed)` : `Potential additional tax: ${fmt(-difference)} (subject to full computation)`],
      ["Estimated net proceeds after scenario TDS and transfer expenses", money(netProceeds)],
      ["Document evidence status", val("purchaseEvidence") || "Not specified"]
    ];
    const flagHtml = cautionFlags.length ? `<div class="summary-tax-note"><strong>Items requiring attention</strong><ul>${cautionFlags.map(f=>`<li>${esc(f)}</li>`).join("")}</ul></div>` : "";
    summary.innerHTML = rows.map(([k,v]) => `<div class="summary-card"><span class="key">${esc(k)}</span><span class="value">${esc(v)}</span></div>`).join("") + flagHtml + `<div class="summary-tax-note"><strong>Calculation method and limits</strong><p>${esc(taxNote)}</p><p>Buyer TDS is calculated separately from capital-gains tax using the editable scenario rate, entered surcharge assumption and 4% cess. This is not a legally confirmed withholding rate. The correct base, rate, surcharge, cess, certificate and filing route must be checked against the transaction date and buyer category.</p><p>Net proceeds exclude loan closure, unentered brokerage/charges, stamp-duty adjustments, repatriation costs and other deductions. This tool does not file returns, deposit TDS or request a lower/nil certificate. No PAN, passport or bank details are requested.</p></div>`;
  }

  const demoButton = document.querySelector("#load-demo");
  demoButton?.addEventListener("click", () => {
    const sample = {
      residenceCountry:"United Arab Emirates", indiaStatus:"Non-resident (to be confirmed)", taxYear:"2026–27", ownership:"Individual",
      state:"Tamil Nadu", city:"Chennai", propertyType:"Residential flat", ownershipShare:"100", propertyUse:"Vacant", acquisitionType:"Purchased",
      purchaseDate:"2022-01-01", purchasePrice:"10000000", acquisitionCosts:"500000", improvementCosts:"0", priorOwnerDocs:"Not applicable", purchaseEvidence:"Purchase deed available",
      saleDate:"2026-10-25", salePrice:"20000000", stampValue:"20000000", transferCosts:"200000", buyerType:"Resident individual / HUF (to be confirmed)", tdsPaid:"0", tdsRate:"12.5", surchargeRate:"0", otherFacts:"Sample scenario only: values are illustrative and are not a tax recommendation."
    };
    Object.entries(sample).forEach(([name,value]) => { if (form.elements[name]) form.elements[name].value = value; });
    showStep(5);
  });
  stepLabels.forEach(label => {
    label.setAttribute("role", "button");
    label.setAttribute("tabindex", "0");
    label.setAttribute("aria-label", `Jump to section ${label.dataset.stepLabel}: ${label.textContent.trim()}`);
    const activate = () => showStep(Number(label.dataset.stepLabel));
    label.addEventListener("click", activate);
    label.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } });
  });
  form.addEventListener("input", renderSummary);
  form.addEventListener("change", renderSummary);
  // Branded report preview: print/share are intentionally gated behind preview.
  const previewButton = document.querySelector("#preview-report");
  const reportText = () => [...summary.querySelectorAll(".summary-card")]
    .map(card => `${card.querySelector(".key").textContent}: ${card.querySelector(".value").textContent}`).join("\n");
  let previewModal;
  function openReportPreview() {
    if (!form.elements.acknowledgement.checked) {
      form.elements.acknowledgement.reportValidity();
      return;
    }
    if (!previewModal) {
      previewModal = document.createElement("section");
      previewModal.id = "report-preview-modal";
      previewModal.className = "report-preview-modal";
      previewModal.setAttribute("role", "dialog");
      previewModal.setAttribute("aria-modal", "true");
      previewModal.setAttribute("aria-labelledby", "report-preview-title");
      previewModal.innerHTML = `
        <div class="report-preview-backdrop" data-close-preview></div>
        <div class="report-preview-dialog">
          <div class="report-preview-toolbar"><span>Report preview</span><button type="button" class="preview-close" aria-label="Close report preview" data-close-preview>×</button></div>
          <article class="report-preview-document" id="report-preview-document">
            <header class="report-preview-brand"><img src="/images/aventrix-logo.png" alt="Aventrix Realty"><div><strong>AVENTRIX REALTY</strong><span>NRI Property Tax Review</span></div></header>
            <div class="report-preview-rule"></div>
            <p class="report-preview-kicker">PRELIMINARY PROPERTY SALE REVIEW</p>
            <h1 id="report-preview-title">NRI Property Tax Estimate</h1>
            <p class="report-preview-intro">A guided preliminary review of purchase cost, sale proceeds, capital gains and buyer TDS for property in India.</p>
            <div class="report-preview-data" id="report-preview-data"></div>
            <div class="report-preview-disclaimer"><strong>Important notice</strong><p>This is a preliminary informational estimate, not tax advice or a tax filing computation. Capital gains, final tax, buyer TDS, refund and net proceeds are different concepts. Confirm the applicable law, withholding rate and final figures with a qualified Indian Chartered Accountant before completing a transaction.</p></div>
            <footer class="report-preview-footer"><span>Prepared using the Aventrix Realty NRI Property Tax Calculator</span><span>aventrixrealty.com</span></footer>
          </article>
          <div class="report-preview-actions"><button type="button" class="button secondary" id="edit-from-preview">Back to edit</button><button type="button" class="button secondary" id="share-report">Share report</button><button type="button" class="button primary" id="print-preview-report">Print / Save as PDF</button></div>
          <p class="report-preview-privacy">Your entries are not uploaded by this prototype. Sharing is initiated only when you tap Share.</p>
        </div>`;
      document.body.appendChild(previewModal);
      previewModal.querySelectorAll("[data-close-preview]").forEach(el => el.addEventListener("click", closeReportPreview));
      previewModal.querySelector("#edit-from-preview").addEventListener("click", closeReportPreview);
      previewModal.querySelector("#print-preview-report").addEventListener("click", () => window.print());
      previewModal.querySelector("#share-report").addEventListener("click", async () => {
        const text = `AVENTRIX REALTY — NRI Property Tax Estimate\n\n${reportText()}\n\nPreliminary estimate only. Please obtain CA verification.`;
        if (navigator.share) {
          try { await navigator.share({title:"Aventrix Realty — NRI Property Tax Estimate", text}); }
          catch (err) { if (err?.name !== "AbortError") alert("Sharing was not completed. You can use Print / Save as PDF instead."); }
        } else {
          try { await navigator.clipboard.writeText(text); alert("Branded report summary copied. You can paste it into WhatsApp or another app."); }
          catch { alert("Sharing is not supported by this browser. Use Print / Save as PDF instead."); }
        }
      });
    }
    const data = previewModal.querySelector("#report-preview-data");
    data.innerHTML = [...summary.querySelectorAll(".summary-card")].map(card => {
      const k = card.querySelector(".key").textContent;
      const v = card.querySelector(".value").textContent;
      return `<div class="report-preview-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`;
    }).join("");
    const caution = summary.querySelector(".summary-tax-note");
    if (caution) data.insertAdjacentHTML("beforeend", `<div class="report-preview-note"><strong>Tax estimate limitation</strong>${caution.querySelectorAll("p").length ? [...caution.querySelectorAll("p")].map(p=>`<p>${esc(p.textContent)}</p>`).join("") : ""}</div>`);
    previewModal.classList.add("open");
    document.body.classList.add("report-preview-open");
    previewModal.querySelector("[data-close-preview]")?.focus?.();
  }
  function closeReportPreview() {
    if (!previewModal) return;
    previewModal.classList.remove("open");
    document.body.classList.remove("report-preview-open");
    previewButton?.focus();
  }
  previewButton.addEventListener("click", openReportPreview);
  form.addEventListener("submit", e => e.preventDefault());
  showStep(1);
})();