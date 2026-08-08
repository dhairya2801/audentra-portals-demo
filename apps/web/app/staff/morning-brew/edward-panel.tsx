"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { answerEdward, EDWARD_SUGGESTIONS } from "./data";
import type { BrewBriefing, EdwardAnswer, EdwardRequest } from "./types";

const MODE_LABELS: Record<EdwardRequest["mode"], string> = {
  ask: "Briefing context attached",
  summarize: "Summarizing",
  insights: "Reading the signals",
  draft_reply: "Drafting a reply",
  prep: "Meeting preparation",
};

export function EdwardPanel({
  request,
  briefing,
  onClose,
}: {
  request: EdwardRequest | null;
  briefing: BrewBriefing;
  onClose: () => void;
}) {
  const [thread, setThread] = useState<EdwardAnswer[]>([]);
  const [question, setQuestion] = useState("");
  const [copied, setCopied] = useState(false);
  const [seededRequest, setSeededRequest] = useState(request);
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  // Each launch seeds a fresh conversation. Adjusting during render rather than
  // in an effect avoids rendering the previous answer for a frame.
  if (request !== seededRequest) {
    setSeededRequest(request);
    setThread(request ? [answerEdward(request, briefing)] : []);
    setQuestion("");
    setCopied(false);
  }

  useEffect(() => {
    if (!request) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 140);
    return () => window.clearTimeout(focusTimer);
  }, [request]);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" });
  }, [thread]);

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, onClose]);

  if (!request) return null;

  const ask = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setThread((current) => [
      ...current,
      answerEdward({ mode: "ask", context: request.context, question: trimmed }, briefing),
    ]);
    setQuestion("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(question);
  };

  const copyDraft = async (answer: EdwardAnswer) => {
    if (!answer.draft) return;
    const text = [answer.draft.subject, "", ...answer.draft.body].join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard access can be blocked; the draft stays visible for manual copy.
    }
  };

  return (
    <div
      className="brew-edward-layer"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside className="brew-edward" role="dialog" aria-modal="true" aria-labelledby="brew-edward-title">
        <header>
          <span className="brew-edward__mark" aria-hidden="true">
            E<i />
          </span>
          <div>
            <p>Executive copilot</p>
            <h2 id="brew-edward-title">Edward</h2>
          </div>
          <button type="button" aria-label="Close Edward" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="brew-edward__context">
          <span>{MODE_LABELS[request.mode]}</span>
          <p>
            {request.context ? `On: ${request.context}. ` : ""}Edward answers from today&rsquo;s Morning Brew.
            Responses are deterministic synthetic demos and never reach the production assistant.
          </p>
        </div>

        <div className="brew-edward__conversation" aria-live="polite" ref={conversationRef}>
          {thread.map((answer, index) => (
            <div key={`${answer.question}-${index}`}>
              <div className="brew-edward__question">{answer.question}</div>
              <article className="brew-edward__answer">
                <span className="brew-edward__mini-mark" aria-hidden="true">
                  E
                </span>
                <div>
                  <p>{answer.answer}</p>
                  {answer.bullets?.length ? (
                    <ul>
                      {answer.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}

                  {answer.draft ? (
                    <div className="brew-edward__draft">
                      <header>
                        <span>Draft reply</span>
                        <button type="button" onClick={() => void copyDraft(answer)}>
                          {copied ? "Copied ✓" : "Copy draft"}
                        </button>
                      </header>
                      <p className="brew-edward__draft-subject">{answer.draft.subject}</p>
                      {answer.draft.body.map((paragraph, paragraphIndex) => (
                        <p key={`${paragraphIndex}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
                      ))}
                    </div>
                  ) : null}

                  {answer.followUp ? <aside>{answer.followUp}</aside> : null}
                </div>
              </article>
            </div>
          ))}
        </div>

        <div className="brew-edward__suggestions">
          <span>Try asking</span>
          {EDWARD_SUGGESTIONS.map((item) => (
            <button type="button" onClick={() => ask(item)} key={item}>
              {item}
            </button>
          ))}
        </div>

        <form className="brew-edward__composer" onSubmit={submit}>
          <input
            ref={inputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about today's briefing…"
            aria-label="Ask Edward"
          />
          <button type="submit" disabled={!question.trim()} aria-label="Send question">
            ↑
          </button>
        </form>
      </aside>
    </div>
  );
}
