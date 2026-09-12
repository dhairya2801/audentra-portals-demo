"use client";

import { useEffect, useRef } from "react";
import { EdwardButton } from "./cards";

export function DetailShell({
  eyebrow,
  title,
  mark,
  accent = "purple",
  meta,
  actions,
  children,
  aside,
  onBack,
  className = "",
  banner,
  footer,
  onAskEdward,
  headerMeta = false,
  titleBadge,
}: {
  headerMeta?: boolean;
  titleBadge?: React.ReactNode;
  className?: string;
  banner?: React.ReactNode;
  footer?: React.ReactNode;
  onAskEdward?: () => void;
  eyebrow: string;
  title: string;
  /** The glyph the card carried, so the panel opens as the same object. */
  mark?: React.ReactNode;
  accent?: "purple" | "blue" | "teal" | "navy" | "amber";
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** The right column: Edward's read of this item, and what he can draft for it. */
  aside?: React.ReactNode;
  onBack: () => void;
}) {
  const panel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !document.querySelector(".brew-edward-layer")
      )
        onBack();
      if (
        event.key === "Tab" &&
        panel.current &&
        !document.querySelector(".brew-edward-layer")
      ) {
        const elements = [
          ...panel.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input, textarea, select, [tabindex="0"]',
          ),
        ].filter((node) => node.getClientRects().length > 0);
        const first = elements[0],
          last = elements.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === panel.current)
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    panel.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onBack]);

  useEffect(() => {
    panel.current?.scrollTo({ top: 0 });
    panel.current?.focus({ preventScroll: true });
  }, [title]);

  return (
    <div
      className={`brew-detail-layer${className.includes("brew-detail--day") ? " brew-detail-layer--day" : ""}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onBack();
      }}
    >
      <div
        className={`brew-detail ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
      >
        <header className="brew-detail__head">
          {mark ? (
            <span
              className={`brew-detail__mark brew-detail__mark--${accent}`}
              aria-hidden="true"
            >
              {mark}
            </span>
          ) : null}
          <div>
            <p className="brew-eyebrow">{eyebrow}</p>
            <div className="brew-detail__title-row">
              <h1>{title}</h1>
              {titleBadge}
            </div>
            {headerMeta && meta ? (
              <div className="brew-detail__meta">{meta}</div>
            ) : null}
          </div>
          <div className="brew-detail__head-actions">
            {onAskEdward ? (
              <EdwardButton
                label={`Ask Edward about ${title}`}
                onClick={onAskEdward}
              />
            ) : null}
            <button
              className="brew-detail__close"
              type="button"
              onClick={onBack}
              aria-label="Close"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </header>
        {!headerMeta && meta ? (
          <div className="brew-detail__meta">{meta}</div>
        ) : null}
        {actions ? <div className="brew-detail__actions">{actions}</div> : null}
        {banner}
        {aside ? (
          <div className="brew-detail__split">
            <div className="brew-detail__body">{children}</div>
            {aside}
          </div>
        ) : (
          <div className="brew-detail__body">{children}</div>
        )}
        {footer}
      </div>
    </div>
  );
}
