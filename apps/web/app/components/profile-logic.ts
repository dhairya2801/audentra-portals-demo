import type {
  StudentBootstrap,
  StudentDocument,
  StudentFerpaDelegate,
  StudentProfile,
  TenantContact,
} from "@vv/contracts";
import { ferpaPortalScopeOptions } from "./ferpa-access-center";

/**
 * The profile, read from the record Aster actually holds — the reference's
 * `features/profile/logic.js`, fed by `StudentProfile` instead of a fixture.
 *
 * Every field says who owns it: `student` means the row carries a control and
 * the change is saved through `updateStudentProfile`; an office id means the
 * row carries the route to that office and never a control. The reference's
 * rows the backend has no value for (date of birth, addresses, campus
 * interests, the institution's own email) are omitted rather than invented.
 */

export type OfficeId = "registrar" | "support" | "admissions";

export interface Office {
  id: OfficeId;
  name: string;
  short: string;
  holds: string;
  where: string | null;
  hours: string | null;
  email: string | null;
  url: string | null;
}

export type VerifyState = "verified" | "pending" | "unverified" | "unknown";

export interface FieldVerify {
  state: VerifyState;
  label: string;
  detail?: string;
}

export type EditableKey = "preferredName" | "pronouns" | "mobilePhone";

export interface ProfileField {
  id: string;
  label: string;
  owner: "student" | OfficeId;
  value: string | null;
  note?: string;
  blank?: string;
  mono?: boolean;
  verify?: FieldVerify | null;
  /** The preferred-channel row: a choice rather than a text value. */
  choice?: "channel";
  /** The key `updateStudentProfile` takes for this row, when it is hers to change. */
  editKey?: EditableKey;
  inputType?: "text" | "tel";
  /** The photo row opens a different door: the identity document. */
  photo?: boolean;
}

export interface FieldGroup {
  id: "you" | "contact";
  title: string;
  icon: string;
  lede: string;
  fields: ProfileField[];
}

export type ChannelId = StudentProfile["communicationPreference"];

/** The channels Aster can reach a student by, and what each one does. */
export const channelOptions: ReadonlyArray<[ChannelId, string, string]> = [
  ["email", "Email", "Aster writes to your personal email first, and keeps a copy in the portal."],
  ["sms", "Text message", "Aster texts you first for anything time-critical. Needs a verified number."],
];

export function officesFor(
  tenant: {
    shortName: string;
    contacts: { support: TenantContact; admissions?: TenantContact | null };
  },
  bootstrapTenant: StudentBootstrap["tenant"] | undefined,
): Record<OfficeId, Office> {
  const support = tenant.contacts.support;
  const admissions = tenant.contacts.admissions ?? null;
  return {
    admissions: {
      id: "admissions",
      name: admissions?.label ?? "Admissions",
      short: "Admissions",
      holds: "Your offer: the program, term and campus you were admitted to, and your class year.",
      where: null,
      hours: admissions?.hours ?? null,
      email: admissions?.email ?? bootstrapTenant?.admissionsEmail ?? null,
      url: admissions?.url ?? null,
    },
    registrar: {
      id: "registrar",
      name: "Office of the Registrar",
      short: "the Registrar",
      holds: "Your legal identity and your student number.",
      where: null,
      hours: null,
      email: bootstrapTenant?.registrarEmail ?? null,
      url: null,
    },
    support: {
      id: "support",
      name: support.label,
      short: support.label,
      holds: `Your ${tenant.shortName} sign-in and the email your account is registered under.`,
      where: null,
      hours: support.hours,
      email: support.email,
      url: support.url,
    },
  };
}

export function identityFor(profile: StudentProfile, photo: string | null) {
  const legalFirst = profile.firstName?.trim() || null;
  const family = profile.lastName?.trim() || "";
  const preferred = profile.preferredName.trim() || null;
  const firstName = preferred ?? legalFirst ?? "";
  const name = [firstName, family].filter(Boolean).join(" ");
  return {
    firstName,
    name,
    initials: `${firstName[0] ?? ""}${family[0] ?? ""}`.toUpperCase() || "?",
    photo,
    usingLegalName: !preferred && Boolean(legalFirst),
  };
}

