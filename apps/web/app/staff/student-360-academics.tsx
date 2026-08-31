"use client";

import { useMemo, useState } from "react";
import styles from "./student-360-academics.module.css";

type AcademicsPanelProps = {
  studentName: string;
  programName: string;
  classYear: number;
};

type Course = {
  code: string;
  title: string;
  credits: number;
  detail: string;
  status: string;
};

const enrolledCourses: Course[] = [
  { code: "CS 201", title: "Data Structures", credits: 3, detail: "Mon/Wed 10:00 AM", status: "Enrolled" },
  { code: "MATH 221", title: "Discrete Mathematics", credits: 3, detail: "Tue/Thu 1:00 PM", status: "Enrolled" },
  { code: "WRIT 210", title: "Writing for Technology", credits: 3, detail: "Fri 9:00 AM", status: "Enrolled" },
];

const completedCourses: Course[] = [
  { code: "CS 101", title: "Computing Foundations", credits: 4, detail: "Fall 2026", status: "A" },
  { code: "MATH 151", title: "Calculus I", credits: 4, detail: "Fall 2026", status: "B+" },
  { code: "ENG 101", title: "Academic Composition", credits: 3, detail: "Transfer credit", status: "TR" },
  { code: "SCI 110", title: "Scientific Inquiry", credits: 4, detail: "AP credit", status: "AP" },
];

const degreeRequirements = [
  { label: "Computer Science core", complete: 18, total: 48 },
  { label: "Mathematics and science", complete: 12, total: 24 },
  { label: "General education", complete: 9, total: 30 },
  { label: "Major electives", complete: 3, total: 18 },
];

const recommendedElectives = [
  { code: "HCI 210", title: "Human-Centered Computing", seats: 12, prerequisite: "CS 101", reason: "Builds product and interface thinking." },
  { code: "DATA 240", title: "Applied Data Storytelling", seats: 8, prerequisite: "MATH 151", reason: "Pairs well with the analytics pathway." },
  { code: "CYBR 205", title: "Foundations of Cybersecurity", seats: 16, prerequisite: "CS 101", reason: "Keeps the security concentration open." },
];

function CourseRow({ course }: { course: Course }) {
  return (
    <article className={styles.courseRow}>
      <span className={styles.courseCode}>{course.code}</span>
      <div>
        <strong>{course.title}</strong>
        <small>{course.detail} &middot; {course.credits} credits</small>
      </div>
      <span className={styles.courseStatus}>{course.status}</span>
    </article>
  );
}

export function AcademicsPanel({ studentName, programName, classYear }: AcademicsPanelProps) {
  const [creditLoad, setCreditLoad] = useState(15);
  const [selectedElective, setSelectedElective] = useState(recommendedElectives[0].code);
  const [plannerReady, setPlannerReady] = useState(false);

  const proposedSchedule = useMemo(() => {
    const selected = recommendedElectives.find((course) => course.code === selectedElective) ?? recommendedElectives[0];
    const courses = ["CS 230 Algorithms", "MATH 240 Linear Algebra", `${selected.code} ${selected.title}`];
    if (creditLoad >= 15) courses.push("UNI 220 Career Studio");
    if (creditLoad >= 18) courses.push("DATA 260 Data Ethics");
    return courses;
  }, [creditLoad, selectedElective]);

  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <div>
          <p>Academic path</p>
          <h3>{programName}</h3>
          <span>{studentName} &middot; Class of {classYear}</span>
        </div>
        <div className={styles.creditRing} aria-label="35 percent of degree credits earned">
          <strong>35%</strong>
        </div>
      </section>

      <section className={styles.summaryGrid} aria-label="Academic summary">
        <article><span>Credits earned</span><strong>42</strong><small>35% of degree</small></article>
        <article><span>Current GPA</span><strong>3.42</strong><small>Good standing</small></article>
        <article><span>Transfer + AP</span><strong>7</strong><small>2 sources verified</small></article>
        <article><span>Remaining</span><strong>78</strong><small>About 5 terms</small></article>
      </section>

      <div className={styles.columns}>
        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <div><p>Current term</p><h3>Enrolled now</h3></div>
            <span>9 credits</span>
          </div>
          <div className={styles.courseList}>{enrolledCourses.map((course) => <CourseRow key={course.code} course={course} />)}</div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeading}>
            <div><p>Degree audit</p><h3>Requirements</h3></div>
            <span>4 areas</span>
          </div>
          <div className={styles.requirementList}>
            {degreeRequirements.map((requirement) => {
              const percent = Math.round((requirement.complete / requirement.total) * 100);
              return (
                <article key={requirement.label}>
                  <div><strong>{requirement.label}</strong><span>{requirement.complete}/{requirement.total}</span></div>
                  <div className={styles.progressTrack}><span style={{ width: `${percent}%` }} /></div>
                  <small>{percent}% satisfied</small>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <section className={styles.completedCard}>
        <div className={styles.cardHeading}>
          <div><p>Verified history</p><h3>Completed courses and external credit</h3></div>
          <span>15 credits shown</span>
        </div>
        <div className={styles.completedGrid}>{completedCourses.map((course) => <CourseRow key={course.code} course={course} />)}</div>
      </section>

      <section className={styles.advisorPanel}>
        <div className={styles.advisorIntro}>
          <span className={styles.sparkle} aria-hidden="true">*</span>
          <div><p>AI academic guidance</p><h3>Build the next manageable schedule</h3></div>
          <span className={styles.advisoryTag}>Advisory</span>
        </div>
        <div className={styles.recommendationGrid}>
          <div className={styles.loadPlanner}>
            <label htmlFor="academic-credit-load">Preferred credit load <strong>{creditLoad} credits</strong></label>
            <input
              id="academic-credit-load"
              type="range"
              min="12"
              max="18"
              step="3"
              value={creditLoad}
              onChange={(event) => { setCreditLoad(Number(event.target.value)); setPlannerReady(false); }}
            />
            <div className={styles.rangeLabels}><span>12 balanced</span><span>18 intensive</span></div>
            <div className={styles.mustTake}>
              <p>Must-take next</p>
              <strong>CS 230 Algorithms</strong>
              <small>Required for five upper-level CS courses. Prerequisite CS 201 is in progress.</small>
            </div>
          </div>
          <div>
            <div className={styles.electiveHeading}><p>AI-recommended electives</p><span>Choose one</span></div>
            <div className={styles.electiveList}>
              {recommendedElectives.map((course) => (
                <button
                  key={course.code}
                  type="button"
                  className={selectedElective === course.code ? styles.electiveSelected : styles.elective}
                  onClick={() => { setSelectedElective(course.code); setPlannerReady(false); }}
                  aria-pressed={selectedElective === course.code}
                >
                  <span>{course.code}</span>
                  <div><strong>{course.title}</strong><small>{course.reason}</small><em>{course.seats} seats &middot; Prerequisite: {course.prerequisite}</em></div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.schedulePreview}>
          <div><p>Recommended schedule</p><strong>{creditLoad}-credit planning set</strong></div>
          <ul>{proposedSchedule.map((course) => <li key={course}>{course}</li>)}</ul>
          <button type="button" onClick={() => setPlannerReady(true)}>Prepare registration handoff</button>
        </div>
        {plannerReady ? (
          <div className={styles.handoffNotice} role="status">
            Course and session codes are ready for the institution registration system. No registration was submitted.
          </div>
        ) : null}
      </section>
    </div>
  );
}
