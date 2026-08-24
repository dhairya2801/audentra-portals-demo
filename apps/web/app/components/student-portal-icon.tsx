"use client";

import type { ReactNode, SVGProps } from "react";

export type StudentPortalIconName =
  | "home"
  | "checklist"
  | "calendar"
  | "degree"
  | "wallet"
  | "card"
  | "campus"
  | "health"
  | "users"
  | "ticket"
  | "message"
  | "bell"
  | "spark"
  | "file"
  | "profile"
  | "help"
  | "menu"
  | "close"
  | "chevron";

const paths: Record<StudentPortalIconName, ReactNode> = {
  home: (
    <>
      <path d="m3.5 10.6 8.5-7 8.5 7" />
      <path d="M5.5 9.4V21h13V9.4M9.5 21v-6.5h5V21" />
    </>
  ),
  checklist: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="m8.2 8.2 1.4 1.4 2.6-2.8M13.7 8.5h2.4M8.2 14.2l1.4 1.4 2.6-2.8M13.7 14.5h2.4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.2" />
      <path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
    </>
  ),
  degree: (
    <>
      <path d="M2.5 8.5 12 4l9.5 4.5L12 13Z" />
      <path d="M6 10.3v5.2c2.8 2.2 9.2 2.2 12 0v-5.2M21.5 8.5v6" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 6.5h14.5A1.5 1.5 0 0 1 20 8v11H4a2 2 0 0 1-2-2V6.5a2.5 2.5 0 0 1 2.5-2.5H17" />
      <path d="M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.2" />
      <path d="M2.5 9.5h19M6 15h3" />
    </>
  ),
  campus: (
    <>
      <path d="m3 9 9-5 9 5M5 10.5h14M6.5 10.5v7M10.2 10.5v7M13.8 10.5v7M17.5 10.5v7M4 18h16M2.5 21h19" />
    </>
  ),
  health: (
    <>
      <path d="M12 21s7-3.6 7-10.2V5.6L12 3 5 5.6v5.2C5 17.4 12 21 12 21Z" />
      <path d="M9 12h6M12 9v6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <circle cx="17.2" cy="9.2" r="2.4" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0M14.3 15.1a5 5 0 0 1 6.9 4.6" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4Z" />
      <path d="M9 6v12" />
    </>
  ),
  message: (
    <>
      <path d="M4.5 4.5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10L4 22v-3.5a2 2 0 0 1-1.5-1.9V6.5a2 2 0 0 1 2-2Z" />
      <path d="M7 9h10M7 13h7" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18C21 16 18 16 18 9Z" />
      <path d="M9.5 20.5a2.8 2.8 0 0 0 5 0" />
    </>
  ),
  spark: (
    <>
      <path d="M12 2.5c.8 5.2 2.3 6.7 7.5 7.5-5.2.8-6.7 2.3-7.5 7.5-.8-5.2-2.3-6.7-7.5-7.5 5.2-.8 6.7-2.3 7.5-7.5Z" />
      <path d="M19 16.5c.3 2.2 1 2.9 3 3.2-2 .3-2.7 1-3 3.1-.4-2.1-1-2.8-3.1-3.1 2.1-.3 2.7-1 3.1-3.2Z" />
    </>
  ),
  file: (
    <>
      <path d="M6 2.5h8l4 4V21H6a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2Z" />
      <path d="M14 2.5v5h5M8 12h8M8 16h6" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.6 9a2.6 2.6 0 1 1 3.2 2.5c-.8.3-.8.9-.8 1.7M12 17.5h.01" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevron: <path d="m9 6 6 6-6 6" />,
};

export function StudentPortalIcon({
  name,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & {
  name: StudentPortalIconName;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      >
        {paths[name]}
      </g>
    </svg>
  );
}

export function AudentraSymbol({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 36 28"
      width={Math.round(size * 1.29)}
    >
      <path d="M0 28 14.1 0h8L8.4 28Z" fill="#6a38ff" />
      <path d="m14.1 0 4.8 9.3-4 8L10 7.9Z" fill="#1e5bff" />
      <path d="m14.9 17.3 7.2-14 5 9.7-7.7 15Z" fill="#04b2a9" />
      <path d="m19.4 28-4.5-10.7h9.7L36 28Z" fill="#02cdc7" />
    </svg>
  );
}

const asterPetals = [0, 45, 90, 135, 180, 225, 270, 315];

/** The exact Aster University crest used by the audentra-design sidebar. */
export function AsterMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={Math.round((size * 32) / 36)}
      height={size}
      viewBox="0 0 32 36"
    >
      <path
        d="M4 3h24v14.6c0 8.3-5.8 13.2-12 15.4C9.8 30.8 4 25.9 4 17.6Z"
        fill="var(--purple)"
        stroke="var(--on-ink)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M4 3h24v7.4L16 15 4 10.4Z" fill="var(--on-ink)" />
      <g fill="var(--purple)">
        <path d="M10 7c2.2-.8 4.2-.6 5.6.6v4.8c-1.4-1.1-3.4-1.3-5.6-.6Z" />
        <path d="M22 7c-2.2-.8-4.2-.6-5.6.6v4.8c1.4-1.1 3.4-1.3 5.6-.6Z" />
      </g>
      <g fill="var(--on-ink)" fillOpacity=".92">
        {asterPetals.map((angle) => (
          <ellipse
            key={angle}
            cx="16"
            cy="19.4"
            rx="1.25"
            ry="2.7"
            transform={`rotate(${angle} 16 23.5)`}
          />
        ))}
      </g>
      <circle cx="16" cy="23.5" r="1.3" fill="var(--on-ink)" />
    </svg>
  );
}
