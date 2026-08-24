"use client";

import type { CatalogCourse } from "@vv/contracts";
import { useState } from "react";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import Drawer from "../design-system/primitives/Drawer.jsx";
import {
  type CreditMatch,
  type DegreeCourse,
  type DegreeRequirement,
  confidenceIcon,
  confidenceLabel,
  requirementStatus,
} from "./classrooms-model";

export type DrawerItem =
  | {
      kind: "course";
      catalog: CatalogCourse;
      course: DegreeCourse | null;
      requirement: DegreeRequirement | null;
    }
  | { kind: "match"; match: CreditMatch };

export function youtubeEmbedUrl(value: string) {
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

/**
 * One drawer, two kinds: the course (catalog information, with the media the
 * institution attached to it) and the evidence behind a potential match.
 */
export function AcademicDrawer({
  item,
  catalogVersion,
  institution,
  registrar,
  onClose,
  onAsk,
  onOpenCredit,
  suspended,
}: {
  item: DrawerItem;
  catalogVersion: string;
  institution: string;
  registrar: string;
  onClose: () => void;
  onAsk: (match: CreditMatch) => void;
  onOpenCredit: () => void;
  suspended: boolean;
}) {
  const isMatch = item.kind === "match";

  return (
    <Drawer
      variant={isMatch ? "evidence" : "course"}
      label={[
        isMatch ? "Potential match" : (item.requirement?.name ?? `${institution} catalog`),
        isMatch ? "Advisory" : `Catalog ${catalogVersion}`,
      ]}
      titleId="academic-drawer-title"
      onClose={onClose}
      suspended={suspended}
    >
      {item.kind === "match" ? (
        <EvidenceBody
          match={item.match}
          registrar={registrar}
          onAsk={onAsk}
          onClose={onClose}
          onOpenCredit={onOpenCredit}
        />
      ) : (
        <CourseBody
          catalog={item.catalog}
          course={item.course}
          requirement={item.requirement}
          institution={institution}
        />
      )}
    </Drawer>
  );
}

function CourseBody({
  catalog,
  course,
  requirement,
  institution,
}: {
  catalog: CatalogCourse;
  course: DegreeCourse | null;
  requirement: DegreeRequirement | null;
  institution: string;
}) {
  const state = course?.state ?? "open";
  const status = requirement ? requirementStatus(requirement) : null;
  const videos = catalog.relatedVideos ?? [];
  const [videoIndex, setVideoIndex] = useState(0);
  const video = videos[videoIndex] ?? videos[0];
  const embedUrl = video ? youtubeEmbedUrl(video.url) : null;
  const terms = catalog.availabilityLabel ?? course?.terms ?? "Availability not yet published";

  return (
    <>
      <div className={`drawer-icon course ${state}`}>
        <Icon weight="duotone" name={state === "approved" ? "check" : "book"} size={25} />
      </div>
      <h2 id="academic-drawer-title">
        {catalog.code} · {catalog.title}
      </h2>
      <p className="drawer-description">
        {catalog.credits} credits · {terms}. {catalog.description}
        {requirement
          ? ` This course is one of the ways ${institution} lets you satisfy ${requirement.name}.`
          : null}
      </p>

      {requirement ? (
        <div className="why-card">
          <span>
            <Icon name="book" size={17} />
          </span>
          <div>
            <strong>Where this fits</strong>
            <p>
              {requirement.name} ·{" "}
              {requirement.creditsApproved == null
                ? "credits pending sync"
                : `${requirement.creditsApproved} of ${requirement.creditsRequired} credits approved`}
              {status === "satisfied" ? ". This requirement is already satisfied." : "."}
            </p>
          </div>
        </div>
      ) : null}

      {course?.state === "approved" ? (
        <div className="evidence-panel approved">
          <span className="evidence-kicker">
            <Icon name="shield" size={15} /> Credit approved
          </span>
          <p>
            <strong>{course.evidence}</strong>
          </p>
          <p>Recorded by the {institution} Registrar. This one is decided. It counts toward your degree.</p>
        </div>
      ) : null}

      {course?.state === "locked" ? (
        <div className="evidence-panel locked">
          <span className="evidence-kicker">
            <Icon name="lock" size={15} /> Not open to you yet
          </span>
          <p>
            You need <strong>{course.prerequisite}</strong> first. It opens as soon as that is on
            your record.
          </p>
        </div>
      ) : null}

      {course?.state === "open" && course.prerequisite && course.prerequisiteMet ? (
        <div className="evidence-panel">
          <span className="evidence-kicker">
            <Icon name="check" size={15} /> Prerequisite met
          </span>
          <p>
            This course asks for <strong>{course.prerequisite}</strong>, and you already have it.
          </p>
        </div>
      ) : null}

      {!course && catalog.prerequisites.length > 0 ? (
        <div className="evidence-panel">
          <span className="evidence-kicker">
            <Icon name="lock" size={15} /> Prerequisites
          </span>
          <p>
            {catalog.prerequisites
              .map((prerequisite) =>
                prerequisite.minimumGrade
                  ? `${prerequisite.courseCode} (minimum grade ${prerequisite.minimumGrade})`
                  : prerequisite.courseCode,
              )
              .join(", ")}
          </p>
        </div>
      ) : null}

      <section className="evidence-block">
        <h3 className="evidence-kicker">In the catalog</h3>
        <dl className="evidence-facts">
          <div>
            <dt>Offered</dt>
            <dd>{catalog.availabilityLabel ?? "Confirm with the Registrar"}</dd>
          </div>
          <div>
            <dt>Taught by</dt>
            <dd>
              {catalog.instructorNames?.length
                ? catalog.instructorNames.join(", ")
                : "Not yet published"}
            </dd>
          </div>
          <div>
            <dt>Meets</dt>
            <dd>{catalog.meetingPattern ?? "Not yet published"}</dd>
          </div>
          {catalog.prerequisites.length > 0 ? (
            <div>
              <dt>Requires</dt>
              <dd>
                {catalog.prerequisites
                  .map((prerequisite) =>
                    prerequisite.minimumGrade
                      ? `${prerequisite.courseCode} · minimum grade ${prerequisite.minimumGrade}`
                      : prerequisite.courseCode,
                  )
                  .join(", ")}
              </dd>
            </div>
          ) : null}
        </dl>
        {catalog.source ? (
          <a
            className="text-button evidence-link"
            href={catalog.source.url}
            target="_blank"
            rel="noreferrer"
          >
            {catalog.source.label} <Icon name="external" size={14} />
          </a>
        ) : null}
      </section>

      {video && embedUrl ? (
        <section className="evidence-block course-media" aria-labelledby="course-video-title">
          <h3 className="evidence-kicker" id="course-video-title">
            Related course video
            {videos.length > 1 ? (
              <span className="course-media-count">
                {videoIndex + 1} / {videos.length}
              </span>
            ) : null}
          </h3>
          <div className="course-media-frame">
            <iframe
              src={embedUrl}
              title={video.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <div className="course-media-copy">
            <strong>{video.title}</strong>
            {video.description ? <p>{video.description}</p> : null}
            <small>{video.sourceLabel ?? video.provider}</small>
          </div>
          <div className="course-media-actions">
            {videos.length > 1 ? (
              <>
                <Button
                  kind="secondary"
                  onClick={() =>
                    setVideoIndex((current) => (current - 1 + videos.length) % videos.length)
                  }
                >
                  Previous
                </Button>
                <Button
                  kind="secondary"
                  onClick={() => setVideoIndex((current) => (current + 1) % videos.length)}
                >
                  Next
                </Button>
              </>
            ) : null}
            <a className="text-button" href={video.url} target="_blank" rel="noreferrer">
              Open on YouTube <Icon name="external" size={14} />
            </a>
          </div>
        </section>
      ) : null}

      {catalog.resources?.length ? (
        <section className="evidence-block" aria-labelledby="course-resource-title">
          <h3 className="evidence-kicker" id="course-resource-title">
            Relevant resources
          </h3>
          <ul className="course-resources">
            {catalog.resources.map((resource, index) => (
              <li key={resource.id || `${resource.url}-${index}`} className="rule-card">
                <span className="rule-code">{resource.format.toUpperCase()}</span>
                <p>
                  <strong>{resource.title}</strong>
                  {resource.description ? <> — {resource.description}</> : null}
                </p>
                <span className="rule-source">
                  {resource.provider} · {resource.licenseLabel}
                </span>
                <a className="text-button evidence-link" href={resource.url} target="_blank" rel="noreferrer">
                  Open PDF <Icon name="external" size={14} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="help-note">
        <Icon name="info" size={18} />
        <p>
          <strong>This is catalog information.</strong> Registering for a course happens in{" "}
          {institution}’s student system, not here.
        </p>
      </div>
    </>
  );
}

function EvidenceBody({
  match,
  registrar,
  onAsk,
  onClose,
  onOpenCredit,
}: {
  match: CreditMatch;
  registrar: string;
  onAsk: (match: CreditMatch) => void;
  onClose: () => void;
  onOpenCredit: () => void;
}) {
  return (
    <>
      <div className="drawer-icon match">
        <Icon weight="duotone" name="alert" size={25} />
      </div>
      <h2 id="academic-drawer-title">
        {match.target.courseCode} · {match.target.courseTitle}
      </h2>
      <p className="drawer-description">
        {match.evidence.document}, issued by {match.evidence.source}.
      </p>

      <section className="evidence-block">
        <h3 className="evidence-kicker">What was read</h3>
        <dl className="evidence-facts">
          <div>
            <dt>Document</dt>
            <dd>{match.evidence.document}</dd>
          </div>
          <div>
            <dt>Issued by</dt>
            <dd>{match.evidence.source}</dd>
          </div>
          <div>
            <dt>Read</dt>
            <dd>{match.evidence.detail}</dd>
          </div>
          <div>
            <dt>Might cover</dt>
            <dd>
              {match.target.courseCode} · {match.target.credits} credits toward{" "}
              {match.target.requirementName}
            </dd>
          </div>
        </dl>
      </section>

      <section className="evidence-block">
        <h3 className="evidence-kicker">The rule that applies</h3>
        <div className="rule-card">
          <span className="rule-code">Rule {match.rule.code}</span>
          <p>{match.rule.text}</p>
          <span className="rule-source">
            A versioned credit policy, published by the {registrar} — not free-form AI.
          </span>
        </div>
        <div className="confidence-panel">
          <span className={`confidence-chip ${match.confidence}`}>
            <Icon name={confidenceIcon(match.confidence)} size={12} />
            {confidenceLabel(match.confidence)}
          </span>
          <p>{match.confidenceNote}</p>
        </div>
      </section>

      <section className="evidence-block">
        <h3 className="evidence-kicker">Who decides</h3>
        <p className="evidence-decision">
          The {registrar} reviews this and decides. Nothing changes on your degree until they do.
        </p>
        <p className="evidence-meanwhile">
          <strong>Meanwhile.</strong> {match.advice}
        </p>
        <button type="button" className="text-button" onClick={onOpenCredit}>
          How credit is approved
        </button>
      </section>

      <div className="drawer-actions">
        <Button kind="secondary" onClick={() => onAsk(match)}>
          Ask the Registrar
        </Button>
        <Button kind="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </>
  );
}
