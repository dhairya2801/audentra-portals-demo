"use client";

import { type FormEvent, useCallback, useMemo, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageCard,
} from "../components/portal-ui";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import { createStudentHelpRequest, getStudentHelp } from "../lib/api-client";

const categoryLabels = {
  all: "All topics",
  getting_started: "Getting started",
  documents: "Documents",
  payments: "Payments",
  support: "Support",
} as const;

type HelpCategory = keyof typeof categoryLabels;

function StudentInquiryForm() {
  const action = useApiAction(createStudentHelpRequest);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(false);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await action.run(
        {
          topicCode: data.get("topicCode") as Exclude<HelpCategory, "all">,
          message: String(data.get("message")),
        },
        crypto.randomUUID(),
      );
      form.reset();
      setSent(true);
    } catch {
      // The action state provides the student-safe error.
    }
  };

  return (
    <PageCard eyebrow="Ask the enrollment team" title="Send an inquiry">
      <form className="student-inquiry-form" onSubmit={submit}>
        <label>
          Topic
          <select name="topicCode" defaultValue="support">
            <option value="getting_started">Getting started</option>
            <option value="documents">Documents</option>
            <option value="payments">Payments</option>
            <option value="support">Other support</option>
          </select>
        </label>
        <label>
          Your question
          <textarea
            name="message"
            minLength={1}
            maxLength={500}
            placeholder="Tell us what you need help with."
            required
          />
        </label>
        {action.message ? (
          <p className="field-error" role="alert">
            {action.message}
          </p>
        ) : null}
        {sent ? (
          <p className="student-inquiry-form__success" role="status">
            Your inquiry is now in the staff message portal.
          </p>
        ) : null}
        <button
          className="button button--primary"
          type="submit"
          disabled={action.status === "loading"}
        >
          {action.status === "loading" ? "Sending…" : "Send inquiry"}
        </button>
      </form>
    </PageCard>
  );
}

export default function HelpPage() {
  const [category, setCategory] = useState<HelpCategory>("all");
  const loadHelp = useCallback(
    (signal: AbortSignal) => getStudentHelp(signal),
    [],
  );
  const help = useApiResource(loadHelp);
  const articles = useMemo(
    () =>
      help.data?.articles.filter(
        (article) => category === "all" || article.category === category,
      ) || [],
    [category, help.data],
  );

  return (
    <PortalShell
      active="help"
      eyebrow="Student support"
      title="How can we help?"
      description="Plain-language answers and human support for every part of your Aster journey."
    >
      {help.status === "loading" ? (
        <LoadingState label="Loading Aster help" />
      ) : help.status === "error" ? (
        <ErrorState message={help.error} onRetry={help.reload} />
      ) : (
        <div className="resource-layout">
          <PageCard eyebrow="Knowledge center" title="Frequently asked questions">
            <div className="filter-chips" aria-label="Filter help topics">
              {(Object.keys(categoryLabels) as HelpCategory[]).map((key) => (
                <button
                  className={category === key ? "filter-chip--active" : undefined}
                  type="button"
                  aria-pressed={category === key}
                  onClick={() => setCategory(key)}
                  key={key}
                >
                  {categoryLabels[key]}
                </button>
              ))}
            </div>
            {articles.length === 0 ? (
              <EmptyState
                title="No articles in this topic"
                description="Choose another topic or contact the Aster support team."
              />
            ) : (
              <div className="faq-list">
                {articles.map((article) => (
                  <details key={article.id}>
                    <summary>{article.question}</summary>
                    <p>{article.answer}</p>
                  </details>
                ))}
              </div>
            )}
          </PageCard>
          <aside className="resource-aside">
            <StudentInquiryForm />
            <div className="support-card">
              <span className="support-card__mark" aria-hidden="true">A</span>
              <p className="eyebrow">Talk with a person</p>
              <h2>Student support</h2>
              <p>{help.data.support.hours}</p>
              <a
                className="button button--light"
                href={`mailto:${help.data.support.email}`}
              >
                Email support
              </a>
              <a href={`tel:${help.data.support.phone.replace(/[^\d+]/g, "")}`}>
                {help.data.support.phone}
              </a>
            </div>
            <PageCard title="More ways to connect">
              <nav className="aside-links" aria-label="Support options">
                <a href={`mailto:${help.data.support.email}`}>
                  {help.data.support.email} <span>→</span>
                </a>
                <a href={`tel:${help.data.support.phone.replace(/[^\d+]/g, "")}`}>
                  Call student support <span>→</span>
                </a>
              </nav>
            </PageCard>
          </aside>
        </div>
      )}
    </PortalShell>
  );
}
