import { type FormEvent, useEffect, useRef, useState } from "react";
import { answerEdward, EDWARD_SUGGESTIONS } from "./data";
import type { MorningBrewBriefing } from "./types";

export function EdwardPanel({ open, briefing, onClose }: { open: boolean; briefing: MorningBrewBriefing; onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(() => answerEdward(EDWARD_SUGGESTIONS[0], briefing));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  const ask = (value: string) => {
    if (!value.trim()) return;
    setAnswer(answerEdward(value.trim(), briefing));
    setQuestion("");
  };
  const submit = (event: FormEvent) => { event.preventDefault(); ask(question); };

  if (!open) return null;
  return (
    <div className="brew-edward-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="brew-edward" role="dialog" aria-modal="true" aria-labelledby="brew-edward-title">
        <header><span className="brew-edward__mark">E<i /></span><div><p>Executive copilot</p><h2 id="brew-edward-title">Talk with Edward</h2></div><button type="button" aria-label="Close Edward" onClick={onClose}>×</button></header>
        <div className="brew-edward__context"><span>Briefing context attached</span><p>Edward is answering from today’s Morning Brew. Responses are deterministic synthetic demos and never reach the real Edward backend.</p></div>
        <div className="brew-edward__conversation" aria-live="polite">
          <div className="brew-edward__question">{answer.question}</div>
          <article className="brew-edward__answer"><span className="brew-edward__mini-mark">E</span><div><p>{answer.answer}</p>{answer.bullets ? <ul>{answer.bullets.map((item) => <li key={item}>{item}</li>)}</ul> : null}{answer.followUp ? <aside>{answer.followUp}</aside> : null}</div></article>
        </div>
        <div className="brew-edward__suggestions"><span>Try asking</span>{EDWARD_SUGGESTIONS.map((item) => <button type="button" onClick={() => ask(item)} key={item}>{item}</button>)}</div>
        <form className="brew-edward__composer" onSubmit={submit}><input ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about today’s briefing…" aria-label="Ask Edward"/><button type="submit" disabled={!question.trim()} aria-label="Send question">↑</button></form>
      </aside>
    </div>
  );
}
