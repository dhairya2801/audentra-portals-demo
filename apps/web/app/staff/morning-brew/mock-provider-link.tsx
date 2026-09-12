"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Glyph } from "./glyphs";

/** Local demo destination: never connects to Outlook or joins a meeting. */
export function MockProviderLink({
  label,
  title,
  description,
  meta,
  meeting = false,
}: {
  label: string;
  title: string;
  description: string;
  meta: string;
  meeting?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLAnchorElement>(null);
  const destination = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) destination.current?.focus();
  }, [open]);
  return (
    <div className="brew-mock-provider">
      <a
        className="brew-provider-link"
        href={`#${id}`}
        ref={trigger}
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        {label} <small>Demo</small>
      </a>
      <div
        id={id}
        className="brew-mock-destination"
        hidden={!open}
        role="region"
        aria-label={meeting ? "Demo meeting room" : "Demo Outlook preview"}
        tabIndex={-1}
        ref={destination}
      >
        <header>
          <span>
            <Glyph name={meeting ? "calendar" : "outlook"} size={18} />
            {meeting ? "Meeting room" : "Outlook"} <small>Demo preview</small>
          </span>
          <button
            type="button"
            aria-label="Close mock preview"
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            ×
          </button>
        </header>
        <strong>{title}</strong>
        <small>{meta}</small>
        <p>{description}</p>
        <footer>
          {meeting
            ? "Preview only — no meeting is joined."
            : "Preview only — your Outlook account is not opened."}
        </footer>
      </div>
    </div>
  );
}
