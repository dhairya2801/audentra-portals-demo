"use client";

import { useState } from "react";
import Link from "next/link";

/** A what-if view over recorded loads; it never registers or drops a course. */
export function CourseLoadImpact({ loads }: { loads: { term_id: string; credits: number }[] }) {
  const [term, setTerm] = useState(loads[0]?.term_id ?? "");
  const recorded = loads.find(load => load.term_id === term);
  const [proposed, setProposed] = useState<number | null>(null);
  const credits = proposed ?? recorded?.credits ?? 12;
  const reduced = credits < 12;
  return <section className="course-load-planner" aria-labelledby="course-load-heading">
    <div className="course-load-intro"><span className="panel-label">Before you change your schedule</span><h2 id="course-load-heading">See how your credit load could affect aid.</h2><p>Explore a possible change. Your registered courses, bill and awards stay unchanged.</p></div>
    <div className="course-load-controls">
      {loads.length > 1 && <label>Recorded term<select value={term} onChange={event => {setTerm(event.target.value);setProposed(null);}}>{loads.map(load => <option key={load.term_id} value={load.term_id}>{load.term_id}</option>)}</select></label>}
      <label htmlFor="planned-credit-load">Planning credit load <strong>{credits} credits</strong><input id="planned-credit-load" type="range" min="0" max="24" step="1" value={credits} onChange={event => setProposed(Number(event.target.value))}/></label>
      <small>{recorded ? `${recorded.credits} recorded credits · ${recorded.term_id}` : "Your current load has not been published. Start with a 12-credit example."}</small>
    </div>
    <div className={`course-load-impact ${reduced ? "is-reduced" : ""}`} role="status" aria-live="polite" aria-atomic="true">
      <strong>{reduced ? "Check your aid before reducing your load" : "Plan your semester with the full picture"}</strong>
      <p>{reduced ? "Below a 12-credit full-time example, Pell may reduce with enrollment intensity and scholarships may have renewal conditions. Federal student loans generally require at least half-time enrollment. Your school confirms the threshold for your program." : "Tuition, grants and scholarships can depend on your program and enrollment. Review your award conditions before adding or dropping a course."}</p>
      {reduced && <a href="/appointments?topic=financial_aid">Talk to Financial Aid →</a>}
      <Link href={`/financials?planningCredits=${credits}`}>Review the financial impact →</Link>
    </div>
  </section>;
}
