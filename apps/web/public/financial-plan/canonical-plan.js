/* Account facts and saved estimates come exclusively from FinancialPlanService.
 * Charts compare totals; they never imply restricted-fund allocation or settlement. */
const $ = selector => document.querySelector(selector);
const money = cents => cents == null ? 'Not recorded' : new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0,
  maximumFractionDigits: 2,
}).format(cents / 100);
const date = value => value ? new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium', timeZone: 'America/New_York',
}).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value)) : 'Not recorded';
const sum = (items, key) => items.reduce((total, row) => total + row[key], 0);
const pending = new Map();
let plan = null, draft = {}, saving = false, error = '', scenario = null, aidYear = false, dialogReturnFocus = null;
const colors = ['#312960', '#3d3577', '#4a4190', '#574da8', '#6459bf', '#7a70cc'];
const fields = [
  ['booksCents', 'Books & supplies'], ['transportCents', 'Transportation'], ['personalCents', 'Personal expenses & utilities'],
  ['rentCents', 'Monthly rent'], ['groceriesCents', 'Groceries'], ['otherExpensesCents', 'Other living expenses'],
  ['savingsCents', 'Savings on hand'], ['familyContributionCents', 'Family allowance'],
  ['employmentIncomeCents', 'Federal Work-Study'], ['otherIncomeCents', 'Job / paycheck'],
];
function request(operation, payload) {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('The university service did not respond. Your draft is retained.')); }, 30000);
    pending.set(id, { resolve, reject, timer });
    parent.postMessage({ type: 'financial-plan:request', id, operation, payload, idempotencyKey: id }, location.origin);
  });
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'financial-plan:response') return;
  const item = pending.get(event.data.id);
  if (!item) return;
  clearTimeout(item.timer); pending.delete(event.data.id);
  if (event.data.error) item.reject(new Error(event.data.error)); else item.resolve(event.data.result);
});
function askEdward(question) { parent.postMessage({ type: 'financial-plan:ask-edward', question }, location.origin); }
const ask = question => `<button class="edward-ask" type="button" aria-label="Ask Edward" title="Ask Edward" data-ask="${esc(question)}"><span class="edward-ask-mark">E</span></button>`;
const badge = (text, tone = 'quiet') => `<span class="status-pill sm ${tone}">${esc(text.replaceAll('_', ' '))}</span>`;
const head = (icon, title, copy, tools = '') => `<div class="story-head"><span class="card-icon">${ic(icon)}</span><div class="grow"><h2>${esc(title)}</h2><p>${esc(copy)}</p></div><div class="tools">${tools}</div></div>`;
const kpi = (label, value, copy, tone = '', detail = '') => `<div class="kpi2"><span class="lbl">${esc(label)}</span><strong class="${tone}">${value}</strong><p>${esc(copy)}</p>${detail ? `<button class="text-button" data-detail="${esc(detail)}">View breakdown →</button>` : ''}</div>`;
function table(headers, items, render, cls = 'aid-table') {
  return `<div class="table-scroll"><table class="${cls}"><thead><tr>${headers.map(x => `<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${items.map(x => `<tr>${render(x).map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function model() {
  const canonical = plan.aid.termAwards || [];
  const terms = canonical.map(row => {
    const preview=decisionPreviews.get(row.award_id);
    const expired=expiredOffersPreview&&row.status==='offered'||row.status==='expired'||row.status==='offered'&&row.decision_due_at&&row.decision_due_at<plan.snapshotAt;
    return {...row, status:preview?preview.status.toLowerCase():expired?'expired':row.status,
      accepted_cents:preview?preview.amount:row.accepted_cents, uiPreview:!!preview};
  });
  const gift=terms.filter(r=>r.posts_to_account&&!r.source.includes('loan')), loans=terms.filter(r=>r.source.includes('loan'));
  const open=terms.filter(r=>r.status==='offered'&&r.offered_cents>r.accepted_cents&&r.posts_to_account);
  const acceptedDelta=terms.filter(r=>r.posts_to_account).reduce((n,r)=>n+r.accepted_cents-(canonical.find(c=>c.award_id===r.award_id)?.accepted_cents||0),0);
  const gap=plan.planning.estimatedAccountGapAfterAnticipatedAidCents-acceptedDelta;
  const charges=plan.visualization.charges.map(r=>({...r,...StudentFinancialPresentation.chargeContext(plan,{...r,label:chargeLabel(r.label)})}));
  const sources=(plan.visualization.netPostedSources||plan.visualization.postedSources).filter(r=>r.amountCents>0).map(r=>{
    const ledger=plan.ledger.find(x=>x.id===r.id), disb=plan.aid.disbursements.find(x=>x.id===ledger?.disbursement_id);
    const loan=terms.find(x=>x.award_id===disb?.award_id)?.source.includes('loan');
    return {...r,color:ledger?.kind==='payment'?'#b9791e':loan?'#2a63a9':'#218365',sub:ledger?.kind==='payment'?'Payment received':'Aid posted to your account'};
  });
  for(const r of plan.aid.disbursements.filter(r=>['scheduled','held'].includes(r.status)))sources.push({id:r.id,label:r.name,amountCents:r.amount_cents,color:terms.find(x=>x.award_id===r.award_id)?.source.includes('loan')?'#2a63a9':'#67a88e',pending:true,sub:`${r.status==='held'?'Held':'Scheduled'} · ${date(r.scheduled_at)} · not posted`});
  for(const row of terms.filter(r=>r.posts_to_account&&r.uiPreview&&r.accepted_cents>0))sources.push({id:row.award_id,label:row.name,amountCents:row.accepted_cents,color:row.source.includes('loan')?'#2a63a9':'#218365',pending:true,sub:'Accepted in preview · not submitted'});
  let remaining=Math.max(0,gap);
  for(const row of [...open].sort((a,b)=>Number(a.source.includes('loan'))-Number(b.source.includes('loan')))){
    const amount=Math.min(remaining,row.offered_cents-row.accepted_cents);if(amount<=0)continue;
    sources.push({id:row.award_id,label:row.name,amountCents:amount,color:row.source.includes('loan')?'#2a63a9':'#218365',pending:true,potential:true,sub:'Not accepted · potential coverage'});remaining-=amount;
  }
  if(remaining>0)sources.push({id:'gap',label:terms.some(r=>r.status==='expired')?'Expired offers · still to cover':'Still to cover',amountCents:remaining,color:'#c98231',pending:terms.some(r=>r.status==='expired'),sub:'Out of pocket · after potential offers'});
  const workStudy=sum(terms.filter(r=>!r.posts_to_account),'accepted_cents');
  const values=key=>key==='employmentIncomeCents'?workStudy:draft[key]??0;
  const living=fields.slice(0,6).filter(([key])=>key!=='rentCents'||livingOffCampus).map(([id,label])=>({id,label,amountCents:values(id),sub:'Your spending estimate'}));
  const income=fields.slice(6).map(([id,label],i)=>({id,label,amountCents:values(id),color:['#b9791e','#d9a94c','#1a9e8f','#63c2b6'][i],sub:'Expected resource · not a payment'}));
  const loanRemaining=Math.min(Math.max(0,-gap),sum(loans,'accepted_cents'));
  const otherCredit=Math.max(0,-gap)-loanRemaining;
  if(loanRemaining>0)income.push({id:'loan-remainder',label:'Loan funds for living',amountCents:loanRemaining,color:'#2a63a9',sub:'Planning estimate · after university costs'});
  if(otherCredit>0)income.push({id:'account-credit',label:'Other university credit',amountCents:otherCredit,color:'#218365',sub:'Estimated non-loan credit'});
  const livingTotal=sum(living,'amountCents'),incomeTotal=sum(income,'amountCents');
  return {terms,gift,loans,open,gap,charges,sources,living,income,livingTotal,incomeTotal,cushion:incomeTotal-livingTotal,workStudy,loanRemaining,otherCredit,acceptedDelta};
}

function pop(title, body) {
  const dialog = $('#pop');
  if(!dialog.open)dialogReturnFocus=document.activeElement;
  dialog.setAttribute('aria-labelledby', 'financial-detail-title');
  dialog.innerHTML = `<header class="pop-head"><span class="tile">${ic('receipt')}</span><div><span class="detail-eyebrow">${esc(plan.term?.name || plan.termId)} · Financial details</span><h2 id="financial-detail-title">${esc(title)}</h2></div><button class="detail-close" data-close aria-label="Close financial details">${ic('close')}</button></header><div class="pop-body">${body}</div><footer class="pop-foot"><span>Your plan, explained.</span><button class="secondary-button" data-close>Done</button></footer>`;
  const contextButton = dialog.querySelector(".edward-ask");
  if (contextButton) dialog.querySelector(".pop-head").insertBefore(contextButton, dialog.querySelector(".detail-close"));
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('[data-close]')?.focus();
}

function detail(key) {
  const m = model(), a = plan.account;
  const breakdown = items => `<div class="detail-breakdown">${items.map(r => `<div><span>${esc(r.label)}</span><strong>${money(r.amountCents)}</strong></div>`).join('')}</div>`;
  const descriptions = {
    charges: ['Your university charges', `<div class="detail-total"><span>Posted this semester</span><strong>${money(a.postedChargesCents)}</strong></div>${breakdown(m.charges)}<p>These charges are billed by your university. Your personal living budget is separate.</p>`],
    gap: ['What remains to cover', `${breakdown([{label:'University charges',amountCents:a.postedChargesCents},{label:'Aid posted',amountCents:-a.postedAidCents},{label:'Payments & credits posted',amountCents:-a.postedPaymentCreditsCents},...(a.adjustmentsCents ? [{label:'Account adjustments',amountCents:a.adjustmentsCents}] : []),{label:'Posted account balance',amountCents:a.postedBalanceCents},{label:'Aid expected to arrive',amountCents:-plan.aid.anticipatedTermCents}])}<div class="detail-total"><span>Estimated remaining balance</span><strong>${money(m.gap)}</strong></div><p>Accepted aid reduces your posted balance only when it reaches your account. Offers you have not accepted are shown separately.</p>`],
    gifts: ['Scholarships & grants', awardTable(m.gift)], loans: ['Student loans', awardTable(m.loans)],
    living: ['Your everyday expenses', breakdown(m.living)], income: ['Money for living', breakdown(m.income)],
    cushion: ['Your monthly breathing room', `<div class="detail-total"><span>${m.cushion >= 0 ? 'Left over each month' : 'Needed each month'}</span><strong>${money(Math.abs(m.cushion) / termLength().months)}</strong></div>${breakdown([{label:'Funds for the semester',amountCents:m.incomeTotal},{label:'Living costs',amountCents:-m.livingTotal},{label:'Semester difference',amountCents:m.cushion}])}<p>Monthly averages use the ${termLength().days}-day semester (${termLength().months.toFixed(1)} average months). This is separate from your university bill.</p>`],
    attendance: ['Your full attendance estimate', breakdown([{label:'University charges',amountCents:a.postedChargesCents},{label:'Personal living estimate',amountCents:m.livingTotal},{label:'Combined estimate',amountCents:a.postedChargesCents+m.livingTotal}])],
    'living-surplus': ['Money left over', `<p>Your planned resources exceed your expenses by <strong>${money(m.cushion)}</strong> this semester. That is about <strong>${money(m.cushion / termLength().months)}</strong> each month.</p>`],
    'living-shortfall': ['Close the gap', `<p>Your living budget needs another <strong>${money(-m.cushion)}</strong> this semester. Review expenses or additional income in your plan.</p>`],
    'parent-plus': ['Your federal loan options', `<p>Different borrowers use different loan programs. These are educational examples, not additional offers.</p><div class="loan-type-list">${StudentFinancialPresentation.loanTypes.map(type=>`<article><span>${esc(type.who)}</span><h3>${type.title}</h3><p>${type.body}</p></article>`).join('')}</div><a class="secondary-button" href="https://studentaid.gov/understand-aid/types/loans" target="_blank" rel="noopener noreferrer">Current Federal Student Aid guidance ↗</a><p class="meta muted">Confirm current eligibility and limits with Financial Aid. Parent PLUS is parent borrowing; there is no separate subsidized Parent PLUS offer.</p>${ask('Can my family explore Parent PLUS, and what are the current eligibility rules?')}`],
  };
  if(key==='loan-remainder')return pop('Loan funds for living',`<div class="detail-total"><span>Planning estimate after university costs</span><strong>${money(m.loanRemaining)}</strong></div><p>This illustration applies gifts and payments to university charges first, then loans. It is not a university allocation or confirmed refund.</p>${breakdown([{label:'Accepted loans',amountCents:sum(m.loans,'accepted_cents')},{label:'Estimated credit after charges',amountCents:Math.max(0,-m.gap)},{label:'Loan portion available for living',amountCents:m.loanRemaining}])}`);
  if (descriptions[key]) return pop(...descriptions[key]);
  const offer = m.terms.find(r => r.award_id === key || `offer-${r.award_id}` === key);
  if (offer) {
    const loan=offer.source.includes('loan'),work=!offer.posts_to_account,terms=plan.aid.loanTerms.find(r=>r.fund_id===offer.fund_id);
    const conditions=StudentFinancialPresentation.scholarshipRules(offer);
    const scholarship=/scholarship/i.test(offer.name);
    const conditionHtml=!loan&&!work&&scholarship?`<h3>Keeping your scholarship</h3><div class="condition-grid"><div><span>Minimum GPA</span><strong>${typeof conditions.gpa==='number'?conditions.gpa.toFixed(1):'See offer'}</strong></div><div><span>Maximum duration</span><strong>${esc(String(conditions.duration??'See offer'))} semesters</strong></div><div><span>Enrollment</span><strong>${esc(conditions.load)}</strong></div><div><span>Renewal review</span><strong>${esc(conditions.review)}</strong></div></div><p class="detail-note">${conditions.sample?'Illustrative renewal requirements · your actual award letter determines eligibility.':'Renewal requirements provided with your award.'}</p>`:!loan&&!work?`<h3>Keeping your grant</h3><div class="condition-grid"><div><span>Eligibility</span><strong>Review your offer</strong></div><div><span>Academic progress</span><strong>Your university’s SAP policy</strong></div></div><p>Grant eligibility and renewal differ by program. Your offer note above contains the conditions published for this award.</p>`:'';
    return pop(offer.name,`<div class="detail-total"><span>${loan?'Loan':work?'Work-study':'Gift aid'} offered this semester</span><strong>${money(offer.offered_cents)}</strong></div><p>${esc(offer.note||(loan?'Principal and applicable interest must be repaid.':'Review eligibility and renewal conditions before deciding.'))}</p>${conditionHtml}${loan?`<div class="detail-breakdown"><div><span>Interest rate</span><strong>${terms?`${terms.interest_basis_points/100}%`:'Confirm with Financial Aid'}</strong></div><div><span>Origination fee</span><strong>${terms?`${terms.fee_basis_points/100}%`:'See your agreement'}</strong></div><div><span>Repayment term</span><strong>${terms?`${terms.term_months} months`:'See your agreement'}</strong></div></div><p>${offer.name.toLowerCase().includes('unsubsidized')?'Interest accrues while you study.':'Interest support may apply during eligible periods.'}</p>`:''}<h3>${work?'Your earnings':'When these funds arrive'}</h3>${work?'<p>Work-study is earned through eligible work. Your accepted semester amount also appears in your living budget; it is not guaranteed wages.</p>':disbursementList(offer)}<div class="detail-note">${offer.decision_due_at?`Decision deadline · ${date(offer.decision_due_at)}`:'No decision deadline published'} · ${esc(offer.status)}</div>${offer.status==='offered'?decisionButtons(offer):offer.uiPreview?`<button class="secondary-button" data-reset-award="${esc(offer.award_id)}">Undo decision preview</button>`:badge(offer.status,offer.status==='expired'?'wait':'done')}${ask(`Explain the conditions and disbursement schedule for my ${offer.name}.`)}`);
  }
  const item = [...m.charges, ...m.sources, ...m.living, ...m.income].find(r=>r.id===key);
  if (item) {
    const charge = m.charges.some(r=>r.id===key), ledger = plan.ledger.find(r=>r.id===key);
    return pop(item.label, `<div class="detail-total"><span>${esc(item.sub)}</span><strong>${money(item.amountCents)}</strong></div>${charge?chargeDetails(item):`<p>${esc(/deposit/i.test(item.label)?'Your enrollment deposit has already been applied toward your university bill. You do not need to pay it again.':item.sub)}</p>`}${ledger?.posted_at?`<div class="detail-note">Recorded on ${date(ledger.posted_at)}</div>`:''}${ask(`Explain ${item.label}, how it is calculated, and what it means for my balance.`)}`);
  }
  const rate = plan.catalog.find(r=>r.id===key);
  if (rate) return pop(rate.name, `<div class="detail-total"><span>Published ${esc(rate.period)} rate</span><strong>${money(rate.amount_cents)}</strong></div><p>${esc(rate.eligibility)}</p><div class="detail-note">Effective ${date(rate.effective_from)}–${date(rate.effective_until)}</div><p>Compare this option for next semester. Your current enrollment and room assignment stay unchanged.</p>${ask(`What should I know about ${rate.name}?`)}`);
}

function arc(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0), big = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0},${y0} A${r1},${r1} 0 ${big} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${big} 0 ${x3},${y3} Z`;
}
function comparison(living = false) {
  const m = model(), costs = [...(living ? m.living : m.charges)], sources = [...(living ? m.income : m.sources)];
  const total = sum(costs,'amountCents'), funding = sum(sources,'amountCents');
  if (living && m.cushion > 0) costs.push({id:'living-surplus',label:'Money left over',amountCents:m.cushion,color:'#218365'});
  if (living && m.cushion < 0) sources.push({id:'living-shortfall',label:'Amount still needed',amountCents:-m.cushion,color:'#ce5353'});
  const arcs = (items,r0,r1,kind,denominator) => {
    let start = -Math.PI/2;
    return items.flatMap((r,i)=>{
      if (r.amountCents <= 0) return [];
      const end=start+r.amountCents/Math.max(1,denominator)*Math.PI*2;
      const path=`<path class="arc" tabindex="0" role="button" aria-label="${esc(r.label)}: ${money(r.amountCents)}. View details" data-detail="${esc(r.id)}" data-ring-key="${esc(r.id)}" d="${arc(125,125,r0,r1,start,end-.008)}" fill="${r.pending ? `url(#pending-${living ? 'living' : 'university'}-${r.color === '#c98231' ? 'gap' : r.color === '#2a63a9' ? 'loan' : 'gift'})` : r.color || (kind==='cost'?colors[i%colors.length]:'#218365')}"><title>${esc(r.label)} · ${money(r.amountCents)}</title></path>`;
      start=end;return [path];
    }).join('');
  };
  const rows=(items,cost)=>`<ul class="src-list">${items.map((r,i)=>`<li><button class="src-row" data-detail="${esc(r.id)}" data-ring-key="${esc(r.id)}"><i style="background:${r.color || (cost?colors[i%colors.length]:'#218365')}"></i><span class="n">${esc(r.label)}<small>${esc(r.sub || 'Budget difference')}</small></span><span class="a">${money(r.amountCents)}<small>Details ↗</small></span></button></li>`).join('')}</ul>`;
  const editor=items=>items.filter(r=>fields.some(([key])=>key===r.id)).map((r,i)=>{
    const unit=budgetUnits[r.id] || 'term', factor=unitFactor(unit), flexible=['transportCents','familyContributionCents','otherIncomeCents'].includes(r.id);
    return `<div class="living-expense-entry" data-ring-key="${esc(r.id)}"><label class="income-name" for="budget-${r.id}"><i style="background:${r.color || colors[i%colors.length]}"></i><span>${esc(r.label)}<small>${budgetHelp[r.id] || 'Your estimate for this semester'}</small></span></label><div class="budget-value"><span class="money-input"><span aria-hidden="true">$</span><input id="budget-${r.id}" data-budget="${r.id}" type="number" min="0" max="1000000" step="0.01" value="${Math.round(r.amountCents/factor)/100}" ${r.id==='employmentIncomeCents'?'readonly aria-readonly="true"':''} aria-label="${esc(r.label)} amount"></span>${flexible ? `<select data-budget-unit="${r.id}" aria-label="${esc(r.label)} period">${['term','month','week','day'].map(v=>`<option value="${v}" ${unit===v?'selected':''}>${unitLabel(v)}</option>`).join('')}</select>` : `<span class="budget-unit">${r.id==='savingsCents'?'available now':unitLabel(unit)}</span>`}</div></div>`;
  }).join('');
  const center=living?money(Math.abs(m.cushion)/termLength().months):`${total?Math.min(100,Math.max(0,Math.round((total-m.gap)/total*100))):0}%`;
  return `<div class="ring-grid comparison-ring"><div class="chart-wrap"><svg class="ring" viewBox="0 0 250 250" aria-label="${living?'Living budget':'University expenses'} and funding comparison"><defs>${[['gift','#218365'],['loan','#2a63a9'],['gap','#c98231']].map(([kind,color])=>`<pattern id="pending-${living?'living':'university'}-${kind}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="7" height="7" fill="#f5f7fb"/><rect width="3" height="7" fill="${color}"/></pattern>`).join('')}</defs>${arcs(costs,92,118,'cost',living?Math.max(total,funding):total)}${arcs(sources,64,88,'source',living?Math.max(total,funding):funding)}<text x="125" y="120" text-anchor="middle" font-size="${center.length>8?20:26}" font-weight="650" fill="${living?(m.cushion>=0?'#218365':'#c24b4b'):'#292541'}">${center}</text><text x="125" y="139" text-anchor="middle" font-size="10" fill="#687086">${living?(m.cushion>=0?'left over each month':'needed each month'):`of ${money(total)} covered`}</text><text x="125" y="156" text-anchor="middle" font-size="9" fill="#687086">${living?`${termLength().days}-day semester average`:m.gap<0?`${money(-m.gap)} estimated credit`:`${money(m.gap)} still to plan`}</text></svg><p class="meta muted">${living?'A little clarity for your everyday budget.':'Explore a segment to see the full picture.'}</p><div class="chart-key"><span><i style="background:#574da8"></i>Expenses</span><span><i style="background:#218365"></i>Funds</span></div></div><div class="legend-pair"><div><div class="legend-title"><h3>${living?'Living expenses':'University expenses'}</h3><b>${money(total)}</b></div>${living?editor(costs):rows(costs,true)}</div><div><div class="legend-title"><h3>${living?'Money for living':'Funds & potential offers'}</h3><b>${money(funding)}</b></div>${living?editor(sources)+`<button type="button" class="budget-loan-remainder" data-ring-key="loan-remainder" data-detail="loan-remainder"><span>Remaining loan funds for living ↗</span><b>${money(m.loanRemaining)}</b></button>${m.otherCredit?`<div class="budget-loan-remainder" data-ring-key="account-credit"><span>Other estimated credit</span><b>${money(m.otherCredit)}</b></div>`:''}<small class="budget-allocation-note">Planning illustration: gift aid and payments cover university charges first. Financial Aid confirms actual refund allocation.</small>`:rows(sources,false)}</div></div></div>`;
}

function budgetDirty() {
  return fields.some(([key]) => draft[key] !== plan.planning.inputs[key]);
}
function refreshBudget() {
  const section=$('#budget-form')?.closest('section');if(!section)return;
  const m=model(), fragment=document.createElement('div');fragment.innerHTML=comparison(true);
  section.querySelector('svg.ring')?.replaceWith(fragment.querySelector('svg.ring'));
  const root = section.querySelector('.comparison-ring');
  const active = comparisonItem(document.activeElement, root) || root.querySelector('[data-ring-key]:hover');
  highlightComparison(root, active?.dataset.ringKey);
  section.querySelectorAll('.legend-title>b').forEach((el,i)=>el.textContent=money(i?m.incomeTotal:m.livingTotal));
  const summary=section.querySelectorAll('.budget-summary>span');
  if(summary[0])summary[0].innerHTML=`${money(m.livingTotal)} <small>semester expenses</small>`;
  if(summary[1])summary[1].innerHTML=`${money(m.incomeTotal)} <small>semester resources</small>`;
}

function budget() {
  const m=model();
  return `<section class="story">${head('wallet','A budget for your everyday life','A clearer view of what comes in, what goes out, and what is left for you.')}<div class="budget-summary"><span>${money(m.livingTotal)} <small>semester expenses</small></span><span>${money(m.incomeTotal)} <small>semester resources</small></span><label class="housing-choice">Living arrangement<select id="living-housing"><option value="campus" ${!livingOffCampus?'selected':''}>On campus</option><option value="off" ${livingOffCampus?'selected':''}>Off campus / with family</option></select></label></div><form id="budget-form">${comparison(true)}<div class="cta-row"><button type="submit" class="primary-button" ${saving?'disabled':''}>${saving?'Saving…':'Save term estimates'}</button><span class="meta muted" id="budget-status" role="status">${error?esc(error):budgetDirty()?'You have unsaved estimates.':'Your personal budget is separate from your university bill.'}</span></div></form><div class="next-semester"><span class="tile">${ic('spark')}</span><div><strong>A little planning. A better next semester.</strong><p>Explore housing, meals and your budget before you commit.</p></div><a class="secondary-button" href="#simulator">Plan next semester →</a></div></section>`;
}

function nextList(items) {
  return `<ul class="next-list">${items.map(r => `<li><span class="d">${new Date(r.at).toLocaleDateString('en-US', { month: 'short', timeZone: 'America/New_York' })}<b>${new Date(r.at).toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/New_York' })}</b></span><span class="t">${esc(r.title)}<small>${esc(r.note)}</small></span><span class="a">${r.amount == null ? '' : money(r.amount)}</span></li>`).join('')}</ul>`;
}
function overview() {
  const m=model(),a=plan.account;
  return `<section class="story">${head('receipt','What college costs. What covers it.','Your university bill and the funds paying toward it, all in one place.')}<div class="kpis">${kpi('University charges',money(a.postedChargesCents),'Billed this semester','','charges')}${kpi('Scholarships & grants',money(sum(m.gift,'accepted_cents')),'Accepted · no repayment','good','gifts')}${kpi('Student loans',money(sum(m.loans,'accepted_cents')),'Accepted · repayment required','','loans')}${kpi('Still to plan',money(m.gap),'After anticipated aid','warn','gap')}</div>${comparison()}${m.open.length?`<div class="open-offers"><div><span class="pending-swatch"></span><strong>Offers still waiting for you</strong><p>Striped segments show potential coverage. These offers are not accepted and are not included in your current covered percentage.</p></div>${m.open.map(r=>`<button data-detail="${esc(r.award_id)}"><span>${esc(r.name)}</span><strong>${money(r.offered_cents-r.accepted_cents)} →</strong></button>`).join('')}</div>`:''}</section>${budget()}`;
}

function awardTable(items) {
  if(!items.length)return '<p class="empty-copy">No offers in this category yet. They will appear here when your university publishes them.</p>';
  return `<div class="award-list">${items.map(r=>{
    const loan=r.source.includes('loan'),term=plan.aid.loanTerms.find(t=>t.fund_id===r.fund_id),disb=plan.aid.disbursements.find(d=>d.award_id===r.award_id),preview=decisionPreviews.get(r.award_id), annual=plan.aid.awards.find(a=>a.id===r.award_id),shown=aidYear&&annual?annual:r;
    return `<article class="award-row ${loan?'is-loan':'is-gift'}"><span class="award-symbol">${ic(loan?'wallet':'award')}</span><div class="award-copy"><h3>${esc(r.name)}${loan&&term?`<span class="rate-label">${term.interest_basis_points/100}% interest</span>`:''}</h3><p>${loan?'Borrow only what you need.':r.posts_to_account?'Money for college you do not repay.':'Earnings paid to you through eligible work.'}</p><div class="award-meta">${badge(preview?`${preview.status} · preview`:r.status,r.status==='accepted'?'done':'wait')}<span>${disb?`${disb.status==='posted'?'Posted':'Scheduled'} ${date(disb.posted_at||disb.scheduled_at)}${plan.aid.disbursements.filter(d=>d.award_id===r.award_id).length>1?' · more dates in details':''}`:r.decision_due_at?`Decide by ${date(r.decision_due_at)}`:'Review the terms below'}</span></div><div class="award-actions">${r.status==='offered'?decisionButtons(r):r.uiPreview?`<button class="text-button" data-reset-award="${esc(r.award_id)}">Undo preview</button>`:''}<button class="text-button" data-detail="${esc(r.award_id)}">${loan?'Loan':'Award'} details ↗</button></div></div><div class="award-amount"><strong>${money(preview?.amount ?? (shown.accepted_cents || shown.offered_cents))}</strong><small>${preview?'preview amount':r.status==='accepted'?'accepted':r.status==='expired'?'expired':'offered'}${aidYear?' this year':' this semester'}</small></div></article>`;
  }).join('')}</div>`;
}

function aid() {
  const m=model();
  const progress=(items,label,copy,loan=false)=>{
    const offered=sum(items,'offered_cents'),accepted=sum(items,'accepted_cents'),declined=sum(items.filter(r=>['declined','expired'].includes(r.status)),'offered_cents'),waiting=Math.max(0,offered-accepted-declined);
    return `<article class="aid-progress ${loan?'loan-progress':''}"><span class="detail-eyebrow">${label}</span><h2>${money(accepted)} <small>of ${money(offered)}</small></h2><p>${copy}</p><div class="fund-progress" aria-label="${Math.round(accepted/Math.max(1,offered)*100)}% accepted"><i style="width:${accepted/Math.max(1,offered)*100}%"></i><i class="declined" style="width:${declined/Math.max(1,offered)*100}%"></i></div><div class="progress-legend"><span>Accepted <b>${money(accepted)}</b></span><span>Pending <b>${money(waiting)}</b></span>${declined?`<span>Declined / expired <b>${money(declined)}</b></span>`:''}</div></article>`;
  };
  return `<div class="aid-progress-grid">${progress(m.gift,'Scholarships & grants','Support for college that you do not pay back.')}${progress(m.loans,'Student loans','Borrowed funds, repaid with applicable interest.',true)}<article class="aid-progress acceptance-preview"><span class="detail-eyebrow">If you accept every open offer</span><h2>${money(Math.abs(m.gap-sum(m.open,'offered_cents')))}</h2><p>${m.gap-sum(m.open,'offered_cents')>=0?'Estimated amount still to cover':'Estimated credit after university charges'}</p><button class="secondary-button" data-offer-scenario="accepted">Explore this scenario →</button><button class="text-button" data-offer-scenario="expired">What if offers expire?</button><small>Illustrative decisions · no submission</small></article></div><section class="story">${head('award','Scholarships & grants','Start here. Review gift aid before deciding how much to borrow.',ask('Help me understand my scholarship and grant offers.'))}${awardTable(m.gift)}</section><section class="story">${head('wallet','Borrow with a clear picture','Accept only what you need. See your rate, fees and repayment terms before deciding.',ask('How much should I consider borrowing?'))}${awardTable(m.loans)}<button class="parent-plus" data-detail="parent-plus"><span>${ic('users')} Exploring options with your family?</span><span>Learn about Parent PLUS →</span></button></section><section class="story">${head('wallet','Work-Study','Earn through eligible campus work. These funds support your living budget, not your university bill.')}${awardTable(m.terms.filter(r=>!r.posts_to_account))}<p class="meta muted">Your living budget includes ${money(m.workStudy)} of expected work-study earnings this semester.</p></section>`;
}

function billingException() {
  return (plan.exceptions || []).filter(r=>r.status === 'approved' && r.starts_at <= plan.snapshotAt && r.ends_at > plan.snapshotAt).map(r=>`<div class="notice quiet"><span class="notice-copy"><strong>${esc(r.office_name)} · approved billing exception</strong>${esc(r.reason)}</span></div>`).join('');
}
function paymentSchedule(){
 const agreement=plan.paymentAgreements.find(r=>!['cancelled','completed'].includes(r.status));
 const rows=agreement?plan.installments.filter(r=>r.agreement_id===agreement.id).sort((a,b)=>a.due_at.localeCompare(b.due_at)):[];
 return {agreement,rows,events:rows.map(row=>({at:row.due_at,title:'Payment plan installment',note:`${row.payment_id?'Payment recorded':agreement.status==='proposed'?'Proposed':'Upcoming'} · principal only`,amount:row.amount_cents}))};
}
function payments() {
 const a=plan.account,m=model(),schedule=paymentSchedule(),{agreement,rows:installments}=schedule;
 const loanPosted=sum(plan.aid.disbursements.filter(r=>r.status==='posted'&&m.loans.some(l=>l.award_id===r.award_id)),'amount_cents');
 const giftAccepted=sum(m.gift,'accepted_cents'),loanAccepted=sum(m.loans,'accepted_cents');
 const paid=paymentView==='paid',refunded=paymentView==='refund_received',refundPending=paymentView==='refund_pending';
 const active=paymentView==='plan'||paymentView==='live'&&agreement&&agreement.status!=='proposed';
 const balance=paid||refunded?0:['credit','refund_pending'].includes(paymentView)?-125000:m.gap;
 const stateTitle=refunded?'Your refund has arrived':refundPending?'Your refund preference is ready':paid||balance===0?'You’re covered this semester':active?'Your balance has a plan':balance<0?'A credit, ready for your next step':'Estimated remaining balance';
 const stateCopy=refunded?`${money(125000)} received by ${paymentMethodPreview.toLowerCase()} · example completion.`:refundPending?`${paymentMethodPreview} selected in preview. Student Accounts confirms the amount and delivery date.`:paid?'Your one-time payment covers this example balance. No real payment was processed.':active?'Follow the schedule below. Your installments cover the remaining planned balance.':`${money(plan.aid.anticipatedTermCents+m.acceptedDelta)} in accepted aid is still expected.`;
 const stateControl=`<label class="payment-scenario-control">Explore a payment scenario<select id="payment-state-preview">${[['live','My actual account'],['plan','Active installment plan'],['paid','Paid in full'],['credit','Credit to receive'],['refund_received','Refund received']].map(([value,label])=>`<option value="${value}" ${paymentView===value?'selected':''}>${label}</option>`).join('')}${refundPending?'<option value="refund_pending" selected>Refund preference ready</option>':''}</select></label>`;
 const options=balance>0&&!active?`<section class="story">${head('card','Choose what works for you','Two straightforward ways to cover your remaining university balance.')}<div class="pay-options"><article class="pay-option"><span class="tile">${ic('card')}</span><h3>One-time payment</h3><strong class="option-amount">${money(balance)}</strong><p>Take care of your balance in one payment.</p><button class="primary-button" data-payment="one">Review payment →</button></article><article class="pay-option"><span class="tile">${ic('calendar')}</span><h3>Pay over time</h3><strong class="option-amount">${money(installments[0]?.amount_cents||Math.ceil(balance/4))}<small> / installment</small></strong><p>${installments.length||4} installments · ${money(agreement?.fee_cents||0)} setup fee.</p><button class="secondary-button" data-payment="plan">Review payment plan →</button></article></div></section>`:'';
 return `<section class="story">${head('receipt','Your bill, made simple','Charges, accepted support and payments already received.')}${stateControl}<div class="payment-buckets">${kpi('University charges',money(a.postedChargesCents),'Posted this semester','','charges')}${kpi('Scholarships & grants',money(giftAccepted),`${money(a.postedAidCents-loanPosted)} posted · ${money(Math.max(0,giftAccepted-a.postedAidCents+loanPosted))} expected`,'good','gifts')}${kpi('Loans',money(loanAccepted),`${money(loanPosted)} posted · ${money(Math.max(0,loanAccepted-loanPosted))} accepted, not yet posted`,'','loans')}${kpi('Payments & credits',money(a.postedPaymentCreditsCents),'Posted · includes your enrollment deposit')}</div><div class="balance-action ${balance>0&&!active?'owes':'covered'}"><div><span class="detail-eyebrow">${stateTitle}</span><strong>${money(refunded?125000:Math.abs(balance))}</strong><p>${stateCopy} ${paymentView==='live'?'<button class="text-button" data-detail="gap">See the calculation ↗</button>':''}</p></div><div>${active?'<button class="secondary-button" data-payment="plan">View my payment plan →</button>':balance>0?'<button class="primary-button" data-payment="one">Make a payment →</button><button class="secondary-button" data-payment="plan">Set up a payment plan</button>':balance<0&&!refundPending?'<button class="primary-button" data-payment="refund">Choose a refund method →</button>':`<span class="status-pill done">${refundPending?'Awaiting university confirmation':refunded?'Refund received · preview':'No payment needed'}</span>`}</div></div>${billingException()}</section>${options}<section class="story">${head('calendar','Payment schedule',paid||refunded?'No upcoming payments in this scenario.':active?'Upcoming installments in your active plan.':'Your proposed schedule. No payment is made until you authorize it.')}${paid||refunded?'<div class="schedule-complete">'+ic('check')+'<span>A little more breathing room.<small>Your example semester is covered.</small></span></div>':installments.length?nextList(schedule.events):'<p class="empty-copy">Your schedule will appear here when a plan is available.</p>'}${agreement&&!paid&&!refunded?`<div class="schedule-total"><span>Principal ${money(sum(installments,'amount_cents'))} + setup fee ${money(agreement.fee_cents)}</span><strong>${money(sum(installments,'amount_cents')+agreement.fee_cents)} total</strong></div>`:''}</section><section class="story">${head('history','Payment history','Payments received and credited to your university account.')}${paid||refunded?`<div class="payment-preview-receipt"><span>${paid?'Payment':'Refund'} example · ${esc(paymentMethodPreview)}</span><strong>${money(paid?Math.max(0,m.gap):125000)}</strong><small>Preview only · not a university transaction</small></div>`:''}${table(['Date','Method','Amount','Status'],plan.payments,r=>[date(r.settled_at||r.submitted_at),esc(r.method.replaceAll('_',' ')),money(r.amount_cents),badge(r.status,r.status==='posted'?'done':'wait')])}</section>`;
}

function splitCopy(now, count, fee) {
  const rest = Math.max(0, model().gap - now), first = Math.ceil(rest / count), last = rest - first * (count - 1);
  return `${money(now)} now, then ${count - 1} payments of ${money(first)} and one of ${money(last)}${fee ? `, plus a ${money(fee)} fee` : ''}. Preview only.`;
}
const optionalCoverage = [
  ['Tuition & housing protection', 'GradGuard', '$298 / semester'],
  ['Renters insurance', 'GradGuard', '$12 / month'],
  ['Device protection', 'AKKO', '$15 / month'],
];
function coverage() {
  return `<section class="story">${head('shield', 'Coverage & protection', 'Your university insurance and optional ways to protect your life on campus.')}<div class="cov-mini">${plan.insuranceCoverage.map(r => {
    const rate = plan.catalog.find(c => c.id === r.catalog_id);
    return `<div class="cov-mini-row"><span class="tile sm">${ic('health')}</span><span>Health plan<small>${esc(rate?.name || r.catalog_id)} · ${money(rate?.amount_cents)} / ${esc(rate?.period || 'year')}</small></span><button class="text-button" data-detail="${esc(r.catalog_id)}">${badge(r.status, 'purple')}</button></div>`;
  }).join('')}${optionalCoverage.map(([name, provider, amount], i) => `<div class="cov-mini-row"><span class="tile sm">${ic('shield')}</span><span>${name}<small>${provider} · ${amount} · illustrative option</small></span><button class="text-button" data-optional="${i}">${badge('Not enrolled')}</button></div>`).join('')}</div><p class="meta muted">Optional products and prices are illustrative previews, not purchased coverage. University coverage and its rate above come from your account.</p>${ask('What health insurance is on my account and what should I do to request a waiver?')}</section>`;
}
function expenses() {
  const m = model(), housing = m.charges.filter(r => /housing|room/i.test(r.label)), meals = m.charges.filter(r => /meal/i.test(r.label)), tuition = m.charges.filter(r => /tuition|fee/i.test(r.label));
  const rows = items => table(['Expense', 'Amount', 'Details'], items, r => [`<b>${esc(r.label)}</b><small>Posted to your university account</small>`, money(r.amountCents), r.explore ? `<a class="secondary-button sm-button" href="#${r.explore}">Explore ${r.explore} →</a>` : `<button class="secondary-button sm-button" data-detail="${r.id}">View details →</button>`], 'expense-table');
  return `<div class="section-intro"><div><h2>Your expenses, explained.</h2><p>${esc(plan.term?.name || plan.termId)} · Review your tuition, room and board, and coverage in one place.</p></div><a class="secondary-button" href="#simulator">Explore a scenario →</a></div><div class="kpis">${kpi('University expenses', money(plan.account.postedChargesCents), 'Committed charges this term', '', 'charges')}${kpi('Living expenses', money(m.livingTotal), 'Estimated · paid directly by you', '', 'living')}${kpi('Room & board', money(sum([...housing, ...meals], 'amountCents')), 'University housing + meal plan')}${kpi('Full attendance estimate', money(plan.planning.totalAttendanceEstimateCents), 'University charges + saved living budget', '', 'attendance')}</div><div class="plan-periods"><div>${badge('Current plan', 'done')}<h3>${esc(plan.term?.name || plan.termId)}</h3><p>Charges and current coverage are recorded on your account.</p></div><div>${badge('Explore your options')}<h3>Plan next semester</h3><p>Compare published room and meal rates without changing your current selections.</p><a class="text-button" href="#simulator">Open the Simulator →</a></div></div><section class="story">${head('graduation', 'Tuition & required fees', 'Your university charges, as posted on the account.')}${rows(tuition)}<div class="ledger-foot">Tuition & fees total <b>${money(sum(tuition, 'amountCents'))}</b></div></section><section class="story">${head('home', 'Housing & meals', 'Your current room and meal costs. Explore the alternatives before making a change.')}${rows([...housing.map(r => ({...r, explore:'housing'})), ...meals.map(r => ({...r, explore:'meals'}))])}<div class="ledger-foot">University room & board total <b>${money(sum([...housing, ...meals], 'amountCents'))}</b></div></section>${coverage()}`;
}
function catalog(kind) {
  const housing = kind === 'housing', items = plan.catalog.filter(r => r.kind === kind && r.period === 'term');
  const current = housing ? plan.visualization.charges.find(r => /housing|room/i.test(r.label)) : plan.catalog.find(r => r.id === plan.mealEnrollments.find(r => r.status === 'active')?.catalog_id);
  const currentCost = current?.amountCents ?? current?.amount_cents;
  return `<nav class="campus-breadcrumb" aria-label="Breadcrumb"><a href="#expenses">Expenses</a><span>/</span><span>${housing ? 'Housing' : 'Meal plans'}</span></nav><section class="campus-hero"><img src="assets/img/${housing ? 'concept4-housing-hall.png' : 'concept4-dining-hall.png'}" alt="Illustrative university ${housing ? 'residence hall' : 'dining commons'}"><div class="campus-hero-copy"><span class="campus-eyebrow">${housing ? 'A place to make your own' : 'Good food. Your kind of routine.'}</span><h2>${housing ? 'Find your home<br>at Aster.' : 'A meal plan that<br>fits your day.'}</h2><p>Explore the options and costs that fit your life.</p></div></section><section class="campus-current"><span class="tile">${ic(housing ? 'home' : 'food')}</span><div class="grow"><span class="panel-label">Your current ${housing ? 'housing charge' : 'meal plan'}</span><h3>${esc(current?.label || current?.name || 'Review your current selection')}</h3></div><div class="current-price"><strong>${money(currentCost)}</strong><small>Per semester</small></div>${badge('Current', 'done')}</section><div class="section-intro"><div><h2>${housing ? 'Room for your next chapter.' : 'Choose how you dine.'}</h2><p>Compare published university rates. Changes require university approval.</p></div></div><div class="campus-options">${items.map((r, i) => `<article class="campus-option ${r.amount_cents === currentCost ? 'selected' : ''}"><button class="campus-photo" data-detail="${r.id}" aria-label="Explore ${esc(r.name)}"><img src="assets/img/${housing ? i ? 'concept4-housing-suite.png' : 'concept4-housing-room.png' : i ? 'concept4-dining-cafe.png' : 'concept4-dining-meal.png'}" alt="Illustrative ${housing ? 'student room' : 'campus meal'}" loading="lazy"><span class="image-pill">Explore this plan</span></button><div class="campus-option-body"><div class="campus-option-title"><h3>${esc(r.name)}</h3><strong>${money(r.amount_cents)}<small>/ semester</small></strong></div><p>${esc(r.eligibility)}</p></div><div class="campus-option-foot"><span>${currentCost == null ? 'Published rate' : r.amount_cents === currentCost ? 'Same cost as your current plan' : `${money(Math.abs(r.amount_cents - currentCost))} ${r.amount_cents < currentCost ? 'less' : 'more'} per semester`}</span><button class="secondary-button sm-button" data-detail="${r.id}">View plan →</button></div></article>`).join('')}</div><section class="story"><a class="secondary-button" href="#simulator">Compare the whole budget in the Simulator →</a><p class="meta muted">Campus imagery is illustrative. Published rates do not guarantee availability or eligibility.</p></section>`;
}
function simulator() {
  return `<a class="back-link" href="#expenses">← Back to expenses</a><section class="story">${head('spark', 'Plan ahead for next semester', 'Explore your next chapter using today’s published rates. Your current semester stays unchanged.')}<form id="scenario-form"><div class="budget-grid">${['housing', 'meal'].map(kind => `<label class="field">${kind === 'housing' ? 'Housing alternative' : 'Meal alternative'}<select name="${kind}RateId"><option value="">Keep current posted charges</option>${plan.catalog.filter(r => r.kind === kind && r.period === 'term').map(r => `<option value="${esc(r.id)}">${esc(r.name)} · ${money(r.amount_cents)}</option>`).join('')}</select></label>`).join('')}${fields.map(([key, label]) => `<label class="field">${label} ($ / term)<input name="${key}" type="number" step="0.01" min="0" max="1000000" value="${draft[key] === undefined ? '' : draft[key] / 100}" placeholder="Not included"></label>`).join('')}</div><button class="primary-button" type="submit">Preview this scenario</button></form><div id="scenario-result" aria-live="polite">${scenario ? scenarioResult() : ''}</div>${ask('Help me compare financial planning options, keeping actual facts separate from assumptions.')}</section>`;
}
function scenarioResult() {
  return `<div class="kpis">${kpi('Estimated funding gap', money(scenario.estimatedFundingGapCents), 'After anticipated aid, living costs and expected resources')}${kpi('Catalog difference', money(scenario.catalogDifferenceCents), 'Compared with posted housing and meal charges')}${kpi('Living estimate', money(scenario.livingTotalCents), 'Hypothetical term spending')}${kpi('Expected resources', money(scenario.incomeTotalCents), 'Unverified assumptions')}</div>${table(['Alternative', 'Term rate', 'Current charge', 'Eligibility'], scenario.alternatives, r => [esc(r.name), money(r.amountCents), money(r.currentPostedChargeCents), esc(r.eligibility)])}<p class="meta muted">Preview only. Your account, awards, housing and saved budget have not changed.</p>`;
}
function render() {
  if (!plan) return;
  const route = location.hash.slice(1) || 'overview', tab = ['housing', 'meals', 'coverage', 'simulator'].includes(route) ? 'expenses' : route === 'timeline' ? 'payments' : route;
  const m = model();
  $('.flag').textContent = `University snapshot · ${date(plan.snapshotAt)}`;
  const contact={...plan.advisers?.[0],...plan.presentation?.financialAdviser},isPayment=tab==='payments',configured=plan.presentation?.contacts?.[isPayment?'support':'financialAid'];
  const name=isPayment?'Student Accounts':contact?.name||configured?.label||'Financial Aid team';
  const email=isPayment?configured?.email:contact?.email||configured?.email;
  const phone=contact?.phone||configured?.phone;
  const portrait=!isPayment?(safeExternalUrl(contact?.photo_url)||'assets/img/sample-adviser.jpg'):null;
  $('.advisor-bar').innerHTML=`${portrait?`<figure class="adviser-portrait"><img src="${esc(portrait)}" alt="${contact?.photo_url?'Your financial aid contact':'Illustrative adviser portrait'}">${!contact?.photo_url?'<figcaption>Sample photo</figcaption>':''}</figure>`:`<span class="contact-avatar">${ic('card')}</span>`}<div class="who"><strong>${esc(name)}</strong><span class="contact-title">${esc(isPayment?'Billing & payment support':contact?.title||'Financial Aid Counselor')} ${!isPayment&&!contact?.title?'<small>· example title</small>':''}</span><span class="contact-phone">${phone?`<a href="tel:${esc(phone.replace(/[^+0-9]/g,''))}">${esc(phone)}</a>`:'(202) 555-0142 · sample phone'}</span><div class="contact-links">${email?`<a href="mailto:${esc(email)}">${ic('mail')} Email</a>`:'<a href="/help" target="_top">Contact the office</a>'}<a href="/appointments?topic=${isPayment?'student_accounts':'financial_aid'}" target="_top">${ic('calendar')} Book a meeting</a></div></div>`;
  $('#sum-figure').previousElementSibling.textContent = `${paymentView!=='live'?'Actual university account':decisionPreviews.size?'Decision preview':m.gap<0?'Estimated credit':'Estimated remaining'} · ${plan.term?.name || plan.termId}`;
  $('#sum-figure').innerHTML = money(Math.abs(m.gap));
  $('#sum-copy').textContent = `${money(plan.account.postedBalanceCents)} posted balance, less ${money(plan.aid.anticipatedTermCents)} in aid expected to arrive. ${decisionPreviews.size?'Decision preview is active; your university record has not changed.':'Unaccepted offers are not counted.'}`;
  const next = m.open.find(r=>!r.source.includes('loan')) || m.open[0];
  $('#band').innerHTML = `<span class="lead">${ic('spark')}<span><strong>${next?`Your next step: review ${next.source.includes('loan')?'your loan offer':'your gift aid'}`:m.gap>0?'Your next step: plan your remaining payment':'You’re ready for what’s next'}</strong><small>${next?`${esc(next.name)} · ${money(next.offered_cents-next.accepted_cents)} available to review`:m.gap>0?'Choose a one-time payment or a plan that fits your budget.':'Review your financial details whenever you need them.'}</small></span></span>${next?`<button type="button" class="action-band-action" data-detail="${esc(next.award_id)}">Review offer →</button>`:'<a class="action-band-action" href="#payments">View payments →</a>'}`;
  $('#tab-root').innerHTML = previewBanner()+({ overview, aid, payments, expenses, timeline: payments, housing: () => catalog('housing'), meals: () => catalog('meal'), coverage: expenses, simulator }[route] || overview)();
}
async function load() {
  try { plan = await request('read'); draft = { ...plan.planning.inputs }; livingOffCampus = ['off_campus','family','commuting'].includes(plan.presentation?.housingPreference)||(draft.rentCents || 0)>0; render(); }
  catch (e) { $('#tab-root').innerHTML = `<section class="story" role="alert"><h2>Your financial plan is unavailable</h2><p>${esc(e.message)}</p><button class="secondary-button" id="retry">Retry</button></section>`; }
}
$('#sidebar-slot').remove(); $('#topbar-slot').remove(); $('#motif-icon').innerHTML = ic('wallet');
$('#tab-root').innerHTML = '<section class="story" role="status">Loading your financial plan…</section>';
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
document.addEventListener('click', e => {
  const target = e.target.closest('[data-ask],[data-detail],[data-close],[data-optional],#retry');
  if (!target) return;
  if (target.dataset.ask) askEdward(target.dataset.ask);
  if (target.dataset.detail) detail(target.dataset.detail);
  if ('close' in target.dataset) $('#pop').close();
  if ('optional' in target.dataset) { const [name, provider, price] = optionalCoverage[Number(target.dataset.optional)]; pop(name, `<p><b>${provider} · ${price}</b></p><p>This is an illustrative optional product, not coverage on your university account. No enrollment or charge is created here. Confirm pricing, eligibility and benefits with the provider before purchasing.</p>`); }
  if (target.id === 'retry') void load();
});
document.addEventListener('keydown', e => { if (e.target.matches('path[data-detail]') && ['Enter', ' '].includes(e.key)) { e.preventDefault(); detail(e.target.dataset.detail); } });
document.addEventListener('input', e => {
  const key = e.target.dataset.budget;
  if (key) { const factor = unitFactor(budgetUnits[key] || 'term'); if (e.target.value === '') delete draft[key]; else draft[key] = Math.round(Number(e.target.value) * factor * 100); $('#budget-status').textContent = 'Unsaved changes · Save term estimates to update your plan and Edward.'; refreshBudget(); }
  if (e.target.id === 'split-now') { const a = plan.paymentAgreements[0]; $('#split-result').textContent = splitCopy(Math.min(model().gap, Math.max(0, Math.round(Number(e.target.value) * 100))), plan.installments.length || 4, a?.fee_cents || 0); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'aid-period') { aidYear = e.target.value === 'year'; render(); }
});
document.addEventListener('submit', async e => {
  if (e.target.id === 'scenario-form') {
    e.preventDefault(); const f = new FormData(e.target), inputs = {};
    for (const [key] of fields) { const value = f.get(key); if (value !== '') inputs[key] = Math.round(Number(value) * 100); }
    try { scenario = await request('simulate', { termId: plan.termId, inputs, housingRateId: f.get('housingRateId'), mealRateId: f.get('mealRateId') }); $('#scenario-result').innerHTML = scenarioResult(); }
    catch (cause) { $('#scenario-result').innerHTML = `<p role="alert">${esc(cause.message)}</p>`; } return;
  }
  if (e.target.id !== 'budget-form') return;
  e.preventDefault(); if (saving) return; saving = true; error = ''; render();
  try { await request('save-inputs', { termId: plan.termId, expectedVersion: plan.planning.version, inputs: {...draft,employmentIncomeCents:sum(plan.aid.termAwards.filter(r=>!r.posts_to_account),'accepted_cents')} }); plan = await request('read'); draft = { ...plan.planning.inputs }; error = 'Your term estimates are saved.'; }
  catch (cause) { error = cause.message; }
  finally { saving = false; render(); }
});

// UI-only decision/payment previews are intentionally separate from the canonical plan.
// They never call a write API or claim to have posted money or accepted an award.
const decisionPreviews = new Map();
let expiredOffersPreview=false, paymentView="live", paymentMethodPreview="Bank transfer / ACH";
let livingOffCampus = false;
const budgetUnits = {booksCents:'term',transportCents:'month',personalCents:'month',rentCents:'month',groceriesCents:'month',familyContributionCents:'month',employmentIncomeCents:'term',otherIncomeCents:'month'};
const budgetHelp = {booksCents:'Books, materials and course supplies',transportCents:'Transit, fuel and trips home',personalCents:'Phone, internet and everyday essentials',rentCents:'Enter zero if you live rent-free',savingsCents:'Money you already have set aside',familyContributionCents:'Regular support from family',employmentIncomeCents:'From your accepted work-study offer · earned through work',otherIncomeCents:'Income from a job outside work-study'};
function termLength(){return StudentFinancialPresentation.termLength(plan);}
function unitFactor(unit) {const length=termLength();return unit==='month'?length.months:unit==='week'?length.weeks:unit==='day'?length.days:1;}
function unitLabel(unit) { return unit==='month'?'per month':unit==='week'?'per week':unit==='day'?'per day':'per semester'; }
function chargeLabel(label) {
  if (/unlimited meals/i.test(label)) return 'Meal plan · Campus dining';
  return label.replace(/\s*[—–-]\s*Fall semester/gi,'').replace('credited to tuition','applied to your bill').replace('Health insurance · annual premium billed in fall','Health insurance · Annual coverage');
}
function chargeExplanation(label) {
  if(/tuition/i.test(label))return 'Your posted tuition charge reflects your university’s enrollment and program rates. Any per-credit adjustments are recorded by Student Accounts.';
  if(/housing|room/i.test(label))return 'Your university housing charge for the assigned room and semester. Room changes require approval from Residential Life.';
  if(/meal/i.test(label))return 'The campus dining plan recorded for this semester. Check plan eligibility and included meals before requesting a change.';
  if(/insurance/i.test(label))return 'Your university health plan premium. The annual premium is billed in this semester; a waiver requires university approval.';
  return 'A required university charge posted to your student account. Student Accounts can explain the policy and any applicable adjustments.';
}
function decisionButtons(award) {
  return `<div class="decision-buttons"><button class="primary-button sm-button" data-decision="accept" data-award="${esc(award.award_id)}">${award.source.includes('loan')?'Choose amount':'Accept'}</button><button class="secondary-button sm-button" data-decision="decline" data-award="${esc(award.award_id)}">Decline</button></div>`;
}
function decisionDialog(id,choice) {
  const award=model().terms.find(r=>r.award_id===id);if(!award)return;
  const loan=award.source.includes('loan');
  pop(`${choice==='accept'?'Review acceptance':'Decline offer'} · ${award.name}`,`<div class="detail-note preview-note">Interactive preview · no award changes will be submitted.</div><div class="detail-total"><span>Offered this semester</span><strong>${money(award.offered_cents)}</strong></div><form id="decision-preview" data-award="${esc(id)}" data-choice="${choice}">${choice==='accept'&&loan?`<label class="field">How much would you like to accept?<span class="currency-field">$ <input name="amount" aria-label="Loan acceptance amount" type="number" min="0.01" max="${award.offered_cents/100}" step="0.01" value="${award.offered_cents/100}" required></span><small>Choose any amount up to ${money(award.offered_cents)}. You can borrow less than the full offer.</small></label>`:`<p>${choice==='accept'?'This preview shows your full offered amount as accepted.':'This preview shows this offer as declined. You can revisit it without changing your university record.'}</p>`}<button class="primary-button" type="submit">Preview ${choice==='accept'?'acceptance':'decline'} →</button></form>`);
}
function paymentDialog(kind) {
  const m=model(),{agreement,rows:installments,events:scheduleEvents}=paymentSchedule();
  pop(kind==='refund'?'Choose how to receive your refund':kind==='plan'?'A payment plan that fits':'Review your payment',`<div class="detail-note preview-note">Interactive preview · no money moves and no agreement is signed.</div><div class="detail-total"><span>${kind==='refund'?'Estimated credit':'Estimated amount to cover'}</span><strong>${money(kind==='refund'&&paymentView==='credit'?125000:Math.abs(m.gap))}</strong></div><form id="payment-preview" data-kind="${kind}">${kind==='plan'?`${nextList(scheduleEvents)}<p>${installments.length||4} installments${agreement?` plus a ${money(agreement.fee_cents)} setup fee`:''}. Review final dates and terms with Student Accounts.</p><label class="preview-consent"><input type="checkbox" required> I have reviewed this illustrative schedule.</label>`:`<label class="field">${kind==='refund'?'Receive by':'Payment method'}<select name="method"><option>Bank transfer / ACH</option><option>${kind==='refund'?'Mailed check':'Debit or credit card'}</option></select></label><p>Account details are collected only in the university’s secure payment service.</p>`}<button class="primary-button" type="submit">Preview ${kind==='refund'?'refund setup':kind==='plan'?'plan confirmation':'payment confirmation'} →</button></form>`);
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-decision],[data-payment]');if(!button)return;
  if(button.dataset.decision)decisionDialog(button.dataset.award,button.dataset.decision);
  if(button.dataset.payment)paymentDialog(button.dataset.payment);
});
document.addEventListener('submit',event=>{
  const form=event.target;
  if(form.id==='decision-preview') {
    event.preventDefault();const award=model().terms.find(r=>r.award_id===form.dataset.award);if(!award)return;
    const amount=form.dataset.choice==='decline'?0:Math.round(Number(new FormData(form).get('amount')||award.offered_cents/100)*100);
    if(amount<0||amount>award.offered_cents||!Number.isFinite(amount))return;
    decisionPreviews.set(award.award_id,{status:form.dataset.choice==='accept'?'Accepted':'Declined',amount});render();
    pop('Your decision preview',`<div class="preview-success">${ic('check')}<h3>${form.dataset.choice==='accept'?`${money(amount)} selected`:'Offer declined in preview'}</h3><p>${esc(award.name)}</p></div><p>This is how your decision will look. Your university award and account balance have not changed.</p><button class="secondary-button" data-close>Back to my offers</button>`);
  }
  if(form.id==='payment-preview') {event.preventDefault();paymentMethodPreview=new FormData(form).get('method')||'Installment plan';paymentView=form.dataset.kind==='refund'?'refund_pending':form.dataset.kind==='plan'?'plan':'paid';render();pop('Preview complete',`<div class="preview-success">${ic('check')}<h3>${form.dataset.kind==='refund'?'Refund preference ready':form.dataset.kind==='plan'?'Your plan is ready to review':'Your payment is ready to review'}</h3><p>No payment was processed and no account details were collected.</p></div><p>In the connected experience, Student Accounts confirms the next step securely.</p>`);}
});
document.addEventListener('change',event=>{
  const key=event.target.dataset.budgetUnit;
  if(key){budgetUnits[key]=event.target.value;render();}
  if(event.target.id==='payment-state-preview'){paymentView=event.target.value;render();}
  if(event.target.id==='living-housing'){livingOffCampus=event.target.value==='off';if(livingOffCampus&&draft.rentCents===undefined)draft.rentCents=0;if(!livingOffCampus)delete draft.rentCents;render();}
});
function highlightComparison(root, key) {
  if (!root) return;
  const items = [...root.querySelectorAll('[data-ring-key]')];
  root.classList.toggle('is-exploring', items.some(item => item.matches('path') && item.dataset.ringKey === key));
  items.forEach(item => item.classList.toggle('is-highlighted', item.dataset.ringKey === key));
}
function comparisonItem(target, root) {
  const item = target instanceof Element ? target.closest('[data-ring-key]') : null;
  return item && root.contains(item) ? item : null;
}
for (const [enter, leave] of [['pointerover', 'pointerout'], ['focusin', 'focusout']]) {
  document.addEventListener(enter, event => {
    const item = event.target.closest('[data-ring-key]');
    if (item) highlightComparison(item.closest('.comparison-ring'), item.dataset.ringKey);
  });
  document.addEventListener(leave, event => {
    const item = event.target.closest('[data-ring-key]'), root = item?.closest('.comparison-ring');
    if (!root) return;
    const next = comparisonItem(event.relatedTarget, root)
      || (leave === 'pointerout' ? comparisonItem(document.activeElement, root) : root.querySelector('[data-ring-key]:hover'));
    highlightComparison(root, next?.dataset.ringKey);
  });
}
$('#pop').addEventListener('close',()=>{if(dialogReturnFocus&&!dialogReturnFocus.isConnected)document.querySelector('.scenario-banner button, #band .action-band-action')?.focus();});
$('#pop').addEventListener('click',event=>{if(event.target===$('#pop')){const r=$('#pop').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('#pop').close();}});

function safeExternalUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
function previewBanner(){return decisionPreviews.size||expiredOffersPreview||paymentView!=='live'?`<div class="scenario-banner" role="status"><span>${ic('spark')} <strong>Exploring a scenario</strong> · your university record is unchanged.</span><button type="button" data-reset-preview>Back to my actual plan</button></div>`:'';}
function disbursementList(offer){
  const rows=plan.aid.disbursements.filter(d=>d.award_id===offer.award_id).sort((a,b)=>(a.scheduled_at||'').localeCompare(b.scheduled_at||''));
  if(rows.length)return `<div class="detail-breakdown">${rows.map(row=>`<div><span>${row.status==='posted'?'Posted':row.status==='held'?'Held · review requirements':'Scheduled'}<small>${date(row.posted_at||row.scheduled_at)}</small></span><strong>${money(row.amount_cents)}</strong></div>`).join('')}</div>`;
  if(offer.uiPreview&&offer.accepted_cents>0){const day=new Date(plan.snapshotAt);day.setUTCDate(day.getUTCDate()+14);return `<div class="detail-note">Sample disbursement · ${date(day.toISOString())} · ${money(offer.accepted_cents)}<br>Your university confirms the actual date after acceptance.</div>`;}
  return '<p>The university has not published a disbursement date for this offer yet.</p>';
}
function chargeDetails(item){
 const rate=StudentFinancialPresentation.rateFor(plan,item),meta=StudentFinancialPresentation.metadata(rate);
 if(/tuition/i.test(item.label))return `<h3>A clearer picture of your tuition</h3><div class="detail-note">Illustrative enrollment: 15 credits · full-time. Your posted charge above is real; the credit-load rules below are a sample until supplied by your university.</div><div class="detail-breakdown"><div><span>Full-time band<small>12–18 credits · flat semester rate</small></span><strong>${money(item.amountCents)}</strong></div><div><span>Part-time / overload example<small>Sample price per credit</small></span><strong>${money(Math.round(item.amountCents/15))}</strong></div></div><label class="field">Explore a credit load <input aria-label="Example credit load" data-tuition-credits data-tuition-base="${item.amountCents}" type="range" min="1" max="24" value="15"></label><div class="tuition-example-result"><span id="tuition-example-rule">15 credits · full-time flat rate</span><strong id="tuition-example-amount">${money(item.amountCents)}</strong></div><p>Below 12 credits: credits × sample rate. Above 18: flat rate + extra credits × sample rate. Registration and your account do not change.</p>`;
 return `<h3>What this covers</h3><div class="detail-breakdown"><div><span>${esc(rate?.name||item.label)}<small>1 ${rate?.period==='year'?'annual':'semester'} charge × ${money(item.amountCents)}</small></span><strong>${money(item.amountCents)}</strong></div>${meta.roomType?`<div><span>Room type</span><strong>${esc(meta.roomType)}</strong></div>`:''}${meta.style?`<div><span>Residence</span><strong>${esc(meta.style)} hall</strong></div>`:''}${meta.swipes?`<div><span>Meal allowance</span><strong>${esc(meta.swipes)}</strong></div>`:''}${meta.diningDollarsCents?`<div><span>Dining dollars</span><strong>${money(meta.diningDollarsCents)}</strong></div>`:''}</div><p>${esc(rate?.eligibility||chargeExplanation(item.label))}</p>${rate?.policy_id?`<p class="meta muted">University policy · ${esc(rate.policy_id)}</p>`:''}`;
}
document.addEventListener('input',event=>{if(!event.target.matches('[data-tuition-credits]'))return;const credits=Number(event.target.value),base=Number(event.target.dataset.tuitionBase),rate=Math.round(base/15),amount=credits<12?credits*rate:base+Math.max(0,credits-18)*rate;$('#tuition-example-rule').textContent=`${credits} credits · ${credits<12?'part-time':credits>18?'full-time + overload':'full-time flat rate'}`;$('#tuition-example-amount').textContent=money(amount);});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-offer-scenario],[data-reset-preview],[data-reset-award]');if(!button)return;
 if(button.dataset.offerScenario){decisionPreviews.clear();expiredOffersPreview=button.dataset.offerScenario==='expired';if(!expiredOffersPreview)for(const r of plan.aid.termAwards.filter(r=>r.status==='offered'))decisionPreviews.set(r.award_id,{status:'Accepted',amount:r.offered_cents});}
 if('resetPreview' in button.dataset){decisionPreviews.clear();expiredOffersPreview=false;paymentView='live';}
 if(button.dataset.resetAward)decisionPreviews.delete(button.dataset.resetAward);
 $('#pop').close();render();
});

void load();
