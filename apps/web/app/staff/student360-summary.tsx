"use client";
import {useCallback} from "react";
import {getStaffFinancialPlan, getUniversityRecord} from "../lib/api-client";
import {useApiResource} from "../hooks/use-api-resource";
import styles from "./student360-summary.module.css";
const money=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value/100);
const date=(value:string)=>new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"America/New_York"}).format(new Date(value));
export function Student360Summary({studentId,name}:{studentId:string;name:string}){
 const finance=useApiResource(useCallback((signal:AbortSignal)=>getStaffFinancialPlan(studentId,signal),[studentId]));
 const support=useApiResource(useCallback((signal:AbortSignal)=>getUniversityRecord("relationships",studentId,signal),[studentId]));
 const f=finance.data;
 return <section className={styles.summary} aria-label="Student at a glance">
  <div className={styles.heading}><div><span>THE NEXT CONVERSATION</span><h3>What matters for {name.split(" ")[0]}</h3></div><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent("audentra:staff-edward:ask",{detail:{question:`Tell me everything important about ${name} (${studentId}): their finances, classes, support team, open work and next deadlines.`}}))}>✦ Ask Edward</button></div>
  {finance.status==="error"?<p role="alert">Financial summary unavailable. <button type="button" onClick={finance.reload}>Retry</button></p>:!f?<p role="status">Reading the student’s financial plan…</p>:<>
  <div className={styles.metrics}><article><small>Posted account balance</small><strong>{money(f.account.postedBalanceCents)}</strong><span>After posted credits and reversals</span></article><article><small>Accepted aid · annual</small><strong>{money(f.aid.acceptedAnnualCents)}</strong><span>{money(f.account.postedAidCents)} posted this term</span></article><article><small>Pending payments</small><strong>{money(f.account.paymentStates.pending)}</strong><span>Settlement still pending</span></article></div>
  <div className={styles.grid}><article><h4>Requirements & account attention</h4>{f.holds.filter(h=>!h.released_at).map(h=><p className={styles.attention} key={String(h.id)}><b>{String(h.kind)} hold</b><span>{String(h.reason)}</span></p>)}{f.serviceProgress.filter(r=>r.status!=="complete").map((r,i)=><p className={styles.row} key={i}><span>{String(r.title)}</span><small>{String(r.status).replaceAll("_"," ")}</small></p>)}<details><summary>Student’s financial planning assumptions</summary><p>Self-reported estimates for the term. These are not verified savings or income.</p><p>{money(f.planning.livingTotalCents)} living expenses · {money(f.planning.incomeTotalCents)} expected personal resources.</p><div>{f.planning.living.map(r=><p className={styles.row} key={String(r.id)}><span>{String(r.label)}</span><b>{money(Number(r.amountCents))}</b></p>)}</div></details></article><article><h4>Support & upcoming conversations</h4>{support.data?.assignments?.filter(a=>!a.ends_at).map(a=><p className={styles.row} key={a.id}><span><b>{a.name}</b><small>{a.role.replaceAll("_"," ")}</small></span></p>)}{support.data?.appointments?.filter(a=>a.status==="scheduled").slice(0,3).map(a=><p className={styles.appointment} key={a.id}><b>{a.purpose}</b><span>{date(a.starts_at)}</span></p>)}{support.status==="error"?<p role="alert">Support details unavailable. <button type="button" onClick={support.reload}>Retry</button></p>:null}</article></div>
  </>}
 </section>;
}