/** What the admission offer says about the student — read from the dashboard, owned by Admissions. */
export interface AcademicStanding {
  programName: string | null;
  termName: string | null;
  campusName: string | null;
  classYear: number | null;
}

export function buildProfile(
  profile: StudentProfile,
  options: {
    photoOnFile: boolean;
    photoUnavailable: boolean;
    tenantShortName: string;
    /** `null` when the dashboard could not be read; omitted rows are never invented. */
    academic?: AcademicStanding | null;
  },
): { groups: FieldGroup[]; ownership: { yours: number; total: number }; blanks: number } {
  const legalName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  const { tenantShortName } = options;
  const academic = options.academic;
  const academicBlank =
    academic === null ? "Couldn’t be read just now" : "Not on your record yet";

  const you: FieldGroup = {
    id: "you",
    title: "You",
    icon: "profile",
    lede: `Your name as ${tenantShortName} uses it, and the identity the law records.`,
    fields: [
      {
        id: "preferred-name",
        label: "Preferred name",
        owner: "student",
        value: profile.preferredName.trim() || null,
        note: "Used everywhere in the portal. Your legal name appears only where the law needs it.",
        blank: profile.firstName
          ? `Not set · ${tenantShortName} is calling you ${profile.firstName}`
          : "Not set",
        editKey: "preferredName",
      },
      {
        id: "photo",
        label: "Photo",
        owner: "student",
        value: options.photoOnFile ? "On file · the one on your identity document" : null,
        note: options.photoUnavailable
          ? "Your photo is held with your documents, which this session cannot read."
          : "The one place your photograph appears in the portal is the head of this page. It is read from the identity document you upload; nobody else sees it here.",
        blank: "Not set · your initials are used until you add one",
        photo: true,
      },
      {
        id: "pronouns",
        label: "Pronouns",
        owner: "student",
        value: profile.pronouns?.trim() || null,
        blank: "Not set",
        editKey: "pronouns",
      },
      {
        id: "legal-name",
        label: "Legal name",
        owner: "registrar",
        value: legalName || null,
        note: "On your transcript and your diploma. Changing it needs a document.",
        blank: "Not on your record yet",
      },
      {
        id: "student-id",
        label: "Student ID",
        owner: "registrar",
        value: profile.externalRef ?? profile.studentId,
        mono: true,
        note: profile.externalRef
          ? "Your student number. It never changes, and it is safe to quote in an email."
          : "It never changes, and it is safe to quote in an email.",
      },
      ...(academic !== undefined
        ? ([
            {
              id: "program",
              label: "Program",
              owner: "admissions",
              value: academic?.programName?.trim() || null,
              note: "The program on your admission offer.",
              blank: academicBlank,
            },
            {
              id: "term",
              label: "Starting term",
              owner: "admissions",
              value: academic?.termName?.trim() || null,
              blank: academicBlank,
            },
            {
              id: "campus",
              label: "Campus",
              owner: "admissions",
              value: academic?.campusName?.trim() || null,
              blank: academicBlank,
            },
            {
              id: "class-year",
              label: "Class year",
              owner: "admissions",
              value: academic?.classYear ? `Class of ${academic.classYear}` : null,
              blank: academicBlank,
            },
          ] satisfies ProfileField[])
        : []),
    ],
  };

  const contact: FieldGroup = {
    id: "contact",
    title: `How ${tenantShortName} reaches you`,
    icon: "mail",
    lede: "Where a decision, a bill, or a deadline lands, and which one Aster uses first.".replace(
      "Aster",
      tenantShortName,
    ),
    fields: [
      {
        id: "channel",
        label: "Preferred channel",
        owner: "student",
        choice: "channel",
        value: profile.communicationPreference,
      },
      {
        id: "mobile",
        label: "Mobile number",
        owner: "student",
        value: profile.mobilePhone?.trim() || null,
        blank: "Not set",
        inputType: "tel",
        editKey: "mobilePhone",
        verify:
          profile.mobilePhone && profile.phoneVerified !== undefined
            ? profile.phoneVerified
              ? { state: "verified", label: "Verified" }
              : {
                  state: "unverified",
                  label: "Not verified",
                  detail: `${tenantShortName} has not confirmed this number yet, so it will not text you until it does.`,
                }
            : null,
      },
      {
        id: "personal-email",
        label: "Personal email",
        owner: "support",
        value: profile.email?.trim() || null,
        note: "The address your account is registered under. Official mail always goes here as well.",
        blank: "Not on your record yet",
        verify:
          profile.email && profile.emailVerified !== undefined
            ? profile.emailVerified
              ? { state: "verified", label: "Verified" }
              : { state: "unverified", label: "Not verified" }
            : null,
      },
    ],
  };

  const groups = [you, contact];
  const fields = groups.flatMap((group) => group.fields);
  const yours = fields.filter((field) => field.owner === "student");
  return {
    groups,
    ownership: { yours: yours.length, total: fields.length },
    blanks: yours.filter((field) => !field.value).length,
  };
}

