"use client";

import type { StaffOperationsWorkspace } from "@vv/contracts";
import styles from "./student-360-campus-life.module.css";

type CampusLifePanelProps = {
  studentName: string;
  classYear: number;
  operation: StaffOperationsWorkspace["cohort"][number];
};

const engagementItems = [
  { name: "Computing Society", kind: "Student organization", status: "Joined" },
  { name: "First-Generation Scholars", kind: "Peer community", status: "Active" },
  { name: "Campus Welcome Crew", kind: "Orientation event", status: "Registered" },
];

export function CampusLifePanel({ studentName, classYear, operation }: CampusLifePanelProps) {
  const residenceConfirmed = operation.journey.totalTasks > 0 && operation.journey.completedTasks >= Math.ceil(operation.journey.totalTasks * 0.75);
  const readinessPercent = residenceConfirmed ? 75 : 50;
  const housingRequirements = [
    { title: "Housing application", detail: "Submitted July 12, 2027", status: "Complete", tone: "complete" },
    residenceConfirmed
      ? { title: "Room assignment", detail: "Linden Hall 214B confirmed", status: "Complete", tone: "complete" }
      : { title: "Room assignment", detail: "Preferences submitted; matching in progress", status: "In review", tone: "waiting" },
    { title: "Emergency contact confirmation", detail: "Student update requested Aug 28", status: "Waiting on student", tone: "waiting" },
    { title: "Roommate agreement", detail: "Available after move-in", status: "Upcoming", tone: "upcoming" },
  ];
  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <div>
          <p>Campus life profile</p>
          <h3>Living on campus</h3>
          <span>{studentName} &middot; Class of {classYear}</span>
        </div>
        <div className={styles.readinessMetric}>
          <div className={styles.readinessRing} aria-label={`Move-in readiness ${readinessPercent} percent`} style={{ background: `radial-gradient(circle closest-side, #1d6570 72%, transparent 73% 99%), conic-gradient(#f0bc58 0 ${readinessPercent}%, rgba(255,255,255,0.17) ${readinessPercent}% 100%)` }}>
            <strong>{readinessPercent}%</strong>
          </div>
          <span>Move-in ready</span>
        </div>
      </section>

      <section className={styles.statusGrid} aria-label="Campus life summary">
        <article><span>Housing status</span><strong>{residenceConfirmed ? "Assigned" : "Preferences submitted"}</strong><small>On-campus residence</small></article>
        <article><span>Residence hall</span><strong>{residenceConfirmed ? "Linden Hall" : "North Community"}</strong><small>{residenceConfirmed ? "North Residential Community" : "First-choice community"}</small></article>
        <article><span>Room assignment</span><strong>{residenceConfirmed ? "214B" : "Pending"}</strong><small>{residenceConfirmed ? "Double occupancy" : "Preference matching"}</small></article>
        <article><span>Athletics</span><strong>Non-athlete</strong><small>Recreation interests recorded</small></article>
      </section>

      <div className={styles.primaryGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <div><p>{residenceConfirmed ? "Residence assignment" : "Housing preferences"}</p><h3>{residenceConfirmed ? "Linden Hall 214B" : "Student selections"}</h3></div>
            <span className={residenceConfirmed ? styles.confirmed : styles.pending}>{residenceConfirmed ? "Confirmed" : "Assignment pending"}</span>
          </div>
          <div className={residenceConfirmed ? styles.roomVisual : styles.preferenceVisual}>
            <div className={styles.buildingMark}>{residenceConfirmed ? "LH" : "1"}</div>
            <div><strong>North Residential Community</strong><span>{residenceConfirmed ? "First-year residence · Double occupancy" : "First choice · Traditional residence hall"}</span></div>
          </div>
          <dl className={styles.factGrid}>
            <div><dt>{residenceConfirmed ? "Roommate" : "Room preference"}</dt><dd>{residenceConfirmed ? "Jordan Ellis" : "Double occupancy"}</dd></div>
            <div><dt>{residenceConfirmed ? "Move-in window" : "Living-learning interest"}</dt><dd>{residenceConfirmed ? "Aug 21 · 9 AM-12 PM" : "Computing & Innovation"}</dd></div>
            <div><dt>Dining plan</dt><dd>14 meals per week</dd></div>
            <div><dt>{residenceConfirmed ? "Accessibility request" : "Environment preference"}</dt><dd>{residenceConfirmed ? "None recorded" : "Quiet study floor"}</dd></div>
          </dl>
        </section>

        <section className={styles.insightCard}>
          <div className={styles.insightHeading}><span aria-hidden="true">!</span><div><p>Campus signal brief</p><h3>{residenceConfirmed ? "One move-in item needs attention" : "Housing preferences need a match"}</h3></div></div>
          <p>{residenceConfirmed ? `${studentName} has a confirmed room and move-in window, but the emergency contact confirmation is still waiting on the student.` : `${studentName}'s housing preferences are saved, but Residence Life has not confirmed a hall, room, or roommate assignment yet.`}</p>
          <div className={styles.recommendation}>
            <span>Recommended now</span>
            <strong>{residenceConfirmed ? "Send one combined move-in reminder" : "Review the first-choice preference match"}</strong>
            <small>{residenceConfirmed ? "Include the contact request, residence assignment, and arrival window in a single message." : "Confirm whether North Residential Community can satisfy the room and living-learning preferences."}</small>
          </div>
          <dl className={styles.insightFacts}>
            <div><dt>Expected impact</dt><dd>Protect move-in readiness</dd></div>
            <div><dt>Suggested channel</dt><dd>Student portal + email</dd></div>
          </dl>
        </section>
      </div>

      <div className={styles.secondaryGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <div><p>Housing requirements</p><h3>Move-in checklist</h3></div>
            <span>3 of 4 ready</span>
          </div>
          <div className={styles.requirementList}>
            {housingRequirements.map((item, index) => (
              <article key={item.title}>
                <span className={`${styles.stepMark} ${styles[item.tone]}`}>{item.tone === "complete" ? "OK" : index + 1}</span>
                <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                <span className={`${styles.statusTag} ${styles[item.tone]}`}>{item.status}</span>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <div><p>Campus engagement</p><h3>Communities and activities</h3></div>
            <span>3 connections</span>
          </div>
          <div className={styles.engagementList}>
            {engagementItems.map((item) => (
              <article key={item.name}>
                <span>{item.name.slice(0, 1)}</span>
                <div><strong>{item.name}</strong><small>{item.kind}</small></div>
                <em>{item.status}</em>
              </article>
            ))}
          </div>
          <div className={styles.interestBand}>
            <span>Recorded interests</span>
            <div><strong>Recreational soccer</strong><strong>Technology volunteering</strong><strong>Outdoor programs</strong></div>
          </div>
        </section>
      </div>
    </div>
  );
}
