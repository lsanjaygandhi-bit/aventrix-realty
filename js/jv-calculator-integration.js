(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const ids=["jvc-land-area-input","jvc-road-width","jvc-project-type","jvc-land-deduction","jvc-base-fsi","jvc-premium-pct","jvc-efficiency","jvc-rate","jvc-construction-rate","jvc-cost-basis","jvc-soft-cost-pct","jvc-premium-charge","jvc-other-costs","jvc-profit-pct","jvc-ratio","jvc-net-land","jvc-net-land-duplicate","jvc-land-value-result","jvc-base-builtup","jvc-premium-builtup","jvc-total-fsi-area","jvc-saleable-area","jvc-gdv","jvc-construction-cost","jvc-total-cost","jvc-project-cost","jvc-project-profit","jvc-target-profit","jvc-residual-land-value","jvc-land-value-gap","jvc-contribution-share","jvc-land-pct","jvc-dev-pct","jvc-land-area-result","jvc-land-value-result-detail","jvc-dev-area-result","jvc-dev-value-result","jvc-dev-profit","jvc-feasibility-status","jvc-required-share","jvc-required-share-note","jvc-scenarios","jvc-print","jvc-reset","jvc-deposit-type","jvc-deposit-amount","jvc-deposit-finance-rate","jvc-deposit-months","jvc-recommended-ratio","jvc-recommended-note","jvc-market-ratio","jvc-residual-ratio","jvc-deposit-impact","jvc-use-recommended"];
  if(!ids.every(id=>$(id)))return;
  const n=id=>{const x=Number($(id).value);return Number.isFinite(x)&&x>=0?x:0;};
  const fmt=x=>Math.round(x).toLocaleString('en-IN');
  const money=x=>'₹'+Math.round(x).toLocaleString('en-IN');
  const pct=x=>(x*100).toLocaleString('en-IN',{maximumFractionDigits:1})+'%';
  let ratioManuallyAdjusted=false;
  let lastViable=true;
  const NO_VIABLE_NOTE='No viable sharing ratio under the current assumptions. The split shown is a reference for comparison only — it is not a recommended or feasible deal.';
  function render(){
    const land=n('jvc-land-area-input');
    const deduction=Math.min(90,n('jvc-land-deduction'))/100;
    const netLand=land*(1-deduction);
    const baseFsi=n('jvc-base-fsi');
    const premiumPct=Math.min(100,n('jvc-premium-pct'))/100;
    const baseArea=netLand*baseFsi;
    const premiumArea=baseArea*premiumPct;
    const fsiArea=baseArea+premiumArea;
    const efficiency=Math.min(100,Math.max(0,n('jvc-efficiency')))/100;
    const saleable=fsiArea*efficiency;
    const sellingRate=n('jvc-rate');
    const gdv=saleable*sellingRate;
    const constructionRate=n('jvc-construction-rate');
    const constructionBasis=$('jvc-cost-basis').value==='saleable'?saleable:fsiArea;
    const constructionCost=constructionBasis*constructionRate;
    const softCosts=constructionCost*Math.min(200,n('jvc-soft-cost-pct'))/100;
    const premiumCharges=n('jvc-premium-charge');
    const otherCosts=n('jvc-other-costs');
    const depositType=$('jvc-deposit-type').value;
    const depositAmount=n('jvc-deposit-amount');
    const depositFinanceCost=depositType==='refundable'?depositAmount*Math.min(50,n('jvc-deposit-finance-rate'))/100*Math.min(120,n('jvc-deposit-months'))/12:0;
    const nonRefundablePayment=depositType==='nonrefundable'?depositAmount:0;
    const coreDeveloperInvestment=constructionCost+softCosts+premiumCharges+otherCosts;
    const developerInvestment=coreDeveloperInvestment+nonRefundablePayment+depositFinanceCost;
    const targetProfit=coreDeveloperInvestment*Math.min(100,n('jvc-profit-pct'))/100;
    // Residual land consideration available after project costs and target developer profit.
    const residualLandValue=gdv-coreDeveloperInvestment-depositFinanceCost-targetProfit-nonRefundablePayment;
    const landValue=Math.max(0,residualLandValue);
    const totalProjectCost=developerInvestment+landValue;
    const projectProfit=gdv-totalProjectCost;
    const landValueGap=netLand>0?landValue/netLand:0;
    const rawRecommendedOwnerPct=gdv>0?Math.max(0,(residualLandValue-nonRefundablePayment)/gdv):0;
    const recommendedOwnerPct=Math.min(.95,Math.max(.05,rawRecommendedOwnerPct));
    const hasViableRecommendation=gdv>0&&residualLandValue>0;
    lastViable=hasViableRecommendation;
    const ratioNote=$('jvc-ratio-note');if(ratioNote){ratioNote.hidden=hasViableRecommendation;ratioNote.textContent=hasViableRecommendation?'':NO_VIABLE_NOTE;}
    // No viable ratio: keep a neutral 50:50 reference instead of the 5% slider floor.
    if(!ratioManuallyAdjusted){$('jvc-ratio').value=hasViableRecommendation?Math.round(recommendedOwnerPct*100):50;}
    const ownerPct=Math.min(95,Math.max(5,n('jvc-ratio')))/100;
    const devPct=1-ownerPct;
    const ownerArea=saleable*ownerPct;
    const devArea=saleable*devPct;
    const ownerValue=ownerArea*sellingRate;
    const devValue=devArea*sellingRate;
    const devSurplus=devValue-developerInvestment;
    const requiredShare=gdv>0?(developerInvestment+targetProfit)/gdv:null;
    $('jvc-net-land').textContent=fmt(netLand)+' sq.ft.';
    $('jvc-net-land-duplicate').textContent=fmt(netLand)+' sq.ft.';
    $('jvc-land-value-result').textContent=gdv>0?money(landValue):'Enter sale price and costs';
    $('jvc-base-builtup').textContent=fmt(baseArea)+' sq.ft.';
    $('jvc-premium-builtup').textContent=fmt(premiumArea)+' sq.ft.';
    $('jvc-total-fsi-area').textContent=fmt(fsiArea)+' sq.ft.';
    $('jvc-saleable-area').textContent=fmt(saleable)+' sq.ft.';
    $('jvc-gdv').textContent=money(gdv);
    $('jvc-construction-cost').textContent=money(constructionCost);
    $('jvc-total-cost').textContent=money(developerInvestment);
    $('jvc-project-cost').textContent=money(totalProjectCost);
    $('jvc-project-profit').textContent=money(projectProfit);
    $('jvc-target-profit').textContent=money(targetProfit);
    $('jvc-residual-land-value').textContent=money(residualLandValue);
    $('jvc-land-value-gap').textContent=netLand>0?money(landValue/netLand)+' / sq.ft.':'—';
    $('jvc-contribution-share').textContent=gdv>0?pct(Math.max(0,landValue/gdv)):'—';
    $('jvc-land-pct').textContent=Math.round(ownerPct*100)+'%';
    $('jvc-dev-pct').textContent=Math.round(devPct*100)+'%';
    $('jvc-land-area-result').textContent=fmt(ownerArea)+' sq.ft.';
    $('jvc-land-value-result-detail').textContent='Indicative gross value '+money(ownerValue);
    $('jvc-dev-area-result').textContent=fmt(devArea)+' sq.ft.';
    $('jvc-dev-value-result').textContent='Indicative gross value '+money(devValue);
    $('jvc-dev-profit').textContent=money(devSurplus);
    let status,cls;
    if(land<=0||baseFsi<=0||sellingRate<=0||saleable<=0){status='Enter land area, verified/assumed FSI and selling price to model the proposal.';cls='jvc-status-neutral';}
    else if(devSurplus<0){status='At this ratio, the developer allocation does not recover the entered developer investment. The proposal is not supported by these assumptions.';cls='jvc-status-risk';}
    else if(devSurplus<targetProfit){status='The developer allocation covers entered investment but does not meet the target-profit benchmark. Review costs, price and sharing.';cls='jvc-status-review';}
    else{status='The developer allocation meets the entered investment and target-profit benchmark in this simplified model only; it is not a recommendation or feasibility approval.';cls='jvc-status-ok';}
    $('jvc-feasibility-status').textContent=status;
    $('jvc-feasibility-status').className='jvc-feasibility-status '+cls;
    if(requiredShare===null){$('jvc-required-share').textContent='—';$('jvc-required-share-note').textContent='Enter saleable area and selling price first.';}
    else{$('jvc-required-share').textContent=pct(requiredShare);$('jvc-required-share-note').textContent=requiredShare>1?'Required developer allocation exceeds 100% of GDV; the current assumptions do not support the target profit.': 'At the entered selling rate, this is the developer share needed to recover the entered investment and target profit. It is a negotiation benchmark, not a recommendation.';}
    $('jvc-recommended-ratio').textContent=gdv<=0?'Enter saleable area and selling price':residualLandValue<=0?'No viable ratio under current assumptions':Math.round(recommendedOwnerPct*100)+'% Landowner / '+(100-Math.round(recommendedOwnerPct*100))+'% Developer';
    $('jvc-market-ratio').textContent='Not used — no market land rate input';
    $('jvc-residual-ratio').textContent=gdv>0?pct(Math.max(0,residualLandValue/gdv))+' maximum supported before unit-mix adjustments':'—';
    $('jvc-recommended-note').textContent=gdv<=0?'Enter sale price, FSI, saleable efficiency and project costs.':(residualLandValue<=0?'Current project assumptions do not support a positive residual land value. No viable landowner allocation is indicated under these assumptions.':'Suggested landowner allocation is based on residual value supported after builder costs and target profit. Non-refundable payment is treated as upfront land consideration. This is a negotiation benchmark, not a final JV ratio.');
    $('jvc-deposit-impact').textContent=depositType==='none'||depositAmount<=0?'No deposit entered.':depositType==='refundable'?'Refundable principal is treated as a temporary liability, not permanent land value; estimated funding cost '+money(depositFinanceCost)+' is added to builder cost and affects the supported ratio.':'Non-refundable payment '+money(nonRefundablePayment)+' is treated as upfront land consideration and reduces the remaining property allocation benchmark; it is also included in builder cash outlay.';
    $('jvc-scenarios').innerHTML=[...new Set([20,30,40,50,60,70,80,...(hasViableRecommendation?[Math.round(recommendedOwnerPct*100)]:[]),Math.round(ownerPct*100)])].sort((a,b)=>a-b).map(p=>{const dp=1-p/100;const ov=saleable*p/100*sellingRate;const dv=saleable*dp*sellingRate;const surplus=dv-developerInvestment;return '<tr'+(p===Math.round(ownerPct*100)?' class="jvc-current"':'')+'><td>'+p+':'+(100-p)+(p===Math.round(ownerPct*100)?(hasViableRecommendation?' · Current':' · Reference only'):'')+'</td><td>'+fmt(saleable*p/100)+' sq.ft.</td><td>'+fmt(saleable*dp)+' sq.ft.</td><td>'+money(ov)+'</td><td>'+money(dv)+'</td><td>'+money(surplus)+'</td></tr>';}).join('');
  }
  ['jvc-land-area-input','jvc-land-deduction','jvc-base-fsi','jvc-premium-pct','jvc-efficiency','jvc-rate','jvc-construction-rate','jvc-soft-cost-pct','jvc-premium-charge','jvc-other-costs','jvc-profit-pct','jvc-deposit-amount','jvc-deposit-finance-rate','jvc-deposit-months'].forEach(id=>$(id).addEventListener('input',render));
  $('jvc-ratio').addEventListener('input',()=>{ratioManuallyAdjusted=true;render();});
  $('jvc-use-recommended').addEventListener('click',()=>{ratioManuallyAdjusted=false;render();});
  ['jvc-cost-basis','jvc-road-width','jvc-project-type','jvc-deposit-type'].forEach(id=>$(id).addEventListener('change',()=>{if(id==='jvc-road-width'||id==='jvc-project-type'){$('jvc-regulatory-note').textContent='Road width and building category are context inputs only; this tool deliberately does not auto-select an approved FSI. Verify current CMDA/TN rules, jurisdiction, land use, road-width eligibility, height, setbacks, exclusions and premium FSI with a licensed architect/competent authority, then enter the verified FSI above.';}if(id==='jvc-deposit-type')ratioManuallyAdjusted=false;render();}));
  $('jvc-print').addEventListener('click',generateProposal);
  function generateProposal(){
    const win=window.open('about:blank','_blank');
    if(!win){alert('Please allow pop-ups for this site to generate the separate JV proposal.');return;}
    win.document.open();win.document.write('<!doctype html><title>Preparing JV Proposal…</title><p style="font:16px Arial;padding:24px">Preparing your Aventrix Realty JV Proposal…</p>');win.document.close();
    const val=id=>($(id)?.value??'').trim();
    const label=id=>{const el=$(id);const opt=el&&el.selectedOptions&&el.selectedOptions[0];return (opt?opt.textContent:(el?.value??'')).trim();};
    const text=id=>($(id)?.textContent??'').trim();
    const esc=s=>String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
    const projectName=val('jvc-project-name')||'Joint Venture Feasibility';
    const projectLocation=val('jvc-project-location')||'Not provided';
    const landArea=fmt(n('jvc-land-area-input'))+' sq.ft.';
    const ownerPct=Math.round(n('jvc-ratio'));
    const devPct=100-ownerPct;
    const rows=[
      ['Land area',landArea],['Road width',val('jvc-road-width')+' ft'],['Building category',label('jvc-project-type')],
      ['Land deduction',val('jvc-land-deduction')+'%'],['Net land area',text('jvc-net-land')],
      ['Indicative residual land value (derived, not pre-entered)',text('jvc-land-value-result')],['Verified / assumed base FSI',val('jvc-base-fsi')],['Additional premium FSI',val('jvc-premium-pct')+'%'],
      ['Saleable efficiency assumption',val('jvc-efficiency')+'%'],['Estimated FSI-counted area',text('jvc-total-fsi-area')],['Estimated saleable area',text('jvc-saleable-area')],
      ['Expected selling rate',money(n('jvc-rate'))+' / saleable sq.ft.'],['Gross Development Value (GDV)',text('jvc-gdv')],
      ['Construction cost',text('jvc-construction-cost')],['Builder investment excluding land',text('jvc-total-cost')],['Total project cost (entered developer costs + indicative residual land allocation)',text('jvc-project-cost')],
      ['Developer target profit benchmark',text('jvc-target-profit')],['Residual land value (indicative)',text('jvc-residual-land-value')],['Residual land value per land sq.ft.',text('jvc-land-value-gap')],
      ['Project surplus before tax / omitted items',text('jvc-project-profit')],['Current sharing scenario',ownerPct+':'+devPct],['Landowner allocated area',text('jvc-land-area-result')],
      ['Landowner allocated gross value',text('jvc-land-value-result-detail')],['Developer allocated area',text('jvc-dev-area-result')],['Developer allocated gross value',text('jvc-dev-value-result')],
      ['Developer surplus after entered investment',text('jvc-dev-profit')],['Developer share needed for investment + target profit',text('jvc-required-share')],['Deposit arrangement',label('jvc-deposit-type')],['Deposit / payment amount',money(n('jvc-deposit-amount'))],['Deposit treatment / estimated funding effect',text('jvc-deposit-impact')],['Recommended starting ratio',text('jvc-recommended-ratio')]
    ];
    const currentScenarioRows=[['Landowner allocation',ownerPct+'%'],['Developer allocation',devPct+'%'],['Landowner area',text('jvc-land-area-result')],['Developer area',text('jvc-dev-area-result')],['Landowner indicative gross value',text('jvc-land-value-result-detail')],['Developer indicative gross value',text('jvc-dev-value-result')],['Developer surplus after entered investment',text('jvc-dev-profit')]];
    const scenario=[
      ['Landowner',ownerPct+'%',text('jvc-land-area-result'),text('jvc-land-value-result-detail')],
      ['Developer',devPct+'%',text('jvc-dev-area-result'),text('jvc-dev-value-result')]
    ];
    const propertyRows=[
      ['Project location',projectLocation],
      ['Land extent',landArea],
      ['Road width',val('jvc-road-width')+' feet'],
      ['Development category',label('jvc-project-type')],
      ['Land deduction',val('jvc-land-deduction')+'%'],
      ['Net land area',text('jvc-net-land')],
      ['Indicative residual land value',text('jvc-land-value-result')],
      ['Residual land value per land sq.ft.',text('jvc-land-value-gap')]
    ];
    const feasibilityRows=[
      ['Land area','Entered plot extent',landArea],
      ['Base FSI','User-entered assumption',val('jvc-base-fsi')],
      ['Additional premium FSI','User-entered assumption',val('jvc-premium-pct')+'%'],
      ['Indicative FSI-counted area','Calculated by the tool',text('jvc-total-fsi-area')],
      ['Estimated saleable area','FSI area × assumed efficiency',text('jvc-saleable-area')],
      ['Saleable efficiency','User-entered assumption',val('jvc-efficiency')+'%'],
      ['Indicative average sale rate','Per saleable sq.ft.',money(n('jvc-rate'))],
      ['Estimated gross sales value','Gross Development Value (GDV)',text('jvc-gdv')]
    ];
    const costRows=[
      ['Construction cost',text('jvc-construction-cost')],
      ['Builder investment excluding land',text('jvc-total-cost')],
      ['Other entered project costs',money(n('jvc-other-costs'))],
      ['Total project cost benchmark',text('jvc-project-cost')],
      ['Developer target profit benchmark',text('jvc-target-profit')],
      ['Project surplus before tax / omitted items',text('jvc-project-profit')]
    ];
    const logo=new URL('images/aventrix-logo-proposal.png', document.baseURI).href;
    const now=new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});
    const proposalRef='AVR/JV/'+new Date().getFullYear()+'/'+String(Date.now()).slice(-6);
    const table=(headers,items)=>'<table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+items.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    const footer=(p)=>'<div class="page-footer"><span>AVENTRIX REALTY | JOINT VENTURE PROPOSAL — FOR DISCUSSION ONLY</span><span>Page '+p+'</span></div>';
    const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aventrix Realty — Joint Venture Development Proposal</title><style>'+
      '@page{size:A4;margin:13mm 12mm 17mm}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font:10px/1.42 Arial,Helvetica,sans-serif;color:#26332d;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.actions{position:fixed;z-index:9999;left:50%;bottom:18px;transform:translateX(-50%);display:flex;justify-content:center;align-items:center;gap:10px;width:max-content;max-width:calc(100vw - 24px);padding:10px;background:rgba(255,255,255,.96);border:1px solid #d9dfda;border-radius:14px;box-shadow:0 8px 30px #10251b2b;backdrop-filter:blur(12px)}.actions button{border:0;border-radius:8px;background:#153e30;color:#fff;padding:12px 17px;font-weight:700;cursor:pointer;font-size:13px;white-space:nowrap}.actions .share-btn{background:#f8f0d9;color:#183b2d;border:1px solid #dfc87e}.actions button:hover{filter:brightness(1.05);transform:translateY(-1px)}.page{position:relative;min-height:267mm;padding-bottom:13mm;page-break-after:always;break-after:page}.page:last-of-type{page-break-after:auto;break-after:auto}.brandhead{text-align:center;border-bottom:4px solid #D4A32C;padding:0 0 10px;margin-bottom:16px}.brandhead img{display:block;max-width:245px;max-height:56px;object-fit:contain;margin:0 auto 4px}.tagline{font-size:9px;letter-spacing:2px;color:#5b675f}.proposal-title{text-align:center;font-size:22px;line-height:1.2;margin:19px 0 5px;color:#101c16;font-weight:800}.subtitle{text-align:center;color:#66736c;font-size:11px;margin:0 0 16px}.meta{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #d8dfdb;margin:12px 0 17px}.meta>div{border-right:1px solid #d8dfdb}.meta>div:last-child{border-right:0}.meta .label{display:block;background:#f0f3f1;text-align:center;padding:5px;font-size:8px;color:#647169;border-bottom:1px solid #d8dfdb}.meta .value{display:block;padding:8px;font-weight:bold;font-size:9px;min-height:29px}.section-title{font-size:14px;color:#233e31;margin:16px 0 7px;font-weight:800}.intro{font-size:10px;margin:0 0 8px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #d4a32c;background:#f8f0d9;margin:10px 0 15px}.metric{text-align:center;border-right:1px solid #e2d4a7}.metric:last-child{border-right:0}.metric .label{display:block;font-size:8px;color:#5e645c;padding:6px 4px 2px}.metric .big{display:block;font-size:17px;font-weight:800;color:#26372d;padding:4px 5px 8px;overflow-wrap:anywhere}.metric .big.smallbig{font-size:14px}table{width:100%;border-collapse:collapse;table-layout:fixed;margin:6px 0 10px;font-size:9px}thead{display:table-header-group}th{background:#153e30;color:#fff;text-align:left;padding:7px 8px;font-size:8px;font-weight:700}td{border:1px solid #dce2de;padding:6px 8px;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even) td{background:#f1f4f2}tr{break-inside:avoid;page-break-inside:avoid}.cost-table tbody tr:nth-last-child(-n+3) td{background:#f8f0d9;font-weight:700}.callout{padding:9px 11px;background:#fbf5e6;border-left:3px solid #D4A32C;margin:10px 0;font-size:9px}.note{font-size:8.3px;color:#59675f;line-height:1.5}.bullet{margin:5px 0;padding-left:14px}.bullet li{margin:5px 0}.signature-grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #d8dfdb;margin-top:8px}.signature{border-right:1px solid #d8dfdb;min-height:88px;padding:8px}.signature:last-child{border-right:0}.signature h3{font-size:9px;margin:-8px -8px 12px;padding:8px;background:#f8f0d9;color:#26372d}.signline{margin:13px 0 0;font-size:9px}.prepared{text-align:center;color:#657169;font-size:11px;margin:18px 0 8px}.page-footer{position:absolute;left:0;right:0;bottom:0;border-top:1px solid #D4A32C;padding-top:6px;display:flex;justify-content:space-between;gap:8px;font-size:7.5px;color:#69736d}.smallprint{font-size:8px;color:#68736d;line-height:1.45}.current-pill{display:inline-block;background:#f8f0d9;border:1px solid #e2d4a7;padding:5px 8px;font-weight:700;color:#153e30}.scenario-table td:first-child{font-weight:700}@media screen{body{background:#eef1ee;padding-bottom:88px}.page{background:#fff;max-width:210mm;margin:0 auto 18px;padding:13mm 12mm 17mm;box-shadow:0 3px 20px #00000012}.page-footer{bottom:0}}@media(max-width:520px){.actions{bottom:10px;gap:6px;padding:7px;border-radius:12px;width:calc(100vw - 20px)}.actions button{flex:1;padding:12px 7px;font-size:12px}}@media print{.actions{display:none}.page{min-height:267mm;margin:0;padding:0 0 13mm;box-shadow:none}.page-footer{position:absolute;bottom:0}body{background:#fff}}'+
      '</style><script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script></head><body><div class="actions" role="toolbar" aria-label="Proposal actions"><button type="button" onclick="window.print()" aria-label="Print proposal">Print</button><button type="button" class="share-btn" onclick="shareProposal()" aria-label="Share proposal PDF">Share PDF</button><button type="button" onclick="window.print()" aria-label="Save proposal as PDF">Save as PDF</button></div><script>async function shareProposal(){var btn=document.querySelector(".share-btn");var original=btn.textContent;btn.disabled=true;btn.textContent="Preparing PDF…";try{if(typeof html2pdf!=="function")throw new Error("PDF generator unavailable");var safeName=(document.querySelector(".proposal-title")?.innerText||"Aventrix JV Proposal").replace(/[^a-z0-9 -]/gi,"").trim().replace(/\s+/g,"-")||"Aventrix-JV-Proposal";var blob=await html2pdf().set({margin:[13,12,17,12],filename:safeName+".pdf",image:{type:"jpeg",quality:0.98},html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff",ignoreElements:function(el){return el.classList&&el.classList.contains("actions")}},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["css","legacy"],avoid:["tr",".signature-grid"]}}).from(document.body).outputPdf("blob");var file=new File([blob],safeName+".pdf",{type:"application/pdf"});if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"Aventrix Realty — Joint Venture Development Proposal",text:"Joint Venture Development Proposal — Aventrix Realty"});}else{var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},60000);alert("PDF downloaded. To send the PDF, attach this file in WhatsApp or share it from your device&#39;s Files/Downloads app. On iPhone, use the Share menu and choose AirDrop or WhatsApp.")}}catch(e){console.error("JV proposal PDF share failed:",e);alert("PDF sharing could not start. Please use Save as PDF, then share the saved PDF through AirDrop or WhatsApp. If this repeats, check your internet connection and allow the PDF library to load.")}finally{btn.disabled=false;btn.textContent=original}}</script>'+
      '<main class="page"><div class="brandhead"><img src="'+esc(logo)+'" alt="Aventrix Realty"><div class="tagline">LAND | DEVELOPMENT | INVESTMENT</div></div><h1 class="proposal-title">JOINT VENTURE DEVELOPMENT PROPOSAL</h1><p class="subtitle">Illustrative feasibility and sharing proposal for a residential development</p><div class="meta"><div><span class="label">PROPOSAL REF.</span><span class="value">'+esc(proposalRef)+'</span></div><div><span class="label">PREPARED ON</span><span class="value">'+esc(now)+'</span></div><div><span class="label">PROJECT TYPE</span><span class="value">'+esc(label('jvc-project-type')||'Residential Development')+'</span></div></div><h2 class="section-title">1. Executive Summary</h2><p class="intro">Aventrix Realty presents this preliminary Joint Venture feasibility proposal to support initial discussions between a landowner and a suitable development partner. Figures are generated from the assumptions entered in the calculator and must be verified before commercial reliance.</p><div class="metrics"><div class="metric"><span class="label">LAND EXTENT</span><span class="big">'+esc(landArea)+'</span></div><div class="metric"><span class="label">INDICATIVE RESIDUAL LAND VALUE</span><span class="big smallbig">'+esc(text('jvc-land-value-result'))+'</span></div><div class="metric"><span class="label">EST. SALEABLE AREA</span><span class="big">'+esc(text('jvc-saleable-area'))+'</span></div></div><h2 class="section-title">2. Illustrative Property Particulars</h2>'+table(['Particular','Illustrative assumption'],propertyRows)+footer(1)+'</main>'+
      '<main class="page"><div class="brandhead"><img src="'+esc(logo)+'" alt="Aventrix Realty"><div class="tagline">LAND | DEVELOPMENT | INVESTMENT</div></div><h2 class="section-title">3. Preliminary Development Feasibility</h2><p class="intro">This is a simplified feasibility illustration, not a sanctioned-area calculation. Actual FSI, setbacks, parking, fire access, common areas and saleable area must be confirmed by the appointed architect and relevant authority.</p>'+table(['Feasibility item','Basis / note','Amount / area'],feasibilityRows)+'<h2 class="section-title">4. Indicative Project Cost Estimate</h2>'+table(['Cost head','Estimate'],costRows)+'<div class="callout"><strong>Interpretation:</strong> The residual land value is an indicative model output, not an independent market valuation. Costs, achievable sale prices, taxes, financing, statutory charges and omitted project expenses may materially change the result.</div><p class="note">This simplified model uses the entered assumptions only. Confirm the full project scope, GST and other tax implications, RERA costs, utilities, demolition, soil and structural conditions, contingency, brokerage, finance costs and all project-specific expenses before relying on the result.</p>'+footer(2)+'</main>'+
      '<main class="page"><div class="brandhead"><img src="'+esc(logo)+'" alt="Aventrix Realty"><div class="tagline">LAND | DEVELOPMENT | INVESTMENT</div></div><h2 class="section-title">5. Proposed Joint Venture Structure — Current Scenario</h2><p class="intro">The sharing ratio below reflects the <strong>currently selected calculator scenario only</strong>. It is an indicative discussion basis, not an agreed term or a recommendation to accept without negotiation.</p><p><span class="current-pill">Landowner '+ownerPct+'% / Developer '+devPct+'%'+(lastViable?'':' — reference only')+'</span></p>'+(lastViable?'':'<p class="intro"><strong>'+esc(NO_VIABLE_NOTE)+'</strong></p>')+''+table(['Party','Illustrative share','Approx. area allocation','Indicative gross value'],scenario)+'<h2 class="section-title">6. Commercial Terms to Be Agreed</h2><ul class="bullet"><li><strong>Deposit / advance:</strong> '+esc(val('jvc-deposit-type')==='none'?'No deposit entered':label('jvc-deposit-type')+': '+money(n('jvc-deposit-amount')))+'; refundability, adjustment and payment milestones must be expressly agreed.</li><li><strong>Funding:</strong> Developer funding responsibilities and project expenses to be documented in the final agreement.</li><li><strong>Approvals:</strong> Approval responsibilities, statutory costs and landowner cooperation obligations to be allocated in writing.</li><li><strong>Allocation:</strong> Unit-wise or area allocation, floor preference, parking, undivided share and common areas to be attached as schedules.</li><li><strong>Timeline:</strong> Construction and handover milestones to be finalised after feasibility, approval and funding review.</li><li><strong>Security and remedies:</strong> Delay, default, termination, refund, performance security and dispute resolution to be drafted by legal counsel.</li></ul><h2 class="section-title">7. Roles and Responsibilities</h2>'+table(['Party','Indicative responsibilities'],[['Landowner','Provide title and ownership documents, disclose encumbrances and execute agreed documents.'],['Developer','Complete design and feasibility, arrange funding, secure applicable approvals and execute construction as contracted.'],['Aventrix Realty','Coordinate communication, facilitate negotiation and assist with preliminary feasibility and commercial discussions.']])+footer(3)+'</main>'+
      '<main class="page"><div class="brandhead"><img src="'+esc(logo)+'" alt="Aventrix Realty"><div class="tagline">LAND | DEVELOPMENT | INVESTMENT</div></div><h2 class="section-title">8. Conditions, Due Diligence and Disclaimer</h2><ul class="bullet"><li>Land title, encumbrances, access, boundaries, survey records and possession must be verified by qualified professionals.</li><li>FSI, setbacks, height, parking, fire access, road-width conditions, zoning and all approvals must be verified with the relevant planning authority and a licensed architect.</li><li>Construction rates, selling prices, saleable efficiency, approval costs, finance costs and timeline are illustrative assumptions and may change materially.</li><li>FSI-counted area is not automatically equal to saleable area. Gross allocated values are not net profit or guaranteed realizable values.</li><li>Deposit treatment in this model is preliminary. Refundable deposits may be treated as temporary funding with an estimated finance cost; non-refundable payments may be treated as upfront consideration. Confirm the treatment and terms with legal and financial advisers.</li><li>This document is for preliminary discussion only. It is not a binding offer, valuation certificate, sanctioned feasibility report, investment advice or substitute for a legally vetted Joint Venture Agreement.</li><li>No party is bound unless and until definitive documents are executed by authorised parties after legal, technical, tax and financial review.</li></ul><h2 class="section-title">9. Acknowledgement for Further Discussion</h2><div class="signature-grid"><div class="signature"><h3>LANDOWNER</h3><div class="signline">Name: __________________</div><div class="signline">Signature: _______________</div><div class="signline">Date: ____________________</div></div><div class="signature"><h3>DEVELOPER</h3><div class="signline">Name: __________________</div><div class="signline">Signature: _______________</div><div class="signline">Date: ____________________</div></div><div class="signature"><h3>AVENTRIX REALTY</h3><div class="signline">Representative: L. Sanjay Gandhi</div><div class="signline">Signature: _______________</div><div class="signline">Date: ____________________</div></div></div><p class="prepared">Prepared by Aventrix Realty | Chennai, Tamil Nadu</p><p class="smallprint">CONFIDENTIAL — FOR DISCUSSION PURPOSES ONLY. Replace all assumptions with verified property, planning, market and cost data before presenting this as a site-specific proposal.</p>'+footer(4)+'</main></body></html>';
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
    } catch (error) {
      try { win.close(); } catch (_) {}
      console.error('Aventrix JV proposal generation failed:', error);
      alert('The proposal could not be generated. Please refresh the page and try again. If the issue continues, allow pop-ups for aventrixrealty.com.');
    }
  }
  $('jvc-reset').addEventListener('click',()=>{const v={'jvc-land-area-input':'2400','jvc-road-width':'30','jvc-project-type':'nonhighrise','jvc-land-deduction':'0','jvc-base-fsi':'2.00','jvc-premium-pct':'0','jvc-efficiency':'80','jvc-rate':'4800','jvc-construction-rate':'3000','jvc-cost-basis':'fsi','jvc-soft-cost-pct':'15','jvc-premium-charge':'0','jvc-other-costs':'0','jvc-profit-pct':'20','jvc-ratio':'50','jvc-deposit-type':'none','jvc-deposit-amount':'0','jvc-deposit-finance-rate':'12','jvc-deposit-months':'12'};Object.keys(v).forEach(id=>$(id).value=v[id]);ratioManuallyAdjusted=false;$('jvc-regulatory-note').textContent='FSI is not determined by road width alone. Confirm jurisdiction, use zone, building category, road width/length, setbacks, exclusions, height, parking, fire access and current amendments with a licensed architect and the competent authority. FSI is a manual, unverified modelling input here.';render();});
  render();
})();
