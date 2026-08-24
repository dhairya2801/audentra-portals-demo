"use client";

import type { HelpArticle } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import { topicLabel } from "./help-logic";

/**
 * What the institution has already published — the reference's `GuideList`: a plain accordion of
 * topics, no thumbnails. Every guide names the topic it is published under; the backend records
 * no publishing office or date, so neither is drawn.
 */
export function HelpGuideList({
  guides,
  open,
  institution,
  onToggle,
}: {
  guides: HelpArticle[];
  open: string[];
  institution: string;
  onToggle: (id: string) => void;
}) {
  return (
    <section className="section-card" aria-labelledby="guides-heading">
      <div className="status-heading">
        <span className="status-icon accent" aria-hidden="true">
          <Icon name="book" size={20} />
        </span>
        <div>
          <h2 id="guides-heading">{institution}’s guides</h2>
          <p>Answered in advance</p>
        </div>
        <span className="result-count">
          {guides.length} {guides.length === 1 ? "guide" : "guides"}
        </span>
      </div>

      <div className="card-rows guide-rows">
        {guides.map((guide) => {
          const expanded = open.includes(guide.id);
          return (
            <div className="guide-row" key={guide.id}>
              <button
                className="guide-toggle"
                aria-expanded={expanded}
                aria-controls={`guide-${guide.id}`}
                onClick={() => onToggle(guide.id)}
              >
                <span className="task-type-icon guide" aria-hidden="true">
                  <Icon name="book" size={21} weight="duotone" />
                </span>
                <span>
                  <strong>{guide.question}</strong>
                  <span className="guide-office">{topicLabel(guide.category)}</span>
                </span>
                <span className={`guide-chevron ${expanded ? "open" : ""}`} aria-hidden="true">
                  <Icon name="chevron" size={18} />
                </span>
              </button>

              {expanded && (
                <div className="guide-body" id={`guide-${guide.id}`}>
                  <p>{guide.answer}</p>
                  <p className="guide-source">Published by {institution}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
