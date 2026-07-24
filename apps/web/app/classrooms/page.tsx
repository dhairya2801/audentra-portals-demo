"use client";

import type { CatalogCourse, StudentAcademicPlanItem } from "@vv/contracts";
import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useState,
} from "react";
import { PortalShell } from "../components/portal-shell";
import { ErrorState, LoadingState } from "../components/portal-ui";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import { useApiResource } from "../hooks/use-api-resource";
import {
  getStudentAcademics,
  searchCatalogCourses,
} from "../lib/api-client";

const statusLabels: Record<StudentAcademicPlanItem["status"], string> = {
  required: "Required",
  eligible: "Ready to take",
  blocked: "Prerequisite needed",
  in_progress: "In progress",
  completed: "Completed",
  exemption_suggested: "Credit match",
  exempted: "Exempted",
};

function CourseDetail({
  course,
  onClose,
}: {
  course: CatalogCourse;
  onClose: () => void;
}) {
  return (
    <div className="course-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="course-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" aria-label="Close course details" onClick={onClose}>
          ×
        </button>
        <p className="eyebrow">{course.code} · {course.credits} credits</p>
        <h2 id="course-dialog-title">{course.title}</h2>
        <p>{course.description}</p>
        <div>
          <strong>Prerequisites</strong>
          {course.prerequisites.length ? (
            <ul>
              {course.prerequisites.map((prerequisite) => (
                <li key={prerequisite.courseCode}>
                  {prerequisite.courseCode}
                  {prerequisite.minimumGrade
                    ? ` · minimum grade ${prerequisite.minimumGrade}`
                    : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p>No course prerequisites.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default function ClassroomsPage() {
  const load = useCallback(
    (signal: AbortSignal) => getStudentAcademics(signal),
    [],
  );
  const academics = useApiResource(load);
  const { track } = useActivityTracking();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogCourse[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CatalogCourse | null>(null);
  const [reviewRule, setReviewRule] = useState<string | null>(null);

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearching(true);
    setSearchError(null);
    try {
      const response = await searchCatalogCourses(query);
      setSearchResults(response.items);
      track("ui.course_catalog_searched.v1", {
        query_length_bucket:
          query.length === 0
            ? "empty"
            : query.length < 4
              ? "1_to_3"
              : query.length < 12
                ? "4_to_11"
                : "12_plus",
        result_count: response.total,
      });
    } catch (caught) {
      setSearchError(
        caught instanceof Error ? caught.message : "Course search is unavailable.",
      );
    } finally {
      setSearching(false);
    }
  };

  const openCourse = (course: CatalogCourse, surface: string) => {
    setSelectedCourse(course);
    track("ui.course_viewed.v1", {
      course_code: course.code,
      surface,
    });
  };

  const results =
    searchResults ?? academics.data?.plan.map((item) => item.course) ?? [];

  return (
    <PortalShell
      active="classrooms"
      eyebrow="My classrooms"
      title="See the path through your major"
      description="Required courses, prerequisites, transcript credit matches, and the complete catalog in one place."
      actions={
        <Link className="button button--accent" href="/documents">
          Upload a transcript
        </Link>
      }
    >
      {academics.status === "loading" ? (
        <LoadingState label="Building your academic plan" />
      ) : academics.status === "error" ? (
        <ErrorState message={academics.error} onRetry={academics.reload} />
      ) : (
        <>
          <section className="academic-hero">
            <div>
              <p className="eyebrow">Your selected program</p>
              <h2>{academics.data.selectedProgram.name}</h2>
              <span>{academics.data.selectedProgram.degree}</span>
              <p>{academics.data.selectedProgram.description}</p>
              <small>
                Catalog {academics.data.catalogVersion} ·{" "}
                {academics.data.selectedProgram.totalCredits} degree credits
              </small>
            </div>
            <div className="academic-progress">
              <div>
                <strong>{academics.data.progress.percent}%</strong>
                <span>Degree credit recognized</span>
              </div>
              <p>
                {academics.data.progress.exemptedCredits} exempted ·{" "}
                {academics.data.progress.completedCredits} completed ·{" "}
                {academics.data.progress.requiredCredits} required
              </p>
              <div className="aster-progress-track">
                <span style={{ width: `${Math.max(4, academics.data.progress.percent)}%` }} />
              </div>
            </div>
          </section>

          <section className="aster-section">
            <div className="aster-section__heading">
              <div>
                <p className="eyebrow">Transcript intelligence</p>
                <h2>Potential course exemptions</h2>
              </div>
              <p>Recommendations require registrar or academic-advisor approval.</p>
            </div>
            <div className="exemption-grid">
              {academics.data.exemptionRecommendations.map((recommendation) => {
                const source = academics.data.transcriptCredits.find(
                  (credit) => credit.id === recommendation.transcriptCreditId,
                );
                const expanded = reviewRule === recommendation.ruleCode;
                return (
                  <article key={recommendation.id}>
                    <div className="exemption-match">
                      <div>
                        <small>Transcript evidence</small>
                        <strong>{source?.sourceCode ?? source?.title}</strong>
                        <span>Score / grade {source?.gradeOrScore ?? "—"}</span>
                      </div>
                      <span aria-hidden="true">→</span>
                      <div>
                        <small>Aster equivalent</small>
                        <strong>{recommendation.targetCourseCode}</strong>
                        <span>{recommendation.targetCourseTitle}</span>
                      </div>
                    </div>
                    <div className="exemption-footer">
                      <span>{Math.round(recommendation.confidence * 100)}% rule confidence</span>
                      <button
                        type="button"
                        onClick={() => {
                          setReviewRule(expanded ? null : recommendation.ruleCode);
                          track("ui.exemption_reviewed.v1", {
                            rule_code: recommendation.ruleCode,
                            recommendation_status: recommendation.status,
                          });
                        }}
                      >
                        {expanded ? "Hide rule" : "Why this matches"}
                      </button>
                    </div>
                    {expanded ? (
                      <div className="exemption-evidence">
                        <strong>{recommendation.ruleCode}</strong>
                        <p>{recommendation.rationale}</p>
                        <small>
                          Edward may normalize transcript text, but this match is
                          produced by a versioned database rule—not by free-form AI.
                        </small>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="aster-card academic-plan-card">
            <div className="aster-section__heading">
              <div>
                <p className="eyebrow">Program map</p>
                <h2>Required course sequence</h2>
              </div>
              <span>{academics.data.plan.length} courses in this preview</span>
            </div>
            <div className="academic-plan-table" role="table" aria-label="Program requirements">
              <div role="row" className="academic-plan-table__header">
                <span role="columnheader">Course</span>
                <span role="columnheader">Recommended</span>
                <span role="columnheader">Prerequisites</span>
                <span role="columnheader">Status</span>
              </div>
              {academics.data.plan.map((item) => (
                <button
                  type="button"
                  role="row"
                  onClick={() => openCourse(item.course, "program_plan")}
                  key={item.course.id}
                >
                  <span role="cell">
                    <strong>{item.course.code}</strong>
                    <small>{item.course.title}</small>
                  </span>
                  <span role="cell">Term {item.recommendedTerm}</span>
                  <span role="cell">
                    {item.missingPrerequisiteCodes.length
                      ? item.missingPrerequisiteCodes.join(", ")
                      : item.course.prerequisites.length
                        ? "Satisfied"
                        : "None"}
                  </span>
                  <span role="cell" className={`academic-status academic-status--${item.status}`}>
                    {statusLabels[item.status]}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="aster-section course-catalog">
            <div className="aster-section__heading">
              <div>
                <p className="eyebrow">Aster catalog</p>
                <h2>Search classes</h2>
              </div>
              <p>
                Seeded programs:{" "}
                {academics.data.availablePrograms.map((program) => program.name).join(" · ")}
              </p>
            </div>
            <form onSubmit={search}>
              <label htmlFor="course-search">Search by course code, title, or topic</label>
              <div>
                <input
                  id="course-search"
                  value={query}
                  placeholder="Try “calculus”, “CS 201”, or “finance”"
                  onChange={(event) => setQuery(event.target.value)}
                />
                <button className="button button--accent" type="submit" disabled={searching}>
                  {searching ? "Searching…" : "Search catalog"}
                </button>
              </div>
            </form>
            {searchError ? <p className="inline-error">{searchError}</p> : null}
            <div className="course-results">
              {results.map((course) => (
                <button
                  type="button"
                  onClick={() => openCourse(course, "catalog_search")}
                  key={course.id}
                >
                  <span>{course.code}</span>
                  <h3>{course.title}</h3>
                  <p>{course.description}</p>
                  <small>
                    {course.credits} credits ·{" "}
                    {course.prerequisites.length
                      ? `${course.prerequisites.length} prerequisite${course.prerequisites.length === 1 ? "" : "s"}`
                      : "No prerequisites"}
                  </small>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
      {selectedCourse ? (
        <CourseDetail course={selectedCourse} onClose={() => setSelectedCourse(null)} />
      ) : null}
    </PortalShell>
  );
}
