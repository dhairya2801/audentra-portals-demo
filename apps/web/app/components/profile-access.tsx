"use client";

import type {
  FerpaDelegateInput,
  FerpaPortalScope,
  StudentFerpaAuthorization,
  StudentFerpaDelegate,
} from "@vv/contracts";
import { type FormEvent, useEffect, useRef, useState } from "react";
import Icon from "../design-system/Icon.jsx";
import Avatar from "../design-system/primitives/Avatar.jsx";
import Button from "../design-system/primitives/Button.jsx";
import InfoModal from "../design-system/patterns/InfoModal.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import {
  ApiClientError,
  issueStudentFerpaDelegateLink,
  revokeStudentFerpaDelegateLink,
  updateStudentFerpaAccess,
} from "../lib/api-client";
import { getApiErrorMessage } from "../hooks/use-api-resource";
import { FerpaAccessCenter } from "./ferpa-access-center";
import { useTenant } from "./tenant-provider";
import {
  RECORD_CATEGORIES,
  type RecordCategory,
  formatDate,
  relationshipLabel,
  sharedNames,
} from "./profile-logic";

/**
 * Who can see what — the reference's access section and `PermissionGrant`,
 * fed by the FERPA authorization the platform holds.
 *
 * A grant is one delegate on the authorization; the categories are the portal
 * sections a delegate can be scoped to, listed granted or not so the student
 * sees what is *not* shared as plainly as what is. A checkbox takes effect on
 * change (`updateStudentFerpaAccess`); ending access asks once, naming the
 * person and what they will stop seeing. The secure link each person signs in
 * with is managed on the same card, because it is the same consent.
 *
 * An authorization that is not yet signed keeps its full signing flow: the
 * production editor renders inside this section until it is complete.
 */

export type ToastInput =
  | string
  | { tone?: "success" | "info" | "critical"; title: string; body?: string };

// The platform returns a link token only at issuance. Keep the one-time
// disclosure in memory for this portal session so a refresh does not lose it
// before the student has copied it. Never persisted, never sent back.
const oneTimeLinks = new Map<string, Record<string, string>>();

function rememberLink(authorizationId: string, delegateId: string, url: string) {
  oneTimeLinks.set(authorizationId, {
    ...(oneTimeLinks.get(authorizationId) ?? {}),
    [delegateId]: url,
  });
}

function forgetLink(authorizationId: string, delegateId: string) {
  const links = { ...(oneTimeLinks.get(authorizationId) ?? {}) };
  delete links[delegateId];
  oneTimeLinks.set(authorizationId, links);
}

function toInput(delegate: StudentFerpaDelegate): FerpaDelegateInput {
  return {
    id: delegate.id,
    fullName: delegate.fullName,
    relationship: delegate.relationship,
    email: delegate.email,
    scopes: [...new Set(delegate.scopes)],
  };
}

const RELATIONSHIPS: StudentFerpaDelegate["relationship"][] = [
  "parent",
  "guardian",
  "partner",
  "relative",
  "sponsor",
  "other",
];

