"use client";

import type { StudentHelpRequest } from "@vv/contracts";
import {
  Suspense,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { PortalShell } from "../components/portal-shell";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageCard,
} from "../components/portal-ui";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  createStudentHelpRequest,
  createStudentInquiryMessage,
  getStudentHelp,
} from "../lib/api-client";

const categoryLabels = {
  all: "All topics",
  getting_started: "Getting started",
  documents: "Documents",
  payments: "Payments",
  support: "Support",
} as const;

type HelpCategory = keyof typeof categoryLabels;

function StudentInquiryForm({ onSent }: { onSent: () => void }) {
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
      onSent();
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

function InquiryThread({
  request,
  onUpdated,
  openByDefault,
}: {
  request: StudentHelpRequest;
  onUpdated: () => void;
  openByDefault: boolean;
}) {
  const reply = useApiAction(createStudentInquiryMessage);
  const [sent, setSent] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(false);
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (!body) return;
    try {
      await reply.run(
        request.id,
        { expectedVersion: request.version, body },
        crypto.randomUUID(),
      );
      form.reset();
      setSent(true);
      onUpdated();
    } catch {
      // Keep the student's text in the form. The action exposes a safe error.
    }
  };
  return (
    <details
      className="student-support-thread"
      open={openByDefault || request.status === "waiting_on_student"}
    >
      <summary>
        <span>
          <strong>{request.subject}</strong>
          <small>
            Updated {new Date(request.updatedAt).toLocaleString()}
            {request.expiresAt
              ? ` · active until ${new Date(request.expiresAt).toLocaleString()}`
              : ""}
          </small>
        </span>
        <span className={`student-support-status student-support-status--${request.status}`}>
          {request.status.replaceAll("_", " ")}
        </span>
      </summary>
      <ol className="student-support-messages">
        {request.messages.map((message) => (
          <li
            className={
              message.direction === "student"
                ? "student-support-message student-support-message--student"
                : "student-support-message student-support-message--staff"
            }
            key={message.id}
          >
            <div><strong>{message.authorName}</strong><time>{new Date(message.createdAt).toLocaleString()}</time></div>
            <p>{message.body}</p>
            <small>{message.deliveryStatus}</small>
          </li>
        ))}
      </ol>
      <form className="student-support-reply" onSubmit={submit}>
        <label>
          Reply to the enrollment team
          <textarea name="body" required minLength={1} maxLength={2_000} />
        </label>
        <p>
          Replies are saved immediately. This live conversation remains active for five days
          after the latest message; after that it leaves active inboxes while its history stays
          safely protected.
        </p>
        {reply.message ? <p className="field-error" role="alert">{reply.message}</p> : null}
        {sent ? <p className="student-inquiry-form__success" role="status">Reply sent.</p> : null}
        <button className="button button--primary" type="submit" disabled={reply.status === "loading"}>
          {reply.status === "loading" ? "Sending..." : "Send reply"}
        </button>
      </form>
    </details>
  );
}

function HelpPageContent() {
  const [category, setCategory] = useState<HelpCategory>("all");
  const searchParams = useSearchParams();
  const selectedConversationId = searchParams.get("conversation");
  const loadHelp = useCallback(
    (signal: AbortSignal) => getStudentHelp(signal),
    [],
  );
  const help = useApiResource(loadHelp);
  const refreshHelp = help.refresh;
  useEffect(() => {
    // The stream only invalidates local state; the REST projection remains
    // canonical. Refreshing this lightweight view for every student event
    // avoids missing a support reply when a provider evolves its event shape.
    const refreshAfterStudentEvent = () => refreshHelp();
    window.addEventListener("vv:student-realtime", refreshAfterStudentEvent);
    return () => window.removeEventListener("vv:student-realtime", refreshAfterStudentEvent);
  }, [refreshHelp]);
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
          <div className="resource-main student-support-main">
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
            {help.data.requests.length > 0 ? (
              <PageCard eyebrow="Your support history" title="Enrollment conversations">
                <p className="student-support-live-status" role="status">
                  Live updates are on. New team replies appear here without refreshing the page.
                </p>
                <div className="student-support-threads">
                  {help.data.requests.map((request) => (
                    <InquiryThread
                      request={request}
                      onUpdated={help.refresh}
                      openByDefault={request.id === selectedConversationId}
                      key={request.id}
                    />
                  ))}
                </div>
              </PageCard>
            ) : null}
          </div>
          <aside className="resource-aside">
            <StudentInquiryForm onSent={help.refresh} />
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

export default function HelpPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading Aster help" />}>
      <HelpPageContent />
    </Suspense>
  );
}
