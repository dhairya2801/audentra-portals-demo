"use client";

import type { CatalogCourse } from "@vv/contracts";
import { type FormEvent, useState } from "react";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import Card, { CardHead, CardRows } from "../design-system/primitives/Card.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import { searchCatalogCourses } from "../lib/api-client";
import { useActivityTracking } from "../hooks/use-activity-tracking";

/**
 * Production-only: the whole catalog, searched. It has no reference screen, so
 * it borrows the shapes the page already uses — a card, a field, and course
 * rows — and opens the same course drawer the requirement rows do.
 */
export function ClassroomsCatalogSearch({
  institution,
  catalogVersion,
  onOpen,
}: {
  institution: string;
  catalogVersion: string;
  onOpen: (course: CatalogCourse) => void;
}) {
  const { track } = useActivityTracking();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogCourse[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const response = await searchCatalogCourses(query);
      setResults(response.items);
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
      setError(caught instanceof Error ? caught.message : "Course search is unavailable.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <Card className="catalog-card" id="catalog-search">
      <CardHead
        kind="status"
        icon="magnify"
        title="Search the catalog"
        note={`Every course ${institution} publishes in catalog ${catalogVersion}, whether or not your program asks for it.`}
      />
      <form className="catalog-search" onSubmit={search} role="search">
        <label className="field">
          <span className="field-label">Course code, title or topic</span>
          <span className="field-control">
            <input
              type="search"
              value={query}
              placeholder="Try “calculus”, “CS 201” or “finance”"
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </label>
        <Button kind="primary" type="submit" pending={searching} icon="magnify" iconSize={15}>
          Search
        </Button>
      </form>

      {error ? (
        <StateCard variant="error" size="compact" title="Course search is unavailable" icon="alert">
          {error}
        </StateCard>
      ) : results === null ? null : results.length === 0 ? (
        <StateCard variant="empty" size="compact" title="No catalog courses match that search" icon="magnify">
          Try a course code, a subject, a topic, or a shorter keyword.
        </StateCard>
      ) : (
        <CardRows className="catalog-results">
          {results.map((course, index) => (
            <article className="course-row open" key={course.id || `${course.code}-${index}`}>
              <span className="course-mark" aria-hidden="true">
                <Icon name="book" size={15} />
              </span>
              <div className="course-identity">
                <p className="course-name">
                  <span>
                    {course.code} · {course.title}
                  </span>
                </p>
                <p className="course-meta">
                  <span>{course.credits} credits</span>
                  {course.availabilityLabel ? <span>{course.availabilityLabel}</span> : null}
                  <span>
                    {course.prerequisites.length
                      ? `Requires ${course.prerequisites.map((p) => p.courseCode).join(", ")}`
                      : "No prerequisites"}
                  </span>
                </p>
                <p className="course-counts">{course.description}</p>
              </div>
              <div className="course-trailing">
                <button type="button" className="text-button" onClick={() => onOpen(course)}>
                  Details
                </button>
              </div>
            </article>
          ))}
        </CardRows>
      )}
    </Card>
  );
}
