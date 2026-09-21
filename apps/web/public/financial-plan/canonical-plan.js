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
let plan = null, draft = {}, saving = false, error = '', scenario = null, period = 'term', aidYear = false;
const tabs = [['overview', 'Overview', 'gauge'], ['payments', 'Payments', 'card'], ['expenses', 'Expenses', 'receipt'], ['aid', 'Loans & aid', 'award']];
const colors = ['#312960', '#3d3577', '#4a4190', '#574da8', '#6459bf', '#7a70cc'];
const fields = [
  ['booksCents', 'Books & supplies'], ['transportCents', 'Transportation'], ['personalCents', 'Personal & phone'],
  ['rentCents', 'Rent & utilities'], ['groceriesCents', 'Groceries'], ['otherExpensesCents', 'Other living expenses'],
  ['savingsCents', 'Savings on hand'], ['familyContributionCents', 'Family allowance'],
  ['employmentIncomeCents', 'Expected campus earnings'], ['otherIncomeCents', 'Other income'],
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
const ask = question => `<button class="edward-ask" type="button" data-ask="${esc(question)}"><span class="edward-ask-mark">E</span>Ask Edward</button>`;
const badge = (text, tone = 'quiet') => `<span class="status-pill sm ${tone}">${esc(text.replaceAll('_', ' '))}</span>`;
const head = (icon, title, copy, tools = '') => `<div class="story-head"><span class="card-icon">${ic(icon)}</span><div class="grow"><h2>${esc(title)}</h2><p>${esc(copy)}</p></div><div class="tools">${tools}</div></div>`;
const kpi = (label, value, copy, tone = '', detail = '') => `<div class="kpi2"><span class="lbl">${esc(label)}</span><strong class="${tone}">${value}</strong><p>${esc(copy)}</p>${detail ? `<button class="text-button" data-detail="${esc(detail)}">View breakdown →</button>` : ''}</div>`;
function table(headers, items, render, cls = 'aid-table') {
  return `<div class="table-scroll"><table class="${cls}"><thead><tr>${headers.map(x => `<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${items.map(x => `<tr>${render(x).map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function model() {
  const terms = plan.aid.termAwards || [];
  const gift = terms.filter(r => r.posts_to_account && !r.source.includes('loan'));
  const loans = terms.filter(r => r.source.includes('loan'));
  const open = terms.filter(r => r.offered_cents > r.accepted_cents && r.status !== 'declined' && r.posts_to_account);
  const gap = plan.planning.estimatedAccountGapAfterAnticipatedAidCents;
  const charges = plan.visualization.charges.map(r => ({ ...r, sub: 'Posted university charge' }));
  const sources = (plan.visualization.netPostedSources || plan.visualization.postedSources).filter(r => r.amountCents > 0).map(r => {
    const ledger = plan.ledger.find(x => x.id === r.id);
    const disb = plan.aid.disbursements.find(x => x.id === ledger?.disbursement_id);
    const loan = terms.find(x => x.award_id === disb?.award_id)?.source.includes('loan');
    return { ...r, color: ledger?.kind === 'payment' ? '#b9791e' : loan ? '#2a63a9' : '#6854d9', sub: ledger?.kind === 'payment' ? 'Payment received' : 'Aid posted to your account' };
  });
  for (const r of plan.aid.disbursements.filter(r => ['scheduled', 'held'].includes(r.status))) {
    sources.push({ id: r.id, label: r.name, amountCents: r.amount_cents, color: terms.find(x => x.award_id === r.award_id)?.source.includes('loan') ? '#2a63a9' : '#9089d6', sub: `${r.status === 'held' ? 'Held' : 'Scheduled'} · ${date(r.scheduled_at)} · not posted` });
  }
  if (gap) sources.push({ id: 'gap', label: 'Still to cover', amountCents: gap, color: '#e6c891', sub: 'After anticipated aid · estimate' });
  const values = key => draft[key] ?? 0;
  const living = fields.slice(0, 6).filter(([key]) => key in draft).map(([id, label]) => ({ id, label, amountCents: values(id), sub: 'Your spending estimate' }));
  const income = fields.slice(6).filter(([key]) => key in draft).map(([id, label], i) => ({ id, label, amountCents: values(id), color: ['#b9791e', '#d9a94c', '#1a9e8f', '#63c2b6'][i], sub: 'Expected resource · not a payment' }));
  const livingTotal = sum(living, 'amountCents'), incomeTotal = sum(income, 'amountCents');
  return { terms, gift, loans, open, gap, charges, sources, living, income, livingTotal, incomeTotal, cushion: incomeTotal - livingTotal };
}
function pop(title, body) {
  const dialog = $('#pop');
  dialog.innerHTML = `<div class="pop-head"><span class="tile">${ic('info')}</span><div><h2>${esc(title)}</h2><p>${esc(plan.term?.name || plan.termId)} · Your financial plan</p></div></div><div class="pop-body">${body}</div><div class="pop-foot"><button class="ghost-button" data-close>Close</button></div>`;
  dialog.showModal();
}
function detail(key) {
  const m = model(), a = plan.account;
  const breakdown = items => table(['Item', 'Amount'], items, r => [esc(r.label), money(r.amountCents)]);
  const descriptions = {
    charges: ['University expenses', `<p>Posted charges total ${money(a.postedChargesCents)}. Your full term attendance estimate includes ${money(plan.planning.livingTotalCents)} of living costs, for ${money(plan.planning.totalAttendanceEstimateCents)} altogether.</p>${breakdown(m.charges)}`],
    gap: ['Uncovered balance', `<p>${money(a.postedChargesCents)} charges − ${money(a.postedAidCents)} posted aid − ${money(a.postedPaymentCreditsCents)} payments ${a.adjustmentsCents ? `+ ${money(a.adjustmentsCents)} adjustments` : ''} = <b>${money(a.postedBalanceCents)} posted balance.</b></p><p>After ${money(plan.aid.anticipatedTermCents)} of scheduled or held aid, the estimated remaining balance is <b>${money(m.gap)}</b>. Unaccepted offers, employment earnings and your living budget do not reduce your bill.</p>`],
    gifts: ['Scholarships & grants', awardTable(m.gift)],
    loans: ['Student loans', awardTable(m.loans)],
    living: ['Living expenses', `<p>Personal estimates, paid separately from your university bill.</p>${breakdown(m.living)}`],
    income: ['Money set aside', `<p>Expected savings, family support and earnings. These have not been paid to the university.</p>${breakdown(m.income)}`],
    cushion: ['Your living cushion', `<p>${money(m.incomeTotal)} expected resources − ${money(m.livingTotal)} living expenses = <b>${money(m.cushion)}</b>. This cushion is separate from the ${money(m.gap)} university funding gap.</p>`],
    attendance: ['Full attendance estimate', `<p>${money(a.postedChargesCents)} university charges + ${money(m.livingTotal)} personal living estimates = <b>${money(a.postedChargesCents + m.livingTotal)}</b> for the term.</p>`],
  };
  if (descriptions[key]) return pop(...descriptions[key]);
  const item = [...m.charges, ...m.sources, ...m.living, ...m.income].find(r => r.id === key);
  if (item) return pop(item.label, `<p><b>${money(item.amountCents)}</b> · ${esc(item.sub)}</p>${ask(`Explain ${item.label} on my financial plan, including its status and how it relates to my balance.`)}`);
  const award = m.terms.find(r => r.award_id === key);
  if (award) return pop(award.name, `<p>${esc(award.note)}</p>${awardTable([award])}<p>${award.decision_due_at ? `Decision due ${date(award.decision_due_at)}.` : 'Check the disbursement schedule for when this award reaches your account.'}</p>${ask(`Explain my ${award.name}, its eligibility, deadline, acceptance and disbursement status.`)}`);
  const rate = plan.catalog.find(r => r.id === key);
  if (rate) return pop(rate.name, `<p><b>${money(rate.amount_cents)} / ${esc(rate.period)}</b></p><p>${esc(rate.eligibility)}</p><p>Effective ${date(rate.effective_from)}–${date(rate.effective_until)}. ${esc(rate.metadata_json === '{}' ? '' : Object.entries(JSON.parse(rate.metadata_json)).map(([k, v]) => `${k}: ${v}`).join(' · '))}</p><p>Compare costs in the Simulator. An estimate does not change your enrollment or room assignment.</p>${ask(`What should I know about ${rate.name} and its cost?`)}`);
}
function arc(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0), big = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0},${y0} A${r1},${r1} 0 ${big} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${big} 0 ${x3},${y3} Z`;
}
function comparison(living = false) {
  const m = model(), factor = living && period === 'month' ? 4.5 : 1;
  const costs = living ? m.living : m.charges, sources = living ? m.income : m.sources;
  const total = sum(costs, 'amountCents'), funding = sum(sources, 'amountCents');
  const arcs = (items, r0, r1, kind, denominator) => {
    let start = -Math.PI / 2;
    return items.filter(r => r.amountCents > 0).map((r, i) => {
      const end = start + r.amountCents / denominator * Math.PI * 2;
      const path = `<path class="arc" tabindex="0" role="button" aria-label="${esc(r.label)}: ${money(r.amountCents / factor)}. View details" data-detail="${esc(r.id)}" d="${arc(125, 125, r0, r1, start, end - .009)}" fill="${kind === 'cost' ? colors[i % colors.length] : r.color}"><title>${esc(r.label)}: ${money(r.amountCents / factor)}</title></path>`;
      start = end; return path;
    }).join('');
  };
  const rows = (items, cost) => `<ul class="src-list">${items.map((r, i) => `<li><button class="src-row" data-detail="${esc(r.id)}"><i style="background:${cost ? colors[i % colors.length] : r.color}"></i><span class="n">${esc(r.label)}<small>${esc(r.sub)}</small></span><span class="a">${money(r.amountCents / factor)}<small>Details ↗</small></span></button></li>`).join('')}</ul>`;
  const editor = items => items.map((r, i) => `<div class="living-expense-entry"><label class="income-name" for="budget-${r.id}"><i style="background:${r.color || colors[i % colors.length]}"></i><span>${esc(r.label)}</span></label><span class="money-input"><span aria-hidden="true">$</span><input id="budget-${r.id}" data-budget="${r.id}" type="number" min="0" max="1000000" step="0.01" value="${Math.round(r.amountCents / factor) / 100}" aria-label="${esc(r.label)} amount"></span></div>`).join('');
  const center = living ? money(total / factor) : `${total ? Math.round((total - m.gap) / total * 100) : 0}%`;
  const sub = living ? period === 'month' ? 'Average monthly spending' : 'Semester spending' : `of ${money(total)} covered`;
  const note = living ? `${money(Math.abs(m.cushion) / factor)} ${m.cushion >= 0 ? 'left over' : 'short'}` : `${money(m.gap)} to plan`;
  return `<div class="ring-grid comparison-ring"><div class="chart-wrap"><svg class="ring" viewBox="0 0 250 250" aria-label="${living ? 'Living budget' : 'University expenses'} and funding comparison">${arcs(costs, 92, 118, 'cost', total)}${arcs(sources, 64, 88, 'source', funding)}<text x="125" y="118" text-anchor="middle" font-size="${center.length > 8 ? 20 : 24}" font-weight="700" fill="#152037">${center}</text><text x="125" y="135" text-anchor="middle" font-size="10" fill="#687086">${sub}</text><text x="125" y="150" text-anchor="middle" font-size="10" fill="#a65d19">${note}</text></svg><p class="meta muted">Explore any segment or line item.<br>Expenses and funding are separate totals.</p></div><div class="legend-pair"><div><div class="legend-title"><h3>${living ? 'Living expenses' : 'University expenses'}</h3><b>${money(total / factor)}</b></div>${living ? editor(costs) : rows(costs, true)}</div><div><div class="legend-title"><h3>${living ? 'Money for living' : 'How it’s covered'}</h3><b>${money(funding / factor)}</b></div>${living ? editor(sources) : rows(sources, false)}</div></div></div>`;
}
function budgetDirty() {
  return fields.some(([key]) => draft[key] !== plan.planning.inputs[key]);
}
function refreshBudget() {
  const section = $('#budget-form')?.closest('section');
  if (!section) return;
  const m = model(), factor = period === 'month' ? 4.5 : 1;
  const values = [m.livingTotal, m.incomeTotal, m.cushion, plan.account.postedChargesCents + m.livingTotal];
  section.querySelectorAll('.kpi2>strong').forEach((el, i) => { el.textContent = money(values[i]); });
  const fragment = document.createElement('div'); fragment.innerHTML = comparison(true);
  section.querySelector('svg.ring').replaceWith(fragment.querySelector('svg.ring'));
  section.querySelectorAll('.legend-title>b').forEach((el, i) => { el.textContent = money((i ? m.incomeTotal : m.livingTotal) / factor); });
}
function budget() {
  const m = model();
  return `<section class="story">${head('wallet', 'Cost of living · Your everyday expenses', 'Books, getting around, your phone, your life. These are your estimates, separate from the university bill. Savings, family support and earnings are planned resources.')}
    <div class="kpis">${kpi('Cost of living · term', money(m.livingTotal), 'Your estimate for the semester', '', 'living')}${kpi('Money set aside', money(m.incomeTotal), 'Savings, family help and expected earnings', '', 'income')}${kpi('Left over this term', money(m.cushion), 'Your cushion after the estimate', m.cushion >= 0 ? 'good' : 'warn', 'cushion')}${kpi('Full attendance estimate', money(plan.account.postedChargesCents + m.livingTotal), 'University bill plus personal living costs', '', 'attendance')}</div>
    <div class="period-control"><label for="living-period">View living budget</label><select id="living-period"><option value="term" ${period === 'term' ? 'selected' : ''}>Per semester</option><option value="month" ${period === 'month' ? 'selected' : ''}>Monthly average</option></select><span class="meta muted">Monthly view spreads the term across 4.5 months.</span></div>
    <form id="budget-form">${comparison(true)}<div class="cta-row"><button type="submit" class="primary-button" ${saving ? 'disabled' : ''}>${saving ? 'Saving…' : 'Save term estimates'}</button><span class="meta muted" id="budget-status">${error ? esc(error) : budgetDirty() ? 'Unsaved changes · Save term estimates to update your plan.' : 'Saved estimates are available to Edward. Changes here do not pay your bill.'}</span></div></form>
    <div class="divider"></div><div class="cta-row"><a class="secondary-button" href="#simulator">Try bigger changes in the Simulator →</a><span class="meta muted">Housing, meals and your personal budget.</span></div></section>`;
}
function opportunities() {
  const gift = model().open.find(r => !r.source.includes('loan'));
  if (!gift) return '';
  const amount = gift.offered_cents - gift.accepted_cents;
  return `<div class="notice working mt-3">${ic('spark', 'notice-mark')}<span class="notice-copy"><strong>A next step worth reviewing</strong>${esc(gift.name)} offers ${money(amount)} more this term. If accepted and disbursed, your estimated gap could fall to ${money(Math.max(0, model().gap - amount))}.</span><a class="notice-action" href="#aid">Review offer →</a></div>`;
}
function events() {
  const aid = plan.aid.disbursements.filter(r => ['scheduled', 'held'].includes(r.status)).map(r => ({ at: r.scheduled_at, title: r.name, note: `${r.status} · not posted`, amount: -r.amount_cents, status: r.status }));
  const installments = plan.installments.map(r => ({ at: r.due_at, title: 'Payment plan installment', note: `${plan.paymentAgreements.find(a => a.id === r.agreement_id)?.status || 'proposed'} plan · principal only`, amount: -r.amount_cents, status: 'proposed' }));
  const decisions = model().open.filter(r => r.decision_due_at).map(r => ({ at: r.decision_due_at, title: `${r.name} decision`, note: `${money(r.offered_cents - r.accepted_cents)} offered for this term`, amount: null, status: 'decision' }));
  return [...aid, ...installments, ...decisions].sort((a, b) => a.at.localeCompare(b.at));
}
function nextList(items) {
  return `<ul class="next-list">${items.map(r => `<li><span class="d">${new Date(r.at).toLocaleDateString('en-US', { month: 'short', timeZone: 'America/New_York' })}<b>${new Date(r.at).toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/New_York' })}</b></span><span class="t">${esc(r.title)}<small>${esc(r.note)}</small></span><span class="a">${r.amount == null ? '' : money(r.amount)}</span></li>`).join('')}</ul>`;
}
function overview() {
  const m = model(), a = plan.account;
  return `<div class="split overview-layout"><div><section class="story">${head('receipt', 'Cost of attendance · University expenses', 'Your committed charges, alongside the aid, loans and payments in your plan. Select any line item to understand the amount.')}
    <div class="kpis">${kpi('University cost of attendance', money(a.postedChargesCents), `Everything billed for ${plan.term?.name || plan.termId}`, '', 'charges')}${kpi('Uncovered balance', money(m.gap), 'After posted payments and anticipated aid', 'warn', 'gap')}${kpi('Scholarships & grants', `${money(plan.aid.termSummary.acceptedGiftCents)} <small>/ ${money(plan.aid.termSummary.offeredGiftCents)}</small>`, 'Term accepted / offered · No repayment', '', 'gifts')}${kpi('Student loans', `${money(plan.aid.termSummary.acceptedLoanCents)} <small>/ ${money(plan.aid.termSummary.offeredLoanCents)}</small>`, 'Term accepted / offered · Repayment required', '', 'loans')}</div>
    <div class="payment-summary"><span><b>Choose your out-of-pocket payment plan</b><small>${money(a.postedPaymentCreditsCents)} already received · ${money(a.postedBalanceCents)} posted balance · ${money(plan.aid.anticipatedTermCents)} aid still to arrive.</small></span><a class="secondary-button sm-button" href="#payments">Review payments →</a></div>${comparison()}${opportunities()}</section>${budget()}${coverage(true)}</div>
    <aside><section class="story">${head('spark', 'A little guidance goes a long way', 'Understand your next step with Edward.')}<div class="read"><p>Review your open gift aid before deciding how much to borrow. Scheduled aid will reduce your bill only after it posts.</p>${ask('Explain my financial picture and the best next steps, including my open grant and loan offers.')}</div></section>
    <section class="story">${head('checklist', 'Financial tasks', 'Decisions and checklist progress that affect your plan.')}<ul class="task-list">${m.open.map(r => `<li class="task available"><span class="m">${ic('arrow')}</span><span class="t">Review ${esc(r.name)}<small>${money(r.offered_cents - r.accepted_cents)} · ${r.source.includes('loan') ? 'Repayment required' : 'Gift aid, no repayment'} · ${date(r.decision_due_at)}</small></span><a class="go" href="#aid">Go →</a></li>`).join('')}<li class="task available"><span class="m">${ic('calendar')}</span><span class="t">Choose how to pay<small>${money(m.gap)} estimated remaining</small></span><a class="go" href="#payments">Go →</a></li>${plan.requirements.map(r => `<li class="task done"><span class="m">${ic('check')}</span><span class="t">${esc(r.title)}<small>${esc(r.meaning)}</small></span>${badge(r.status, r.status === 'completed' ? 'done' : 'wait')}</li>`).join('')}</ul></section>
    <section class="story">${head('calendar', 'Up next', 'The next money dates. The full calendar is in Payments.', '<a class="link-button" href="#timeline">All →</a>')}${nextList(events().filter(r => r.at >= plan.snapshotAt).slice(0, 5))}</section></aside></div>`;
}
function awardTable(items) {
  return table(['Award', aidYear ? 'Annual accepted / offered' : 'Term accepted / offered', 'Status', ''], items, r => {
    const annual = plan.aid.awards.find(a => a.id === r.award_id), shown = aidYear && annual ? annual : r;
    return [`<b>${esc(r.name)}</b><small>${esc(r.source.replaceAll('_', ' '))}${r.decision_due_at ? ` · Decide by ${date(r.decision_due_at)}` : ''}</small>`, `${shown.accepted_cents ? money(shown.accepted_cents) : 'Not accepted'} / ${money(shown.offered_cents)}${r.source.includes('loan') && r.accepted_cents ? `<small>${money(r.accepted_net_cents)} net this term after fee</small>` : ''}`, badge(r.status, r.status === 'accepted' ? 'done' : 'wait'), `<button class="text-button" data-detail="${esc(r.award_id)}">Award details →</button>`];
  });
}
function aid() {
  const m = model(), accepted = plan.aid.termSummary.acceptedNetCents;
  return `<div class="kpis">${kpi('Scholarships & grants', `${money(plan.aid.termSummary.acceptedGiftCents)} <small>/ ${money(plan.aid.termSummary.offeredGiftCents)}</small>`, 'Term accepted / offered · No repayment', '', 'gifts')}${kpi('Student loans', `${money(plan.aid.termSummary.acceptedLoanCents)} <small>/ ${money(plan.aid.termSummary.offeredLoanCents)}</small>`, 'Term accepted / offered · Gross principal', '', 'loans')}${kpi('University charges covered by aid', `${Math.round(accepted / plan.account.postedChargesCents * 100)}%`, `${money(accepted)} net accepted aid this term`)}${kpi('Pending decisions', String(m.open.length), `${money(plan.aid.termSummary.pendingDecisionCents)} awaiting your decision`)}</div>
    <section class="story">${head('award', 'Scholarships & grants · money you don’t pay back', 'Your actual awards and their term allocations. Offered aid does not reduce your posted balance.', '<label class="period-control">Award period<select id="aid-period"><option value="term">Per term</option><option value="year" ' + (aidYear ? 'selected' : '') + '>Full year</option></select></label>')}${awardTable(m.gift)}<p class="meta muted">To accept or decline an award, contact your Financial Aid Office.</p>${ask('How do I accept my offered grant, what is the deadline, and how would it change my balance?')}</section>
    <section class="story">${head('wallet', 'Loans · money you pay back, with interest', 'Review the principal, the amount that reaches your bill, and the terms before deciding.')}<div class="loan-primer"><div><b>Subsidized</b><p>Need-based borrowing. Interest treatment depends on enrollment and the loan terms.</p></div><div><b>Unsubsidized</b><p>Interest accrues while you study. You can discuss accepting less than the full offer.</p></div></div>${awardTable(m.loans)}${table(['Loan', 'Example interest rate', 'Origination fee', 'Repayment term'], plan.aid.loanTerms, r => [esc(m.loans.find(a => a.fund_id === r.fund_id)?.name || r.fund_id), `${r.interest_basis_points / 100}%`, `${r.fee_basis_points / 100}%`, `${r.term_months} months`])}<p class="meta muted">Rates above are stored synthetic demo terms. The accepted principal must be repaid; the fee is withheld from the disbursement.</p>${ask('Explain my loan principal, fee, net disbursement, interest rate and repayment term.')}</section>
    <section class="story">${head('wallet', 'Work-Study · money you earn', 'Campus employment is earned through a job and paid to you. It does not automatically credit your university bill.')}${awardTable(m.terms.filter(r => !r.posts_to_account))}<p>Expected earnings in your living budget: <b>${money(plan.planning.inputs.employmentIncomeCents || 0)}</b>. Authorization does not guarantee a job or wages.</p></section>
    <section class="story">${head('calendar', 'Disbursement schedule', 'Posted aid has reached the ledger. Scheduled and held aid has not.')} ${table(['Award', 'Net amount', 'State', 'Scheduled', 'Posted'], plan.aid.disbursements, r => [esc(r.name), money(r.amount_cents), badge(r.status, r.status === 'posted' ? 'done' : 'wait'), date(r.scheduled_at), r.posted_at ? date(r.posted_at) : 'Awaiting disbursement'])}</section>`;
}
function billingException() {
  return (plan.exceptions || []).filter(r=>r.status === 'approved' && r.starts_at <= plan.snapshotAt && r.ends_at > plan.snapshotAt).map(r=>`<div class="notice quiet"><span class="notice-copy"><strong>${esc(r.office_name)} · approved billing exception</strong>${esc(r.reason)}</span></div>`).join('');
}
function payments() {
  const a = plan.account, m = model(), agreement = plan.paymentAgreements.find(r => !['cancelled', 'completed'].includes(r.status));
  const installments = agreement ? plan.installments.filter(r => r.agreement_id === agreement.id) : [];
  return `<section class="story">${head('card', 'Your out-of-pocket payments', 'One equation. The posted bill, minus aid and payments already received, minus aid still expected.')}<div class="payment-equation">${kpi('University charges', money(a.postedChargesCents), 'Posted this term', '', 'charges')}<b>−</b>${kpi('Aid & payments posted', money(a.postedChargesCents - a.postedBalanceCents), 'Already credited to your account')}<b>−</b>${kpi('Anticipated aid', money(plan.aid.anticipatedTermCents), 'Scheduled or held · not yet received')}<b>=</b>${kpi('Estimated remaining', money(m.gap), 'Choose how to cover this amount', 'warn', 'gap')}</div>${opportunities()}${billingException()}</section>
    <section class="story">${head('wallet', 'Three ways to pay', 'Review a one-time payment, the proposed installment schedule, or a combination with Student Accounts.')}<div class="pay-options"><article class="pay-option"><h3>One-time payment</h3><strong class="option-amount">${money(m.gap)}</strong><p>Estimated amount after anticipated aid arrives.</p>${ask('How can I make a one-time payment and what amount should I pay?')}</article><article class="pay-option"><h3>${installments.length || 'Monthly'}-installment plan</h3><strong class="option-amount">${installments.length ? money(installments[0].amount_cents) : 'Review options'}${installments.length ? ` × ${installments.length}` : ''}</strong><p>${agreement ? `${money(agreement.fee_cents)} enrollment fee, separate from principal. ${agreement.status === 'proposed' ? 'Proposed · not yet enrolled.' : esc(agreement.status)}` : 'Contact Student Accounts for available plans.'}</p>${ask('Explain my proposed payment-plan installment amounts, dates and fee. Am I enrolled in this payment plan?')}</article><article class="pay-option"><h3>Some now, plan the rest</h3><label class="field">Amount now ($)<input id="split-now" type="number" min="0" max="${m.gap / 100}" step="0.01" value="${Math.min(1000, m.gap / 100)}"></label><p id="split-result">${splitCopy(Math.min(100000, m.gap), installments.length || 4, agreement?.fee_cents || 0)}</p>${ask('Can Student Accounts help me split my remaining balance between a payment now and installments?')}</article></div><p class="meta muted">Compare options here. Contact Student Accounts to arrange payment or sign an agreement; this page does not move money.</p></section>
    <div class="split"><section class="story">${head('receipt', 'Payment history', 'Received payments are already included in the posted balance.')} ${table(['Submitted', 'Method', 'Amount', 'Status', 'Received'], plan.payments, r => [date(r.submitted_at), esc(r.method.replaceAll('_', ' ')), money(r.amount_cents), badge(r.status, r.status === 'posted' ? 'done' : 'wait'), r.settled_at ? date(r.settled_at) : 'Not settled'])}</section><section class="story">${head('calendar', 'Proposed payment schedule', 'Principal installments; fee shown separately.')} ${nextList(events().filter(r => r.title === 'Payment plan installment'))}${agreement ? `<p class="meta muted">${money(sum(installments, 'amount_cents'))} principal + ${money(agreement.fee_cents)} fee = ${money(sum(installments, 'amount_cents') + agreement.fee_cents)} if you enroll. ${agreement.signed_at ? `Signed ${date(agreement.signed_at)}.` : 'No agreement has been signed.'}</p>` : ''}</section></div>${timeline()}`;
}
function splitCopy(now, count, fee) {
  const rest = Math.max(0, model().gap - now), first = Math.ceil(rest / count), last = rest - first * (count - 1);
  return `${money(now)} now, then ${count - 1} payments of ${money(first)} and one of ${money(last)}${fee ? `, plus a ${money(fee)} fee` : ''}. Preview only.`;
}
function timeline() {
  let balance = 0;
  const history = [...plan.ledger].sort((a, b) => a.posted_at.localeCompare(b.posted_at)).map(r => ({ ...r, balance: balance += r.amount_cents }));
  const max = Math.max(1, ...history.map(r => r.balance)), points = history.map((r, i) => `${35 + i / Math.max(1, history.length - 1) * 830},${175 - r.balance / max * 135}`).join(' ');
  return `<section class="story">${head('calendar', 'Your financial calendar', 'Actual account postings and upcoming dates. Proposed installments are plans, not payments.')}<div class="timeline-chart"><svg viewBox="0 0 900 220" role="img" aria-label="Posted balance history ending at ${money(plan.account.postedBalanceCents)}"><line x1="35" x2="865" y1="175" y2="175" stroke="#d9dbe6"/><polyline points="${points}" fill="none" stroke="#6854d9" stroke-width="3"/>${history.map((r, i) => `<circle cx="${35 + i / Math.max(1, history.length - 1) * 830}" cy="${175 - r.balance / max * 135}" r="4" fill="#6854d9"><title>${date(r.posted_at)} · ${esc(r.description)} · balance ${money(r.balance)}</title></circle>`).join('')}<text x="35" y="205" font-size="12">${history.length ? date(history[0].posted_at) : ''}</text><text x="865" y="205" text-anchor="end" font-size="12">Posted balance ${money(plan.account.postedBalanceCents)}</text><text x="35" y="22" font-size="12">Peak ${money(max)}</text></svg></div><h3>Upcoming · aid, decisions & proposed payments</h3>${table(['Date', 'What happens', 'Amount', 'Status'], events(), r => [date(r.at), `${esc(r.title)}<small>${esc(r.note)}</small>`, r.amount == null ? 'Decision only' : money(r.amount), badge(r.status)])}<h3>Completed · posted account history</h3>${table(['Date', 'What happened', 'Amount', 'Balance after'], history, r => [date(r.posted_at), esc(r.description), money(r.amount_cents), money(r.balance)])}</section>`;
}
const optionalCoverage = [
  ['Tuition & housing protection', 'GradGuard', '$298 / semester'],
  ['Renters insurance', 'GradGuard', '$12 / month'],
  ['Device protection', 'AKKO', '$15 / month'],
];
function coverage(compact = false) {
  return `<section class="story">${head('shield', compact ? 'My coverage · at a glance' : 'Coverage & protection', 'Your university insurance and optional ways to protect your life on campus.', compact ? '<a class="secondary-button sm-button" href="#coverage">View coverage →</a>' : '')}<div class="cov-mini">${plan.insuranceCoverage.map(r => {
    const rate = plan.catalog.find(c => c.id === r.catalog_id);
    return `<div class="cov-mini-row"><span class="tile sm">${ic('health')}</span><span>Health plan<small>${esc(rate?.name || r.catalog_id)} · ${money(rate?.amount_cents)} / ${esc(rate?.period || 'year')}</small></span><button class="text-button" data-detail="${esc(r.catalog_id)}">${badge(r.status, 'purple')}</button></div>`;
  }).join('')}${optionalCoverage.map(([name, provider, amount], i) => `<div class="cov-mini-row"><span class="tile sm">${ic('shield')}</span><span>${name}<small>${provider} · ${compact ? 'Not added · optional' : `${amount} · illustrative option`}</small></span><button class="text-button" data-optional="${i}">${badge('Off')}</button></div>`).join('')}</div>${compact ? '' : `<p class="meta muted">Optional products and prices are illustrative previews, not purchased coverage. University coverage and its rate above come from your account.</p>${ask('What health insurance is on my account and what should I do to request a waiver?')}`}</section>`;
}
function expenses() {
  const m = model(), housing = m.charges.filter(r => /housing|room/i.test(r.label)), meals = m.charges.filter(r => /meal/i.test(r.label)), tuition = m.charges.filter(r => /tuition|fee/i.test(r.label));
  const rows = (items, link) => table(['Expense', 'Amount', ''], items, r => [`<b>${esc(r.label)}</b><small>Posted to your university account</small>`, money(r.amountCents), link ? `<a class="secondary-button sm-button" href="#${link}">Explore ${link} →</a>` : `<button class="secondary-button sm-button" data-detail="${r.id}">View details →</button>`], 'expense-table');
  return `<div class="section-intro"><div><h2>Your expenses, explained.</h2><p>${esc(plan.term?.name || plan.termId)} · Review your tuition, room and board, and coverage in one place.</p></div><a class="secondary-button" href="#simulator">Explore a scenario →</a></div><div class="kpis">${kpi('University expenses', money(plan.account.postedChargesCents), 'Committed charges this term', '', 'charges')}${kpi('Living expenses', money(m.livingTotal), 'Estimated · paid directly by you', '', 'living')}${kpi('Room & board', money(sum([...housing, ...meals], 'amountCents')), 'University housing + meal plan')}${kpi('Full attendance estimate', money(plan.planning.totalAttendanceEstimateCents), 'University charges + saved living budget', '', 'attendance')}</div><div class="plan-periods"><div>${badge('Current plan', 'done')}<h3>${esc(plan.term?.name || plan.termId)}</h3><p>Charges and current coverage are recorded on your account.</p></div><div>${badge('Explore your options')}<h3>Plan a change</h3><p>Compare published room and meal rates without changing your current selections.</p><a class="text-button" href="#simulator">Open the Simulator →</a></div></div><section class="story">${head('graduation', 'Tuition & required fees', 'Your university charges, as posted on the account.')}${rows(tuition)}<div class="ledger-foot">Tuition & fees total <b>${money(sum(tuition, 'amountCents'))}</b></div></section><section class="story">${head('home', 'Housing & meals', 'Your current room and meal costs. Explore the alternatives before making a change.')}${rows(housing, 'housing')}${rows(meals, 'meals')}<div class="ledger-foot">University room & board total <b>${money(sum([...housing, ...meals], 'amountCents'))}</b></div></section>${coverage()}`;
}
function catalog(kind) {
  const housing = kind === 'housing', items = plan.catalog.filter(r => r.kind === kind && r.period === 'term');
  const current = housing ? plan.visualization.charges.find(r => /housing|room/i.test(r.label)) : plan.catalog.find(r => r.id === plan.mealEnrollments.find(r => r.status === 'active')?.catalog_id);
  const currentCost = current?.amountCents ?? current?.amount_cents;
  return `<nav class="campus-breadcrumb" aria-label="Breadcrumb"><a href="#expenses">Expenses</a><span>/</span><span>${housing ? 'Housing' : 'Meal plans'}</span></nav><section class="campus-hero"><img src="assets/img/${housing ? 'concept4-housing-hall.png' : 'concept4-dining-hall.png'}" alt="Illustrative university ${housing ? 'residence hall' : 'dining commons'}"><div class="campus-hero-copy"><span class="campus-eyebrow">${housing ? 'A place to make your own' : 'Good food. Your kind of routine.'}</span><h2>${housing ? 'Find your home<br>at Aster.' : 'A meal plan that<br>fits your day.'}</h2><p>Explore the options and costs that fit your life.</p></div></section><section class="campus-current"><span class="tile">${ic(housing ? 'home' : 'food')}</span><div class="grow"><span class="panel-label">Your current ${housing ? 'housing charge' : 'meal plan'}</span><h3>${esc(current?.label || current?.name || 'Review your current selection')}</h3></div><div class="current-price"><strong>${money(currentCost)}</strong><small>Per semester</small></div>${badge('Current', 'done')}</section><div class="section-intro"><div><h2>${housing ? 'Room for your next chapter.' : 'Choose how you dine.'}</h2><p>Compare published university rates. Changes require university approval.</p></div></div><div class="campus-options">${items.map((r, i) => `<article class="campus-option ${r.amount_cents === currentCost ? 'selected' : ''}"><button class="campus-photo" data-detail="${r.id}" aria-label="Explore ${esc(r.name)}"><img src="assets/img/${housing ? i ? 'concept4-housing-suite.png' : 'concept4-housing-room.png' : i ? 'concept4-dining-cafe.png' : 'concept4-dining-meal.png'}" alt="Illustrative ${housing ? 'student room' : 'campus meal'}" loading="lazy"><span class="image-pill">Explore this plan</span></button><div class="campus-option-body"><div class="campus-option-title"><h3>${esc(r.name)}</h3><strong>${money(r.amount_cents)}<small>/ semester</small></strong></div><p>${esc(r.eligibility)}</p></div><div class="campus-option-foot"><span>${currentCost == null ? 'Published rate' : r.amount_cents === currentCost ? 'Same cost as your current plan' : `${money(Math.abs(r.amount_cents - currentCost))} ${r.amount_cents < currentCost ? 'less' : 'more'} per semester`}</span><button class="secondary-button sm-button" data-detail="${r.id}">View plan →</button></div></article>`).join('')}</div><section class="story"><a class="secondary-button" href="#simulator">Compare the whole budget in the Simulator →</a><p class="meta muted">Campus imagery is illustrative. Published rates do not guarantee availability or eligibility.</p></section>`;
}
function simulator() {
  return `<a class="back-link" href="#expenses">← Back to expenses</a><section class="story">${head('spark', 'Plan Studio · What if?', 'Try term estimates and published housing or meal alternatives. This preview changes no records.')}<form id="scenario-form"><div class="budget-grid">${['housing', 'meal'].map(kind => `<label class="field">${kind === 'housing' ? 'Housing alternative' : 'Meal alternative'}<select name="${kind}RateId"><option value="">Keep current posted charges</option>${plan.catalog.filter(r => r.kind === kind && r.period === 'term').map(r => `<option value="${esc(r.id)}">${esc(r.name)} · ${money(r.amount_cents)}</option>`).join('')}</select></label>`).join('')}${fields.map(([key, label]) => `<label class="field">${label} ($ / term)<input name="${key}" type="number" step="0.01" min="0" max="1000000" value="${draft[key] === undefined ? '' : draft[key] / 100}" placeholder="Not included"></label>`).join('')}</div><button class="primary-button" type="submit">Preview this scenario</button></form><div id="scenario-result" aria-live="polite">${scenario ? scenarioResult() : ''}</div>${ask('Help me compare financial planning options, keeping actual facts separate from assumptions.')}</section>`;
}
function scenarioResult() {
  return `<div class="kpis">${kpi('Estimated funding gap', money(scenario.estimatedFundingGapCents), 'After anticipated aid, living costs and expected resources')}${kpi('Catalog difference', money(scenario.catalogDifferenceCents), 'Compared with posted housing and meal charges')}${kpi('Living estimate', money(scenario.livingTotalCents), 'Hypothetical term spending')}${kpi('Expected resources', money(scenario.incomeTotalCents), 'Unverified assumptions')}</div>${table(['Alternative', 'Term rate', 'Current charge', 'Eligibility'], scenario.alternatives, r => [esc(r.name), money(r.amountCents), money(r.currentPostedChargeCents), esc(r.eligibility)])}<p class="meta muted">Preview only. Your account, awards, housing and saved budget have not changed.</p>`;
}
function render() {
  if (!plan) return;
  const route = location.hash.slice(1) || 'overview', tab = ['housing', 'meals', 'coverage', 'simulator'].includes(route) ? 'expenses' : route === 'timeline' ? 'payments' : route;
  const m = model();
  $('#tabs').innerHTML = tabs.map(([id, label, icon]) => `<a href="#${id}" class="${tab === id ? 'active' : ''}" ${tab === id ? 'aria-current="page"' : ''}>${ic(icon)}${label}</a>`).join('');
  $('#mobile-financial-section').value = tab;
  $('.flag').textContent = `University snapshot · ${date(plan.snapshotAt)}`;
  const contact = plan.advisers?.[0];
  if (contact) { $('.advisor-bar .who strong').innerHTML = `${esc(contact.name)} <span>· ${esc(contact.office_name)}</span>`; $('.advisor-bar .avatar').textContent = contact.name.split(' ').map(x => x[0]).slice(0, 2).join(''); }
  $('#sum-figure').previousElementSibling.textContent = `Uncovered balance · ${plan.term?.name || plan.termId}`;
  $('#sum-figure').innerHTML = `${money(m.gap)}<span class="estimate-chip">Estimate</span>`;
  $('#sum-copy').textContent = `Your university charges total ${money(plan.account.postedChargesCents)}. Posted aid and payments leave ${money(plan.account.postedBalanceCents)} on your account. Another ${money(plan.aid.anticipatedTermCents)} in anticipated aid would bring it to ${money(m.gap)}. Open offers are not counted yet.`;
  $('#band').innerHTML = `<span class="lead">${ic('flag')}${m.open.length ? `${m.open.length} aid decisions waiting · review your offers and payment plan` : 'Review your financial plan and upcoming payments'}</span><a class="action-band-action" href="#aid">Review aid</a>`;
  $('#tab-root').innerHTML = ({ overview, aid, payments, expenses, timeline, housing: () => catalog('housing'), meals: () => catalog('meal'), coverage, simulator }[route] || overview)();
}
async function load() {
  try { plan = await request('read'); draft = { ...plan.planning.inputs }; render(); }
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
  if (key) { const factor = period === 'month' ? 4.5 : 1; if (e.target.value === '') delete draft[key]; else draft[key] = Math.round(Number(e.target.value) * factor * 100); $('#budget-status').textContent = 'Unsaved changes · Save term estimates to update your plan and Edward.'; refreshBudget(); }
  if (e.target.id === 'split-now') { const a = plan.paymentAgreements[0]; $('#split-result').textContent = splitCopy(Math.min(model().gap, Math.max(0, Math.round(Number(e.target.value) * 100))), plan.installments.length || 4, a?.fee_cents || 0); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'living-period') { period = e.target.value; render(); }
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
  try { await request('save-inputs', { termId: plan.termId, expectedVersion: plan.planning.version, inputs: draft }); plan = await request('read'); draft = { ...plan.planning.inputs }; error = 'Your term estimates are saved.'; }
  catch (cause) { error = cause.message; }
  finally { saving = false; render(); }
});
void load();