export interface FieldRun {
  id: "yours" | "office";
  label: string;
  icon: string;
  hint: string;
  fields: ProfileField[];
}

/** A card's rows in two runs: what the student changes, then what an office does. */
export function runsFor(
  group: FieldGroup,
  offices: Record<OfficeId, Office>,
  tenantShortName: string,
): FieldRun[] {
  const yours = group.fields.filter((field) => field.owner === "student");
  const owned = group.fields.filter((field) => field.owner !== "student");
  const ownerIds = [...new Set(owned.map((field) => field.owner as OfficeId))];
  const runs: FieldRun[] = [];
  if (yours.length) {
    runs.push({
      id: "yours",
      label: "Yours to change",
      icon: "pen",
      hint: `${yours.length} ${yours.length === 1 ? "detail" : "details"}`,
      fields: yours,
    });
  }
  if (owned.length) {
    runs.push({
      id: "office",
      label: `${tenantShortName}’s record`,
      icon: "lock",
      hint: ownerIds.length === 1 ? offices[ownerIds[0]].name : "An office changes these",
      fields: owned,
    });
  }
  return runs;
}

/* ------------------------------------------------------------------ *
 * Who can see what — the FERPA authorization, in the reference's shape
 * ------------------------------------------------------------------ */

export interface RecordCategory {
  id: string;
  name: string;
  sees: string;
}

/** The portal sections a delegate can be granted, in the vocabulary the student consented in. */
export const RECORD_CATEGORIES: RecordCategory[] = ferpaPortalScopeOptions.map((scope) => ({
  id: scope.value,
  name: scope.label,
  sees: scope.description,
}));

export function relationshipLabel(value: StudentFerpaDelegate["relationship"]) {
  switch (value) {
    case "parent":
      return "Parent";
    case "guardian":
      return "Guardian";
    case "partner":
      return "Spouse or partner";
    case "relative":
      return "Relative";
    case "sponsor":
      return "Sponsor";
    default:
      return "Trusted person";
  }
}

/** "enrollment, billing and financial aid" — the categories a grant shares, in a sentence. */
export function sharedNames(scopes: readonly string[]) {
  const names = RECORD_CATEGORIES.filter((category) => scopes.includes(category.id)).map(
    (category) => category.name,
  );
  if (names.length === 0) return "nothing";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/* ------------------------------------------------------------------ *
 * Where I came from — the transcripts on file
 * ------------------------------------------------------------------ */

export type TranscriptReading = "received" | "under-review" | "reviewed" | "returned";

export function transcriptReading(document: StudentDocument): TranscriptReading {
  switch (document.status) {
    case "accepted":
    case "waived":
      return "reviewed";
    case "under_review":
      return "under-review";
    case "rejected":
    case "needs_resubmission":
      return "returned";
    default:
      return "received";
  }
}

export function transcriptsOf(documents: readonly StudentDocument[]) {
  return documents
    .filter((document) => document.category === "transcript" && document.status !== "placeholder")
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

/** The identity document Aster read a portrait out of — the one photo the portal shows. */
export function profilePhotoDocument(documents: readonly StudentDocument[]) {
  return (
    documents.find(
      (document) =>
        document.category === "identity" &&
        document.extraction?.status === "completed" &&
        document.extraction.visualRegions?.some((region) => region.kind === "profile_photo"),
    ) ?? null
  );
}

export function formatDate(value: string | null | undefined, locale = "en-US") {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(time),
  );
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
