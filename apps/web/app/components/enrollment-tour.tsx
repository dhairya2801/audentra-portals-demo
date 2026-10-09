"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../design-system/Icon.jsx";

const steps = [
  { target: ".momentum-card", icon: "spark", title: "Your progress has perks.", label: "Your momentum", copy: "This is your live points balance. Complete enrollment steps to build momentum and see how close you are to your next bookstore reward.", hint: "After the tour, try “How points work” to explore your rewards." },
  { target: ".sort-group", icon: "flow", title: "Find your next best step.", label: "Your checklist", copy: "Smart order brings important deadlines and steps that unlock other tasks to the top. Switch to Due soon or Fastest to find what fits your day.", hint: "You stay in control of where you start." },
  { target: ".enrollment-task", icon: "checklist", title: "Know before you begin.", label: "Inside each step", copy: "Your task shows what is needed, the deadline and your next action. Open How this works to see what to prepare and what happens after you submit.", hint: "University review time is separate from your task’s time estimate." },
  { target: ".enrollment-month", icon: "calendar", title: "Keep important dates in view.", label: "Your calendar", copy: "Your enrollment calendar brings upcoming deadlines together. Choose a marked day, then a task, to see exactly what to prepare.", hint: "Use the month arrows to look ahead." },
  { target: ".enrollment-task .task-help-actions", icon: "spark", title: "A little help, right here.", label: "Meet Edward", copy: "The E opens Edward with this task’s context already included. Ask about a document, a requirement or the next step without starting from scratch.", hint: "The floating Ask Edward button is always there for broader questions." },
  { target: ".enrollment-adviser", icon: "users", title: "A real person in your corner.", label: "Your enrollment contact", copy: "Call, email or book a meeting with your enrollment contact from this card. When a step feels unclear, you have someone to turn to.", hint: "You can replay this tour whenever you need a refresher." },
];
type Layout = { x: number; y: number; width: number; height: number; cardX: number; cardY: number; side: string };

/** A view over the actual enrollment page, with no copied records or mutations. */
export function EnrollmentTour({ onClose }: { onClose: () => void }) {
  const [available] = useState(() => steps.filter(step => document.querySelector(step.target)));
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<Layout | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const step = available[index];


  useLayoutEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    const originalY = window.scrollY;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    element?.showModal();
    close.current?.focus({ preventScroll: true });
    return () => {
      element?.close();
      document.documentElement.style.overflow = overflow;
      window.scrollTo({ top: originalY, behavior: "instant" });
      opener?.focus({ preventScroll: true });
    };
  }, []);

  useLayoutEffect(() => {
    const target = step && document.querySelector<HTMLElement>(step.target);
    if (!target) return;
    let frame = 0;
    let aligned = false;
    const position = () => {
      if (!card.current) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const rect = target.getBoundingClientRect();
      const cw = card.current.offsetWidth, ch = card.current.offsetHeight;
      const small = vw < 700;
      const x = Math.max(8, rect.left - 7), y = Math.max(76, rect.top - 7);
      const right = Math.min(vw - 8, rect.right + 7);
      let cardX = 12, cardY = vh - ch - 12, side = "below";
      if (!small) {
        if (x - cw - 22 >= 16) { cardX = x - cw - 22; cardY = y; side = "left"; }
        else if (right + cw + 22 < vw - 16) { cardX = right + 22; cardY = y; side = "right"; }
        else if (rect.bottom + ch + 24 < vh) { cardX = x; cardY = rect.bottom + 22; }
        else if (y - ch - 22 > 76) { cardX = x; cardY = y - ch - 22; side = "above"; }
        else { cardX = Math.max(16, vw - cw - 16); }
      }
      cardX = Math.max(12, Math.min(cardX, vw - cw - 12));
      cardY = Math.max(12, Math.min(cardY, vh - ch - 12));
      const bottom = Math.min(rect.bottom + 7, small ? cardY - 14 : vh - 12);
      setLayout({ x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y), cardX, cardY, side });
    };
    const align = () => {
      const rect = target.getBoundingClientRect();
      const small = window.innerWidth < 700;
      const cardHeight = card.current?.offsetHeight ?? 300;
      const desiredTop = small ? 88 : Math.max(95, Math.min(160, (window.innerHeight - Math.min(rect.height, 450)) / 2));
      const top = window.scrollY + rect.top - desiredTop;
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
      // For short landscape viewports, keep the spotlight above the bottom card.
      if (small && window.innerHeight - cardHeight < 160) target.scrollIntoView({ block: "start", behavior: "instant" });
      position();
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { if (!aligned) { aligned = true; align(); } else position(); }); };
    schedule();
    const resized = () => { aligned = false; schedule(); };
    const observer = new ResizeObserver(resized);
    observer.observe(target);
    if (card.current) observer.observe(card.current);
    window.addEventListener("resize", resized);
    window.addEventListener("scroll", schedule, true);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", resized); window.removeEventListener("scroll", schedule, true); };
  }, [step]);

  if (!step) return null;
  return createPortal(
    <dialog ref={dialog} className="enrollment-walkthrough" aria-label="Your enrollment tour" onKeyDown={event => {
      if (event.key !== "Tab") return;
      const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} onCancel={event => { event.preventDefault(); onClose(); }}>
      {layout && <div className="walkthrough-spotlight" aria-hidden="true" style={{ left: layout.x, top: layout.y, width: layout.width, height: layout.height }} />}
      <div ref={card} className="walkthrough-card" data-side={layout?.side} style={{ left: layout?.cardX ?? 12, top: layout?.cardY ?? 12, opacity: layout ? 1 : 0 }}>
        <header><span className="walkthrough-icon"><Icon name={step.icon} size={21}/></span><span>{step.label}<small>YOUR ENROLLMENT GUIDE</small></span><button ref={close} type="button" aria-label="Close tour" onClick={onClose}><Icon name="close" size={18}/></button></header>
        <div className="walkthrough-copy" aria-live="polite" aria-atomic="true"><span className="walkthrough-count">STEP {index + 1} OF {available.length}</span><h2>{step.title}</h2><p>{step.copy}</p><div className="walkthrough-hint"><Icon name="spark" size={15}/><span>{step.hint}</span></div></div>
        <footer><div className="walkthrough-progress" aria-label="Tour steps">{available.map((item, i) => <button key={item.target} type="button" aria-label={`Step ${i + 1}: ${item.label}`} aria-current={index === i ? "step" : undefined} onClick={() => setIndex(i)}><span/></button>)}</div><div className="walkthrough-actions"><button type="button" className="walkthrough-back" disabled={!index} onClick={() => setIndex(index - 1)}>Back</button><button type="button" className="walkthrough-next" onClick={() => index === available.length - 1 ? onClose() : setIndex(index + 1)}>{index === available.length - 1 ? "You’re ready" : "Next"}<Icon name="arrow" size={16}/></button></div></footer>
      </div>
    </dialog>, document.body,
  );
}
