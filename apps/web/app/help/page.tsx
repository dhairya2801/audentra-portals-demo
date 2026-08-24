"use client";

import type { HelpArticle, StudentHelpRequest } from "@vv/contracts";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PortalShell } from "../components/portal-shell";
import { useTenant } from "../components/tenant-provider";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import { createStudentHelpRequest, createStudentInquiryMessage, getStudentHelp } from "../lib/api-client";
import Notice from "../design-system/patterns/Notice.jsx";
import PageError from "../design-system/patterns/PageError.jsx";
import PageSkeleton from "../design-system/patterns/PageSkeleton.jsx";
import ToastStack from "../design-system/patterns/Toast.jsx";
import { useToasts } from "../design-lib/toast.js";
import { onHandoff, takeHandoff } from "../design-lib/door.js";
import { HelpAskCard } from "../components/help-ask-card";
import { HelpGuideList } from "../components/help-guide-list";
import { HelpRail } from "../components/help-rail";
import { HelpRequestDrawer } from "../components/help-request-drawer";
import { HelpRequestList } from "../components/help-request-list";
import {
  guideFor,
  helpTopics,
  officeName,
  openRequests,
  sortRequests,
  waitingOnYou,
} from "../components/help-logic";

/**
 * Help — the reference's `HelpPage` over the production help projection. A question, once sent,
 * becomes an object with a state the student can come back to, which is why the receipt and the
 * request list are built here as one thing. Guides are on the page because most questions do not
 * need a decision; the ask block is under them because some do.
 */

function isTopic(value: unknown): value is HelpArticle["category"] {
  return helpTopics.some((topic) => topic.id === value);
}

function heroLede({ institution, open, waiting }: { institution: string; open: number; waiting: StudentHelpRequest | null }) {
  if (waiting) {
    return `One of your requests is waiting on you. Below it: ${institution}’s own guides, and a way to put a named office on a step that is blocked.`;
  }
  if (open === 0) {
    return `${institution}’s own guides, and a way to put a named office on a step that is blocked.`;
  }
  return `${open === 1 ? "One question is" : `${open} questions are`} with ${institution}, and every answer lands on this page. Below are ${institution}’s guides, and a way to reach the office that owns a step.`;
}