export default function ProfileAccess({
  authorization,
  unavailable,
  delegateView,
  onChanged,
  onRetry,
  onToast,
  onOverlay,
}: {
  authorization: StudentFerpaAuthorization | null;
  /** The authorization could not be read; nothing changed and nobody gained access. */
  unavailable: boolean;
  /** Viewing as a delegate: the authorization is the student's to manage. */
  delegateView: { studentName: string } | null;
  onChanged: () => void;
  onRetry: () => void;
  onToast: (toast: ToastInput) => void;
  onOverlay: (open: boolean) => void;
}) {
  const runtime = useTenant();
  const { tenant } = runtime;
  const [canonical, setCanonical] = useState(authorization);
  const [busy, setBusy] = useState<string | null>(null);
  const [ending, setEnding] = useState<StudentFerpaDelegate | null>(null);
  const [adding, setAdding] = useState(false);
  const [links, setLinks] = useState<Record<string, string>>(
    () => oneTimeLinks.get(authorization?.id ?? "") ?? {},
  );
  const [copied, setCopied] = useState<string | null>(null);
  const idempotency = useRef<Record<string, string>>({});

  useEffect(() => {
    onOverlay(Boolean(ending));
  }, [ending, onOverlay]);

  useEffect(() => () => onOverlay(false), [onOverlay]);

  const grants = unavailable ? null : (canonical?.status === "completed" ? canonical.delegates : []);
  const completed = canonical?.status === "completed";
  const canManage = Boolean(canonical?.capabilities.canManageAccess);
  const canManageLinks = Boolean(canonical?.capabilities.canManageLinks);

  function fail(caught: unknown) {
    if (caught instanceof ApiClientError && caught.status === 409) {
      onToast({
        tone: "critical",
        title: "Your record changed while you were editing.",
        body: "Nothing was saved. The latest version is loading; try again once it is here.",
      });
      onChanged();
      return;
    }
    onToast({ tone: "critical", title: getApiErrorMessage(caught) });
  }

  async function saveDelegates(next: FerpaDelegateInput[], done: (saved: StudentFerpaAuthorization) => void) {
    if (!canonical) return;
    try {
      const result = await updateStudentFerpaAccess(canonical.id, {
        expectedVersion: canonical.version,
        accessDecision: next.length > 0 ? "grant" : "no_access",
        delegates: next,
      });
      if (!result.authorization) throw new Error("The updated record was not returned.");
      setCanonical(result.authorization);
      done(result.authorization);
      onChanged();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(null);
    }
  }

  function toggleCategory(delegate: StudentFerpaDelegate, category: RecordCategory) {
    if (!canonical || busy) return;
    const shared = delegate.scopes.includes(category.id as FerpaPortalScope);
    const scopes = shared
      ? delegate.scopes.filter((scope) => scope !== category.id)
      : [...delegate.scopes, category.id as FerpaPortalScope];
    const firstName = delegate.fullName.split(" ")[0];
    setBusy(`toggle:${delegate.id}:${category.id}`);
    void saveDelegates(
      canonical.delegates.map((item) => (item.id === delegate.id ? { ...toInput(item), scopes } : toInput(item))),
      () =>
        onToast(
          shared
            ? `${firstName} can no longer see ${category.name}. That took effect now.`
            : `${firstName} can now see ${category.name}. That took effect now.`,
        ),
    );
  }

  function endAccess(delegate: StudentFerpaDelegate) {
    if (!canonical) return;
    setBusy(`end:${delegate.id}`);
    setEnding(null);
    void saveDelegates(
      canonical.delegates.filter((item) => item.id !== delegate.id).map(toInput),
      () => {
        forgetLink(canonical.id, delegate.id);
        setLinks((current) => {
          const next = { ...current };
          delete next[delegate.id];
          return next;
        });
        onToast({
          tone: "success",
          title: `${delegate.fullName} can no longer see anything in your record.`,
          body: "That took effect now. You can grant access again from here whenever you want.",
        });
      },
    );
  }

  function addPerson(input: FerpaDelegateInput) {
    if (!canonical) return;
    setBusy("add");
    void saveDelegates([...canonical.delegates.map(toInput), input], (saved) => {
      setAdding(false);
      const added = saved.delegates.find((item) => item.email === input.email);
      onToast({
        tone: "success",
        title: `${input.fullName} can now see your ${sharedNames(input.scopes)}.`,
        body: added
          ? "Create their secure link on the card below and share it privately."
          : "That took effect now.",
      });
    });
  }

  function linkUrl(token: string) {
    return `${window.location.origin}${runtime.href("/delegate")}#token=${encodeURIComponent(token)}`;
  }

  async function issueLink(delegate: StudentFerpaDelegate) {
    if (!canonical) return;
    setBusy(`issue:${delegate.id}`);
    try {
      const key = (idempotency.current[delegate.id] ||= crypto.randomUUID());
      const result = await issueStudentFerpaDelegateLink(canonical.id, delegate.id, canonical.version, key);
      idempotency.current[delegate.id] = "";
      const url = linkUrl(result.token);
      rememberLink(canonical.id, delegate.id, url);
      setLinks((current) => ({ ...current, [delegate.id]: url }));
      setCanonical((current) =>
        current
          ? {
              ...current,
              version: result.authorizationVersion,
              delegates: current.delegates.map((item) =>
                item.id === delegate.id
                  ? {
                      ...item,
                      link: {
                        ...item.link,
                        status: "active",
                        issuedAt: item.link.issuedAt ?? result.issuedAt,
                        rotatedAt: item.link.status === "active" ? result.issuedAt : item.link.rotatedAt,
                        lastUsedAt: null,
                        updatedAt: result.issuedAt,
                      },
                    }
                  : item,
              ),
            }
          : current,
      );
      onToast({
        tone: "success",
        title: `A secure link is ready for ${delegate.fullName}.`,
        body: "It is shown once. Copy it now and share it privately.",
      });
      onChanged();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(null);
    }
  }

  async function revokeLink(delegate: StudentFerpaDelegate) {
    if (!canonical) return;
    setBusy(`revoke:${delegate.id}`);
    try {
      const result = await revokeStudentFerpaDelegateLink(canonical.id, delegate.id, canonical.version);
      if (!result.authorization) throw new Error("The updated record was not returned.");
      setCanonical(result.authorization);
      forgetLink(canonical.id, delegate.id);
      setLinks((current) => {
        const next = { ...current };
        delete next[delegate.id];
        return next;
      });
      onToast(`${delegate.fullName}’s link no longer works. Their access stays as you set it.`);
      onChanged();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(null);
    }
  }

  async function copyLink(delegate: StudentFerpaDelegate) {
    const url = links[delegate.id];
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(delegate.id);
      window.setTimeout(() => setCopied((current) => (current === delegate.id ? null : current)), 2000);
    } catch {
      onToast({
        tone: "critical",
        title: "Copy was blocked by the browser.",
        body: "Select the secure link and copy it yourself.",
      });
    }
  }

  const heading = (
    <div className="status-heading">
      <span className="status-icon private">
        <Icon name="users" size={18} />
      </span>
      <div>
        <h2 id="access-title">Who can see your record</h2>
        <p>
          {completed
            ? "You set this up when you accepted your offer. It is yours to narrow or end, here, whenever you want."
            : `Your record is private by default. Anyone you name here sees only the sections you pick.`}
        </p>
      </div>
      {grants !== null && completed && <span className="status-count">{grants.length}</span>}
    </div>
  );

  const right = (
    <p className="access-right">
      <Icon name="shield" size={14} />
      <span>
        These are your education records. Under FERPA, sharing them is your choice to make and to
        withdraw — nobody at {tenant.shortName} shares them for you.
      </span>
    </p>
  );

  return (
    <section className="section-card" aria-labelledby="access-title">
      {heading}
      {right}

      {delegateView ? (
        <StateCard variant="empty" icon="lock" title="Managed by the student">
          Only {delegateView.studentName} can add or remove people, change what each one sees, or
          manage secure links. You can keep using every section you were given.
        </StateCard>
      ) : unavailable ? (
        <StateCard
          variant="warn"
          icon="alert"
          title="Who can see your record couldn’t be checked"
          action={{ label: "Try again", icon: "refresh", onClick: onRetry }}
        >
          Nothing changed while it couldn’t be read, and nobody gained access. Everything else on
          this page loaded normally.
        </StateCard>
      ) : !canonical ? (
        <StateCard variant="empty" icon="lock" title="Only you can see your record">
          Your record is private by default. Nobody, not a parent, not a sponsor, sees any of it
          until {tenant.shortName} asks you about it while you enroll and you name them yourself.
          Anything you grant then appears here.
        </StateCard>
      ) : !completed ? (
        /* Not yet signed: the full signing flow, kept where the student looks for it. */
        <div className="access-editor">
          <FerpaAccessCenter mode="manage" onSaved={onChanged} />
        </div>
      ) : grants && grants.length === 0 ? (
        <StateCard variant="empty" icon="lock" title="Only you can see your record">
          Your record is private by default. Nobody, not a parent, not a sponsor, sees any of it
          until you name them and pick the sections yourself. Anything you grant appears here.
        </StateCard>
      ) : (
        <div className="card-rows grant-list">
          {grants?.map((grant) => (
            <PermissionGrant
              key={grant.id}
              grant={grant}
              busy={busy}
              canManage={canManage}
              canManageLinks={canManageLinks}
              link={links[grant.id] ?? null}
              copied={copied === grant.id}
              locale={tenant.localization.locale}
              tenantShortName={tenant.shortName}
              onToggle={toggleCategory}
              onRevoke={setEnding}
              onIssueLink={(delegate) => void issueLink(delegate)}
              onRevokeLink={(delegate) => void revokeLink(delegate)}
              onCopyLink={(delegate) => void copyLink(delegate)}
            />
          ))}
        </div>
      )}

      {completed && canManage && !delegateView && !unavailable ? (
        adding ? (
          <AddPersonForm
            busy={busy === "add"}
            existing={canonical?.delegates.map((item) => item.email.toLowerCase()) ?? []}
            onCancel={() => setAdding(false)}
            onSubmit={addPerson}
          />
        ) : (
          <div className="grant-add">
            <Button
              kind="secondary"
              leadingIcon="plus"
              disabled={busy !== null || (canonical?.delegates.length ?? 0) >= 4}
              onClick={() => setAdding(true)}
            >
              Give someone access
            </Button>
            {(canonical?.delegates.length ?? 0) >= 4 ? (
              <small>Up to four people can be given access.</small>
            ) : null}
          </div>
        )
      ) : null}

      <p className="card-foot grant-aside">
        <Icon name="info" size={14} />
        <span>
          An emergency contact is a different thing. They are who {tenant.shortName} calls if
          something happens to you, and they get no access to any of the {RECORD_CATEGORIES.length}{" "}
          sections above.
        </span>
      </p>

      {ending && (
        <InfoModal
          variant="access"
          kicker="Who can see what"
          icon="users"
          title={`End ${ending.fullName}’s access?`}
          onClose={() => setEnding(null)}
        >
          <p>
            {ending.fullName.split(" ")[0]} will stop seeing your {sharedNames(ending.scopes)}, and
            their secure link will stop working. That takes effect now. It is your record, and
            sharing it is your choice to make and to withdraw — you can grant access again later.
          </p>
          <div className="drawer-actions modal-actions">
            <Button kind="primary" icon="close" onClick={() => endAccess(ending)}>
              End access
            </Button>
            <Button kind="secondary" onClick={() => setEnding(null)}>
              Keep sharing
            </Button>
          </div>
        </InfoModal>
      )}
    </section>
  );
}

