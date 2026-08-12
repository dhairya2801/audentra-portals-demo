"use client";

import type { CatalogCourse, StudentAcademicPlanItem } from "@vv/contracts";
import { TenantLink as Link } from "../components/tenant-link";
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
import { useTenant } from "../components/tenant-provider";

const statusLabels: Record<StudentAcademicPlanItem["status"], string> = {
  required: "Required",
  eligible: "Ready to take",
  blocked: "Prerequisite needed",
  in_progress: "In progress",
  completed: "Completed",
  exemption_suggested: "Credit match",
  exempted: "Exempted",
};

function youtubeEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return null;
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      return null;
    }
    const playlist = url.searchParams.get("list");
    if (url.pathname === "/playlist" && playlist) {
      return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlist)}`;
    }
    const id =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : url.pathname.startsWith("/embed/")
          ? url.pathname.slice("/embed/".length).split("/")[0]
          : null;
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  } catch {
    return null;
  }
}

function CourseDetail({
  course,
  onClose,
}: {
  course: CatalogCourse;
  onClose: () => void;
}) {
  const videos = course.relatedVideos ?? [];
  const [videoIndex, setVideoIndex] = useState(0);
  const video = videos[videoIndex] ?? videos[0];
  const embedUrl = video ? youtubeEmbedUrl(video.url) : null;

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
        <dl className="course-dialog__facts">
          <div>
            <dt>Availability</dt>
            <dd>{course.availabilityLabel ?? "Confirm with the registrar"}</dd>
          </div>
          <div>
            <dt>Instruction</dt>
            <dd>
              {course.instructorNames?.length
                ? course.instructorNames.join(", ")
                : "Not yet published"}
            </dd>
          </div>
          <div>
            <dt>Meeting pattern</dt>
            <dd>{course.meetingPattern ?? "Not yet published"}</dd>
          </div>
        </dl>
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
        {video && embedUrl ? (
          <section className="course-dialog__videos" aria-labelledby="course-video-title">
            <div className="course-video-heading">
              <div>
                <strong id="course-video-title">Related course video</strong>
                <p>Optional learning media selected by academic staff.</p>
              </div>
              {videos.length > 1 ? (
                <span>{videoIndex + 1} / {videos.length}</span>
              ) : null}
            </div>
            <div className="course-video-frame">
              <iframe
                src={embedUrl}
                title={video.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="course-video-details">
              <div>
                <h3>{video.title}</h3>
                {video.description ? <p>{video.description}</p> : null}
                <small>{video.sourceLabel ?? video.provider}</small>
              </div>
              <a href={video.url} target="_blank" rel="noreferrer">
                Open on YouTube <span aria-hidden="true">↗</span>
              </a>
            </div>
            {videos.length > 1 ? (
              <div className="course-video-controls">
                <button
                  type="button"
                  onClick={() =>
                    setVideoIndex((current) => (current - 1 + videos.length) % videos.length)
                  }
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setVideoIndex((current) => (current + 1) % videos.length)}
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>
        ) : null}
        {course.resources?.length ? (
          <section
            className="course-dialog__resources"
            aria-labelledby="course-resource-title"
          >
            <div>
              <span aria-hidden="true">↗</span>
              <div>
                <strong id="course-resource-title">Relevant resources</strong>
                <p>Open textbooks selected for this course by academic staff.</p>
              </div>
            </div>
            <ul>
              {course.resources.map((resource) => (
                <li key={resource.id}>
                  <span className="course-resource-preview" aria-hidden="true">
                    PDF
                  </span>
                  <div>
                    <h3>{resource.title}</h3>
                    <p>{resource.description}</p>
                    <small>
                      {resource.provider} · {resource.licenseLabel}
                    </small>
                  </div>
                  <a href={resource.url} target="_blank" rel="noreferrer">
                    Open PDF <span aria-hidden="true">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {course.source ? (
          <a
            className="course-source-link"
            href={course.source.url}
            target="_blank"
            rel="noreferrer"
          >
            {course.source.label} <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </section>
    </div>
  );
}

export default function ClassroomsPage() {
  const { tenant } = useTenant();
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
              {academics.data.selectedProgram.source ? (
                <a
                  className="academic-source-link"
                  href={academics.data.selectedProgram.source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Program source ·{" "}
                  {academics.data.selectedProgram.source.label}
                  <span aria-hidden="true"> ↗</span>
                </a>
              ) : null}
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

          <section className="aster-section academic-next-term">
            <div className="aster-section__heading">
              <div>
                <p className="eyebrow">Plan at a glance</p>
                <h2>Your next recommended courses</h2>
              </div>
              <p>
                Recommendations come from the active tenant catalog and can be
                changed by academic staff.
              </p>
            </div>
            <div className="academic-next-grid">
              {academics.data.plan
                .filter((item) =>
                  ["eligible", "required", "in_progress"].includes(item.status),
                )
                .slice(0, 3)
                .map((item) => (
                  <button
                    type="button"
                    onClick={() => openCourse(item.course, "next_term")}
                    key={item.course.id}
                  >
                    <span>{item.course.code}</span>
                    <strong>{item.course.title}</strong>
                    <small>
                      Recommended term {item.recommendedTerm} ·{" "}
                      {statusLabels[item.status]}
                    </small>
                    <i aria-hidden="true">View course →</i>
                  </button>
                ))}
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
              {academics.data.exemptionRecommendations.length === 0 ? (
                <div className="academic-empty-state">
                  <span aria-hidden="true">◎</span>
                  <div>
                    <strong>No transcript matches are waiting</strong>
                    <p>
                      Upload a transcript to generate reviewable course-credit
                      recommendations against this university’s active rules.
                    </p>
                  </div>
                </div>
              ) : academics.data.exemptionRecommendations.map((recommendation) => {
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
                        <small>{tenant.shortName} equivalent</small>
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
                <h2>Suggested program path</h2>
              </div>
              <span>{academics.data.plan.length} tenant-managed plan items</span>
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
                  <span role="cell">
                    Term {item.recommendedTerm}
                    <small>{item.category.replaceAll("_", " ")}</small>
                  </span>
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
                <p className="eyebrow">{tenant.shortName} catalog</p>
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
              {results.length === 0 ? (
                <div className="academic-empty-state">
                  <span aria-hidden="true">⌕</span>
                  <div>
                    <strong>No catalog courses match that search</strong>
                    <p>Try a course code, subject, topic, or a shorter keyword.</p>
                  </div>
                </div>
              ) : (
                results.map((course) => (
                  <button
                    type="button"
                    onClick={() => openCourse(course, "catalog_search")}
                    key={course.id}
                  >
                    <span>{course.code}</span>
                    <h3>{course.title}</h3>
                    <p>{course.description}</p>
                    {course.availabilityLabel ? (
                      <em>{course.availabilityLabel}</em>
                    ) : null}
                    <small>
                      {course.credits} credits ·{" "}
                      {course.prerequisites.length
                        ? `${course.prerequisites.length} prerequisite${course.prerequisites.length === 1 ? "" : "s"}`
                        : "No prerequisites"}
                    </small>
                  </button>
                ))
              )}
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
