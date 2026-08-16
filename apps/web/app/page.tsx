"use client";

import Link from "next/link";
import { useState } from "react";
import { isTenantSlug } from "./lib/tenant";

export default function PortalLandingPage() {
  const [institutionSlug, setInstitutionSlug] = useState("");
  const normalizedSlug = institutionSlug.trim().toLowerCase();
  const validSlug = isTenantSlug(normalizedSlug) ? normalizedSlug : null;
  return (
    <main className="portal-landing">
      <div className="portal-landing__glow portal-landing__glow--one" aria-hidden="true" />
      <div className="portal-landing__glow portal-landing__glow--two" aria-hidden="true" />

      <header className="portal-landing__header">
        <img
          className="audentra-logo"
          src="/audentra-logo.png"
          alt="Audentra"
        />
        <span>Higher Education Intelligence Platform</span>
      </header>

      <section className="portal-landing__hero" aria-labelledby="portal-title">
        <div className="a-mark-watermark" aria-hidden="true">A</div>
        <p className="eyebrow">One intelligent institutional experience</p>
        <h1 id="portal-title">Institutional intelligence<br />for what’s next.</h1>
        <p className="portal-landing__intro">
          A connected experience for students and the teams who help them move forward.
          Choose your portal to continue.
        </p>

        <label className="portal-landing__tenant-field">
          <span>Institution portal ID</span>
          <input
            value={institutionSlug}
            onChange={(event) => setInstitutionSlug(event.target.value)}
            placeholder="your-institution"
            autoComplete="organization"
            spellCheck={false}
          />
          <small>Use the portal ID provided by your institution.</small>
        </label>

        <div className="portal-choice-grid">
          <Link
            aria-disabled={!validSlug}
            className="portal-choice portal-choice--student"
            href={validSlug ? `/${validSlug}/sign-in` : "#"}
            onClick={(event) => { if (!validSlug) event.preventDefault(); }}
          >
            <span className="portal-choice__icon" aria-hidden="true">S</span>
            <span>
              <small>For learners</small>
              <strong>Student portal</strong>
              <p>Enrollment, financials, academics, campus life, and personalized guidance.</p>
            </span>
            <b aria-hidden="true">→</b>
          </Link>
          <Link
            aria-disabled={!validSlug}
            className="portal-choice portal-choice--staff"
            href={validSlug ? `/${validSlug}/staff` : "#"}
            onClick={(event) => { if (!validSlug) event.preventDefault(); }}
          >
            <span className="portal-choice__icon" aria-hidden="true">A</span>
            <span>
              <small>For institutional teams</small>
              <strong>Staff portal</strong>
              <p>Signals, student priorities, operations, and intelligent action in one workspace.</p>
            </span>
            <b aria-hidden="true">→</b>
          </Link>
        </div>
      </section>

      <footer className="portal-landing__footer">
        <span>Earlier signals.</span><span>Clearer action.</span><span>Better student outcomes.</span>
      </footer>
    </main>
  );
}
