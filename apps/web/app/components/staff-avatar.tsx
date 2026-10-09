"use client";

import Avatar from "../design-system/primitives/Avatar.jsx";

// Demo staff use a stable portrait across service lists, bookings and contact bars.
// A published portrait always takes precedence over this presentation fallback.
const portraits: Record<string, string> = {
  "bennett abernathy": "/people/bennett.jpg",
  "camila abernathy": "/people/camila.jpg",
  "imani blackwood": "/financial-plan/assets/img/sample-adviser.jpg",
};
export function staffPortrait(person: {name: string; photo?: string | null}) {
  if (person.photo) return person.photo;
  const name = person.name.trim().toLowerCase();
  const hash = [...name].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  return portraits[name] ?? `/people/adviser-${hash % 3 + 1}.jpg`;
}
export function StaffAvatar({person, size = "md", className = ""}: {
  person: {name: string; photo?: string | null};
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  return <Avatar person={{...person, photo: staffPortrait(person)}} size={size} className={`staff-portrait ${className}`} />;
}
