import type { TenantContact } from "@vv/contracts";

/**
 * The person seated in a section's summary panel.
 *
 * `AdvisorBar` states a rule and the portal was breaking it on four pages: the
 * bar seats *a person who owns the subject for the student*, and an office is a
 * thing — a thing never gets a face. Every one of those four call sites passed
 * `name: contact.label`, so the panel read
 *
 *     YOUR ADMISSIONS CONTACT
 *     Admissions
 *
 * with an "A" in the disc where a face belongs: a label repeated as a name, and
 * two buttons offering to email a department. My Enrollment's dashboard strip
 * already does this properly — Hana Dunmire, her title, her photograph — because
 * the platform records an *academic adviser* as a person. It records no person
 * for Admissions, Financial Aid or any other office, only a `TenantContact` with
 * a label and a mailbox.
 *
 * So the portal supplies one, the same way `staff-portrait.ts` supplies the
 * photographs the platform does not keep: a small demo directory, keyed by the
 * office contact the tenant published. The office is not lost — it rides the
 * name line, which is exactly the slot `AdvisorBar` reserves for it — and the
 * mailbox stays the tenant's, so the buttons still reach a real inbox.
 *
 * A tenant whose office is not in this directory keeps today's behaviour: the
 * label as the name, initials in the disc. Nothing here invents a person for an
 * institution the demo does not know.
 */

export type OfficeKey = "admissions" | "financialAid";

export interface OfficePerson {
  name: string;
  title: string;
  photo: string;
}

/** The demo campus's named office contacts. See the file comment before adding one. */
const PEOPLE: Record<OfficeKey, OfficePerson> = {
  admissions: {
    name: "Elena Marchetti",
    title: "Senior Admissions Counselor",
    photo: "/images/staff/elena-marchetti.jpg",
  },
  financialAid: {
    name: "Emmett Calloway",
    title: "Financial Aid Counselor",
    photo: "/images/staff/emmett-calloway.jpg",
  },
};

/** What `AdvisorBar` takes: the caps line, the name line, the office after it, the face. */
export interface AdvisorSubject {
  label: string;
  name: string;
  office: string | null;
  photo: string | null;
}

/**
 * Builds the bar's subject from the tenant's office contact.
 *
 * `label` is the caps line the page decides ("Your admissions contact"), and
 * `office` falls back to the tenant's own label so a demo person is always
 * attributed to the office the institution actually published — never to an
 * office name this file made up.
 */
export function officeAdvisor(
  office: OfficeKey,
  contact: TenantContact | null | undefined,
  label: string,
): AdvisorSubject | null {
  if (!contact) return null;
  const person = PEOPLE[office];
  if (!person) return { label, name: contact.label, office: null, photo: null };
  return {
    label,
    name: person.name,
    // The office line is the tenant's own label where it has one, so the page
    // never claims a department the institution does not call by that name.
    office: contact.label,
    photo: person.photo,
  };
}

/** The person's role, where a page has room for it — the health page's scope line does not. */
export function officeTitle(office: OfficeKey): string | null {
  return PEOPLE[office]?.title ?? null;
}