function HelpPageContent() {
  const runtime = useTenant();
  const { tenant } = runtime;
  const support = tenant.contacts.support;
  const office = officeName(support);
  const institution = tenant.shortName;
  const searchParams = useSearchParams();
  const selectedConversationId = searchParams.get("conversation");

  const help = useApiResource(useCallback((signal: AbortSignal) => getStudentHelp(signal), []));
  const refreshHelp = help.refresh;
  const send = useApiAction(createStudentHelpRequest);
  const reply = useApiAction(createStudentInquiryMessage);
  const { toasts, push, dismiss } = useToasts();

  const [topicId, setTopicId] = useState<HelpArticle["category"] | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<StudentHelpRequest | null>(null);
  const [askGuideOpen, setAskGuideOpen] = useState(false);
  const [openGuides, setOpenGuides] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(selectedConversationId);
  const [replyText, setReplyText] = useState("");
  const [now] = useState(() => Date.now());

  const askCard = useRef<HTMLDivElement>(null);
  const sendKey = useRef<string | null>(null);

  useEffect(() => {
    // The stream only invalidates local state; the REST projection remains canonical. Refreshing
    // this lightweight view for every student event avoids missing a support reply.
    const refreshAfterStudentEvent = () => refreshHelp();
    window.addEventListener("vv:student-realtime", refreshAfterStudentEvent);
    return () => window.removeEventListener("vv:student-realtime", refreshAfterStudentEvent);
  }, [refreshHelp]);

  const focusAsk = useCallback(() => {
    askCard.current?.scrollIntoView({ block: "center" });
    askCard.current?.querySelector<HTMLElement>("button, input")?.focus();
  }, []);

  // An inquiry that started in Edward arrives with what she already said. Read once, then gone.
  useEffect(() => {
    function consume() {
      const handoff = takeHandoff("inquiry");
      if (!handoff) return;
      const question = typeof handoff.question === "string" ? handoff.question : "";
      setTopicId(isTopic(handoff.topicId) ? handoff.topicId : "support");
      setSubject(question.slice(0, 80));
      setMessage(
        question
          ? `${question}\n\nI asked Edward first${typeof handoff.context === "string" ? `, from ${handoff.context}` : ""}, and it didn’t settle it.`
          : "",
      );
      window.setTimeout(focusAsk, 0);
    }
    consume();
    return onHandoff(consume);
  }, [focusAsk]);

  const articles = help.data?.articles ?? [];
  const requests = sortRequests(help.data?.requests ?? []);
  const open = openRequests(requests);
  const waiting = waitingOnYou(requests);
  const openRequest = requests.find((item) => item.id === openId) ?? null;
  const guide = topicId ? guideFor(articles, topicId) : null;

  function chooseTopic(next: HelpArticle["category"]) {
    setTopicId(next);
    setAskGuideOpen(false);
    setFailed(null);
  }

  async function sendRequest() {
    if (!topicId) return;
    setFailed(null);
    const key = sendKey.current ?? (sendKey.current = crypto.randomUUID());
    const body = [subject.trim(), message.trim()].filter(Boolean).join("\n\n").slice(0, 500);
    try {
      const created = await send.run({ topicCode: topicId, message: body }, key);
      sendKey.current = null;
      setReceipt(created);
      setSubject("");
      setMessage("");
      setAskGuideOpen(false);
      push({ tone: "success", title: `${office} has your question.`, body: "The answer lands on this page." });
      refreshHelp();
    } catch {
      // Nothing arrived, so nothing is created: the words are still in the form.
      setFailed(send.message ?? "");
    }
  }

  function askAnother() {
    setReceipt(null);
    setTopicId(null);
    setFailed(null);
    focusAsk();
  }

  function openDetail(request: StudentHelpRequest) {
    setReplyText("");
    reply.reset();
    setOpenId(request.id);
  }

  function closeDetail() {
    setOpenId(null);
    setReplyText("");
  }

  async function sendReply() {
    if (!openRequest) return;
    const reopening = openRequest.status === "resolved";
    try {
      await reply.run(openRequest.id, { expectedVersion: openRequest.version, body: replyText.trim() }, crypto.randomUUID());
      setReplyText("");
      push(reopening ? `Reopened. This is back with ${office}.` : `${office} has your reply.`);
      refreshHelp();
    } catch {
      // The text stays in the box; the drawer shows the student-safe error.
    }
  }

  const requestList = (
    <HelpRequestList
      requests={requests}
      open={open.length}
      office={office}
      tenant={tenant}
      now={now}
      institution={institution}
      onOpen={openDetail}
      onAsk={focusAsk}
    />
  );

  const askBlock = (
    <div ref={askCard}>
      <HelpAskCard
        topic={topicId}
        subject={subject}
        message={message}
        sending={send.status === "loading"}
        failed={failed}
        receipt={receipt}
        guide={guide}
        guideOpen={askGuideOpen}
        support={support}
        institution={institution}
        onTopic={chooseTopic}
        onSubject={setSubject}
        onMessage={setMessage}
        onToggleGuide={() => setAskGuideOpen((value) => !value)}
        onSend={sendRequest}
        onSeeRequest={() => receipt && openDetail(receipt)}
        onAskAnother={askAnother}
      />
    </div>
  );

  // The page opens on what exists: the list leads when there is one.
  const leadWithList = requests.length > 0;

  return (
    <PortalShell
      active="help"
      hero={{ lede: heroLede({ institution, open: open.length, waiting }) }}
      notice={
        waiting ? (
          <Notice
            tone="soon"
            icon="alert"
            title={`${office} asked you something`}
            action={{ label: "Open it", onClick: () => openDetail(waiting) }}
          >
            {waiting.subject} · nothing is late while this is open, but it stops moving until you reply.
          </Notice>
        ) : null
      }
      rail={<HelpRail support={support} institution={institution} href={runtime.href} />}
    >
      {help.status === "loading" ? (
        <PageSkeleton label={`${institution} help`} />
      ) : help.status === "error" ? (
        <PageError label="help" onRetry={help.reload} />
      ) : (
        <>
          {leadWithList ? (
            <>
              {requestList}
              {askBlock}
            </>
          ) : (
            <>
              {askBlock}
              {requestList}
            </>
          )}

          <HelpGuideList
            guides={articles}
            open={openGuides}
            institution={institution}
            onToggle={(id) =>
              setOpenGuides((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
            }
          />
        </>
      )}

      {openRequest && (
        <HelpRequestDrawer
          request={openRequest}
          office={office}
          tenant={tenant}
          institution={institution}
          replyText={replyText}
          sending={reply.status === "loading"}
          error={reply.status === "error" ? reply.message : null}
          onReply={setReplyText}
          onSend={sendReply}
          onClose={closeDetail}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </PortalShell>
  );
}

export default function HelpPage() {
  return (
    <Suspense fallback={<PageSkeleton label="help" />}>
      <HelpPageContent />
    </Suspense>
  );
}
