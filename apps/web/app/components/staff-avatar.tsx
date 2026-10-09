"use client";

import Avatar from "../design-system/primitives/Avatar.jsx";

// Demo staff use a stable portrait across service lists, bookings and contact bars.
// A published portrait always takes precedence over this presentation fallback.
const portraits: Record<string, string> = {
  "ada ashgrove": "/people/ada-ashgrove.jpg",
  "amara abernathy": "/people/amara-abernathy.jpg",
  "amara blackwood": "/people/amara-blackwood.jpg",
  "amara castellanos": "/people/amara-castellanos.jpg",
  "bennett blackwood": "/people/bennett-blackwood.jpg",
  "bennett castellanos": "/people/bennett-castellanos.jpg",
  "bianca netherby": "/people/bianca-netherby.jpg",
  "bruno thistlebrook": "/people/bruno-thistlebrook.jpg",
  "caleb mossbank": "/people/caleb-mossbank.jpg",
  "camila blackwood": "/people/camila-blackwood.jpg",
  "camila castellanos": "/people/camila-castellanos.jpg",
  "camila stonebrook": "/people/camila-stonebrook.jpg",
  "desmond abernathy": "/people/desmond-abernathy.jpg",
  "desmond blackwood": "/people/desmond-blackwood.jpg",
  "desmond castellanos": "/people/desmond-castellanos.jpg",
  "elena larkspur": "/people/elena-larkspur.jpg",
  "elowen abernathy": "/people/elowen-abernathy.jpg",
  "elowen blackwood": "/people/elowen-blackwood.jpg",
  "elowen castellanos": "/people/elowen-castellanos.jpg",
  "farid abernathy": "/people/farid-abernathy.jpg",
  "farid blackwood": "/people/farid-blackwood.jpg",
  "farid castellanos": "/people/farid-castellanos.jpg",
  "greta abernathy": "/people/greta-abernathy.jpg",

  "bennett abernathy": "/people/bennett.jpg",
  "camila abernathy": "/people/camila.jpg",
  "imani blackwood": "/financial-plan/assets/img/sample-adviser.jpg",
};
export function staffPortrait(person: {name: string; photo?: string | null}) {
  if (person.photo) return person.photo;
  const name = person.name.trim().toLowerCase();
  return portraits[name] ?? null;
}
export function StaffAvatar({person, size = "md", className = ""}: {
  person: {name: string; photo?: string | null};
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  return <Avatar person={{...person, photo: staffPortrait(person)}} size={size} className={`staff-portrait ${className}`} />;
}
