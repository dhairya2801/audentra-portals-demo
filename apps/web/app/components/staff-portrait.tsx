"use client";

import { useState } from "react";

/**
 * Portraits for the people the demo names. The platform records no photograph
 * for staff, so the portal keeps a small set of stock portraits keyed by the
 * person's institution reference (or, for people without one, a name slug).
 * Anyone else is drawn as their initials — the same disc, never a broken image.
 */
const PORTRAITS: Record<string, string> = {
  "SYN-ADV-001": "/images/staff/SYN-ADV-001.jpg",
  "SYN-STF-VP": "/images/staff/SYN-STF-VP.jpg",
  "desmond-vasquez": "/images/staff/desmond-vasquez.jpg",
  "sylvie-vasquez": "/images/staff/sylvie-vasquez.jpg",
};

export function staffInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2);
}

export function staffPortraitUrl(person: { name: string; externalRef?: string | null }) {
  if (person.externalRef && PORTRAITS[person.externalRef]) return PORTRAITS[person.externalRef];
  const slug = person.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return PORTRAITS[slug] ?? null;
}

export function StaffPortrait({
  person,
  className,
}: {
  person: { name: string; externalRef?: string | null };
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = failed ? null : staffPortraitUrl(person);
  if (!url) {
    return (
      <span className={className} aria-hidden="true">
        {staffInitials(person.name)}
      </span>
    );
  }
  return (
    <span className={`${className} ${className}--photo`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- a plain stock asset */}
      <img src={url} alt="" width="44" height="44" onError={() => setFailed(true)} />
    </span>
  );
}