function PermissionGrant({
  grant,
  busy,
  canManage,
  canManageLinks,
  link,
  copied,
  locale,
  tenantShortName,
  onToggle,
  onRevoke,
  onIssueLink,
  onRevokeLink,
  onCopyLink,
}: {
  grant: StudentFerpaDelegate;
  busy: string | null;
  canManage: boolean;
  canManageLinks: boolean;
  link: string | null;
  copied: boolean;
  locale: string;
  tenantShortName: string;
  onToggle: (grant: StudentFerpaDelegate, category: RecordCategory) => void;
  onRevoke: (grant: StudentFerpaDelegate) => void;
  onIssueLink: (grant: StudentFerpaDelegate) => void;
  onRevokeLink: (grant: StudentFerpaDelegate) => void;
  onCopyLink: (grant: StudentFerpaDelegate) => void;
}) {
  const firstName = grant.fullName.split(" ")[0];
  const issued = formatDate(grant.link.issuedAt, locale);
  const lastUsed = formatDate(grant.link.lastUsedAt, locale);
  const linkBusy = busy === `issue:${grant.id}` || busy === `revoke:${grant.id}`;

  return (
    <article className="permission-grant">
      <header className="grant-head">
        <Avatar person={{ name: grant.fullName }} size="md" className="grant-avatar" />
        <div className="grant-who">
          <strong>{grant.fullName}</strong>
          <p>
            {relationshipLabel(grant.relationship)} · {grant.email}
            {issued ? ` · link issued ${issued}` : ""}
          </p>
        </div>
        <span className="grant-window">
          <Icon name={grant.link.status === "active" ? "check" : "clock"} size={13} />{" "}
          {grant.link.status === "active"
            ? lastUsed
              ? `Link used ${lastUsed}`
              : "Link active"
            : grant.link.status === "revoked"
              ? "Link revoked"
              : "No link yet"}
        </span>
      </header>

      {grant.legacyReviewRequired ? (
        <p className="grant-purpose">
          <Icon name="info" size={14} />
          <span>
            This was set up under an earlier version of the form. <em>Check what {firstName} can see.</em>
          </span>
        </p>
      ) : null}

      <fieldset className="permission-set" disabled={!canManage || busy !== null}>
        <legend>
          <strong>What {firstName} can see</strong> · {grant.scopes.length} of{" "}
          {RECORD_CATEGORIES.length}: {sharedNames(grant.scopes)}
        </legend>
        <div className="permission-grid">
          {RECORD_CATEGORIES.map((category) => {
            const shared = grant.scopes.includes(category.id as FerpaPortalScope);
            return (
              <label key={category.id} className={shared ? "granted" : ""}>
                <input type="checkbox" checked={shared} onChange={() => onToggle(grant, category)} />
                <span className="permission-copy">
                  <strong>{category.name}</strong>
                  <small>{category.sees}</small>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {canManageLinks ? (
        <div className="grant-link">
          <p>
            <Icon name="lock" size={14} />
            <span>
              {firstName} signs in with a secure link. Anyone holding it can act within the sections
              above, so share it privately.
              {grant.link.status === "active" && !link
                ? " The link itself cannot be shown again; a replacement retires the old one."
                : ""}
            </span>
          </p>
          {link ? (
            <div className="grant-link-reveal" role="status">
              <label>
                <span>Copy now — this link is only shown once</span>
                <input readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
              </label>
              <Button kind="secondary" leadingIcon="copy" onClick={() => onCopyLink(grant)}>
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          ) : null}
          <div className="grant-link-actions">
            <Button
              kind="secondary"
              leadingIcon={grant.link.status === "active" ? "refresh" : "plus"}
              pending={busy === `issue:${grant.id}`}
              disabled={busy !== null && !linkBusy}
              onClick={() => onIssueLink(grant)}
            >
              {grant.link.status === "active" ? "Replace the link" : "Create a secure link"}
            </Button>
            {grant.link.status === "active" ? (
              <Button
                kind="text"
                leadingIcon="close"
                pending={busy === `revoke:${grant.id}`}
                disabled={busy !== null && !linkBusy}
                onClick={() => onRevokeLink(grant)}
              >
                Stop the link
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grant-foot">
        <p>
          <Icon name="shield" size={14} />
          Uncheck a section and {tenantShortName} stops sharing it right away. {tenantShortName}{" "}
          never tells {firstName} what you do in the portal.
        </p>
        <button
          className="revoke-button"
          aria-label={`Revoke all access for ${grant.fullName}`}
          disabled={!canManage || busy !== null}
          onClick={() => onRevoke(grant)}
        >
          <Icon name="close" size={14} /> Revoke all access
        </button>
      </div>
    </article>
  );
}

function AddPersonForm({
  busy,
  existing,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  existing: string[];
  onCancel: () => void;
  onSubmit: (input: FerpaDelegateInput) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState<StudentFerpaDelegate["relationship"]>("parent");
  const [scopes, setScopes] = useState<FerpaPortalScope[]>([]);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = fullName.trim();
    const address = email.trim().toLowerCase();
    if (!name || !address) return setError("Enter a name and an email for this person.");
    if (!address.includes("@")) return setError("Enter a valid email address.");
    if (existing.includes(address)) return setError("Someone with that email already has access.");
    if (scopes.length === 0) return setError(`Choose at least one section for ${name}.`);
    setError(null);
    onSubmit({ fullName: name, email: address, relationship, scopes });
  }

  return (
    <form className="permission-grant grant-new" onSubmit={submit}>
      <header className="grant-head">
        <Avatar person={{ name: fullName.trim() || "New person", initials: fullName.trim() ? undefined : "+" }} size="md" className="grant-avatar" />
        <div className="grant-who">
          <strong>{fullName.trim() || "Someone new"}</strong>
          <p>Name them, say who they are, and pick what they see. Nothing is shared until you save.</p>
        </div>
      </header>

      <div className="grant-fields">
        <label className="field">
          <span className="field-label">Full name</span>
          <span className="field-control">
            <input value={fullName} autoComplete="name" maxLength={160} onChange={(e) => setFullName(e.target.value)} />
          </span>
        </label>
        <label className="field">
          <span className="field-label">Email</span>
          <span className="field-control">
            <input type="email" value={email} autoComplete="email" maxLength={254} onChange={(e) => setEmail(e.target.value)} />
          </span>
        </label>
        <label className="field">
          <span className="field-label">Who they are to you</span>
          <span className="field-control">
            <select value={relationship} onChange={(e) => setRelationship(e.target.value as StudentFerpaDelegate["relationship"])}>
              {RELATIONSHIPS.map((value) => (
                <option key={value} value={value}>
                  {relationshipLabel(value)}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>

      <fieldset className="permission-set">
        <legend>
          <strong>What they can see</strong> · {scopes.length} of {RECORD_CATEGORIES.length}:{" "}
          {sharedNames(scopes)}
        </legend>
        <div className="permission-grid">
          {RECORD_CATEGORIES.map((category) => {
            const shared = scopes.includes(category.id as FerpaPortalScope);
            return (
              <label key={category.id} className={shared ? "granted" : ""}>
                <input
                  type="checkbox"
                  checked={shared}
                  onChange={() =>
                    setScopes((current) =>
                      shared
                        ? current.filter((scope) => scope !== category.id)
                        : [...current, category.id as FerpaPortalScope],
                    )
                  }
                />
                <span className="permission-copy">
                  <strong>{category.name}</strong>
                  <small>{category.sees}</small>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {error ? (
        <p className="field-error" role="alert">
          <Icon name="alert" size={13} /> {error}
        </p>
      ) : null}

      <div className="grant-foot">
        <div className="grant-link-actions">
          <Button kind="primary" type="submit" icon="arrow" pending={busy}>
            Give access
          </Button>
          <Button kind="secondary" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
