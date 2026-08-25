"use client";
import type {
  FerpaPortalScope,
  StudentFerpaAuthorization,
  StudentFerpaDelegate,
} from "@vv/contracts";
import Card, { CardHead } from "../../design-system/primitives/Card.jsx";
import Notice from "../../design-system/patterns/Notice.jsx";
import Button from "../../design-system/primitives/Button.jsx";
import Avatar from "../../design-system/primitives/Avatar.jsx";
import Icon from "../../design-system/Icon.jsx";
import { listSentence } from "../flow";
import type { AuthorizeDraft } from "../overlays/AuthorizeModal";

/** The twelve pages a delegate may be given, in the platform's own words. */
export const SCOPE_OPTIONS: ReadonlyArray<{
  value: FerpaPortalScope;
  label: string;
  description: string;
}> = [
  { value: "dashboard", label: "Dashboard", description: "The student home and high-level progress." },
  { value: "enrollment", label: "My Enrollment", description: "Enrollment requirements, and acting on them." },
  { value: "financials", label: "My Financials", description: "Aid, balances, and financial next steps." },
  { value: "classrooms", label: "My Classrooms", description: "Courses and academic information." },
  { value: "campus_life", label: "My Campus Life", description: "Events, clubs, and campus activities." },
  { value: "edward", label: "Edward", description: "The AI support workspace." },
  { value: "documents", label: "My Documents", description: "Viewing and uploading documents." },
  { value: "messages", label: "Messages", description: "Portal messages, and marking them reviewed." },
  { value: "appointments", label: "Appointments", description: "Advising appointments." },
  { value: "payments", label: "Payments", description: "Viewing and completing eligible payments." },
  { value: "profile", label: "Profile", description: "Ordinary profile details." },
  { value: "help", label: "Help", description: "Support and help resources." },
];

export const DELEGATE_RELATIONSHIPS: Array<{
  value: StudentFerpaDelegate["relationship"];
  label: string;
}> = [
  { value: "parent", label: "Parent" },
  { value: "guardian", label: "Guardian" },
  { value: "partner", label: "Spouse or partner" },
  { value: "relative", label: "Relative" },
  { value: "sponsor", label: "Sponsor" },
  { value: "other", label: "Other trusted person" },
];

export function relationshipLabel(value: StudentFerpaDelegate["relationship"]) {
  return DELEGATE_RELATIONSHIPS.find((option) => option.value === value)?.label ?? value;
}

export function scopeNames(scopes: FerpaPortalScope[]) {
  return scopes
    .map((scope) => SCOPE_OPTIONS.find((option) => option.value === scope)?.label)
    .filter((name): name is string => Boolean(name));
}

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Step 7. Nobody can see anything, and going on without adding anyone is a
 * complete answer. An authorization row shows the person, what it covers and
 * the link they sign in with — a name alone cannot answer "what did I give
 * them?", which is the only question this list exists to answer.
 */
export function PermissionsStep({
  institution,
  authorization,
  contactName,
  draft,
  revealedLinks,
  copied,
  busy,
  signedOn,
  onAdd,
  onResume,
  onDiscard,
  onRemove,
  onCopyLink,
}: {
  institution: string;
  authorization: StudentFerpaAuthorization | null;
  contactName: string;
  draft: AuthorizeDraft | null;
  revealedLinks: Record<string, string>;
  copied: string | null;
  busy: boolean;
  signedOn: string | null;
  onAdd: () => void;
  onResume: () => void;
  onDiscard: () => void;
  onRemove: (delegate: StudentFerpaDelegate) => void;
  onCopyLink: (delegate: StudentFerpaDelegate, url: string) => void;
}) {
  const grants = authorization?.delegates ?? [];
  const draftName = draft?.fullName.trim() ?? "";
  const unavailable =
    !authorization || authorization.flowKind === "enrollment" || !authorization.capabilities.canManageAccess;

  return (
    <>
      <Card className="asking">
        <CardHead
          kind="status"
          icon="users"
          tone="ask"
          title={grants.length ? "People you have authorized" : "Nobody is authorized yet"}
          note={
            grants.length
              ? "Each one can see only the pages you gave them, and only through their own link."
              : `Your record is yours. Nothing is shared until you name somebody here.`
          }
        />

        <div className="card-body">
          {grants.map((grant) => {
            const link = revealedLinks[grant.id];
            return (
              <div key={grant.id} className="grant-row">
                <Avatar person={{ name: grant.fullName, initials: initialsOf(grant.fullName) }} size={38} />
                <div className="grant-body">
                  <strong>{grant.fullName}</strong>
                  <small>{relationshipLabel(grant.relationship)}</small>
                  <p className="grant-covers">
                    Can see {listSentence(scopeNames(grant.scopes))}.
                  </p>
                  <p className="grant-dates">
                    {signedOn ? `Signed ${signedOn} · ` : ""}
                    {grant.link.status === "active"
                      ? "Their sign-in link is issued"
                      : grant.link.status === "revoked"
                        ? "Their sign-in link was revoked"
                        : "Their sign-in link is not issued yet"}
                  </p>
                  {link ? (
                    <Notice
                      tone="done"
                      icon="copy"
                      action={{
                        label: copied === grant.id ? "Copied" : "Copy the link",
                        onClick: () => onCopyLink(grant, link),
                      }}
                    >
                      This is the only time the link is shown. Send it to {grant.fullName.split(" ")[0]}{" "}
                      yourself; {institution} never emails it.
                    </Notice>
                  ) : null}
                </div>
                <Button kind="danger" disabled={busy} onClick={() => onRemove(grant)}>
                  Revoke
                </Button>
              </div>
            );
          })}

          {unavailable ? (
            <Notice tone="quiet" icon="info">
              {!authorization
                ? `Record access is not part of this journey yet. Carry on; it appears on your checklist if ${institution} adds it.`
                : authorization.flowKind === "enrollment"
                  ? "Record access is asked for on your enrollment checklist, after these steps. Carry on."
                  : "Record access is managed from the portal after these steps. Carry on."}
            </Notice>
          ) : (
            <>
              {draft ? (
                <Notice tone="working" icon="pen" action={{ label: "Discard it", onClick: onDiscard }}>
                  {draftName
                    ? `An authorization for ${draftName} is part way through and has not been signed.`
                    : "An authorization is part way through and has not been signed."}
                </Notice>
              ) : null}

              <Button
                kind="secondary"
                leadingIcon={draft ? "pen" : "plus"}
                disabled={busy}
                onClick={draft ? onResume : onAdd}
              >
                {draft ? "Continue authorizing" : "Add someone"}
              </Button>
            </>
          )}
        </div>
      </Card>

      <p className="field-foot">
        <Icon name="bell" size={14} />
        {contactName
          ? `${contactName} is your emergency contact. ${institution} can call them, and they can see nothing.`
          : `Your emergency contact can be called. They can see nothing.`}
      </p>

      <p className="field-foot">
        <Icon name="hidden" size={14} /> {institution} never tells an authorized person what you do in
        the portal.
      </p>
    </>
  );
}
