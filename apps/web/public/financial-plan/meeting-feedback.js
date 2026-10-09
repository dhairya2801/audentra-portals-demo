/* Display enrichment only. Institutional records always outrank illustrative examples. */
window.StudentFinancialPresentation = {
  metadata(rate) { try { return JSON.parse(rate?.metadata_json || '{}'); } catch { return {}; } },
  termLength(plan) {
    const start=Date.parse(plan.term?.starts_on),end=Date.parse(plan.term?.ends_on);
    const days=Number.isFinite(start)&&Number.isFinite(end)&&end>start?Math.round((end-start)/86400000)+1:137;
    return {days,weeks:days/7,months:days/(365.25/12),published:Number.isFinite(start)&&Number.isFinite(end)};
  },
  rateFor(plan,charge) {
    const kind=/tuition/i.test(charge.label)?'tuition':/housing|room/i.test(charge.label)?'housing':/meal/i.test(charge.label)?'meal':null;
    return plan.catalog.find(rate=>rate.kind===kind&&rate.amount_cents===charge.amountCents);
  },
  chargeContext(plan,charge) {
    const rate=this.rateFor(plan,charge),meta=this.metadata(rate);
    if(/tuition/i.test(charge.label))return {label:'Tuition',sub:`${rate?.name || 'Your tuition rate'} · full-time example, 15 credits`,example:true};
    if(/housing|room/i.test(charge.label))return {label:'University housing',sub:rate?.name || 'Assigned campus room'};
    if(/meal/i.test(charge.label))return {label:`Meal plan · ${rate?.name || 'Campus dining'}`,sub:`${meta.swipes || 'Published meal allowance'}${meta.diningDollarsCents?` · $${meta.diningDollarsCents/100} dining dollars`:''}`};
    return {label:charge.label,sub:'Posted university charge'};
  },
  scholarshipRules(offer) {
    const rules=offer.renewal_conditions;
    return rules?{sample:false,gpa:rules.minimum_gpa,duration:rules.maximum_semesters,load:rules.enrollment_requirement||'See your offer',review:rules.review_frequency||'Each academic year'}:
      {sample:true,gpa:3.0,duration:8,load:'Full-time enrollment',review:'At the end of each academic year'};
  },
  loanTypes: [
    {title:'Direct Subsidized',who:'Eligible undergraduate students',body:'Need-based borrowing with interest support during eligible periods. Your offer sets the amount available.'},
    {title:'Direct Unsubsidized',who:'Eligible student borrowers',body:'Interest accrues while you study. Review the rate, fee and total repayment cost before accepting.'},
    {title:'Parent PLUS',who:'Parents of dependent undergraduates',body:'The parent is the borrower and is responsible for repayment. Eligibility and current limits need confirmation.'},
    {title:'Direct Consolidation',who:'Borrowers with existing federal loans',body:'Combines eligible federal loans into one loan. This is a repayment option, not extra money for this semester.'},
    {title:'Graduate borrowing',who:'A different stage of education',body:'Graduate borrowing and PLUS eligibility have changed. They are separate from your undergraduate offers; review current Federal Student Aid guidance.'},
  ],
};
