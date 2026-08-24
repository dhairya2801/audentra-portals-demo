"use client";

import type {
  StudentBootstrap,
  StudentDocument,
  StudentFerpaAuthorization,
  StudentProfile,
  StudentRequirementDetail,
  UpdateStudentProfileInput,
} from "@vv/contracts";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Icon from "../design-system/Icon.jsx";
import Avatar from "../design-system/primitives/Avatar.jsx";
import GroupTabs from "../design-system/patterns/GroupTabs.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import PageError from "../design-system/patterns/PageError.jsx";
import PageSkeleton from "../design-system/patterns/PageSkeleton.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import ToastStack from "../design-system/patterns/Toast.jsx";
import { useToasts } from "../design-lib/toast.js";
import { openEdward } from "../design-lib/door.js";
import DocumentsPanel from "../components/documents-panel";
import {
  beginDocumentExtractionProjection,
  preferredDocumentProjection,
  reconcileDocumentExtractionProjection,
  type DocumentExtractionProjectionState,
} from "../lib/document-extraction-ui";
import { PortalShell } from "../components/portal-shell";
import ProfileAccess, { type ToastInput } from "../components/profile-access";
import ProfileFieldRow, { type FieldEdit } from "../components/profile-field-row";
import {
  type ChannelId,
  type FieldGroup,
  type Office,
  type ProfileField,
  buildProfile,
  channelOptions,
  formatDate,
  identityFor,
  officesFor,
  profilePhotoDocument,
  runsFor,
} from "../components/profile-logic";
import ProfileOrigins from "../components/profile-origins";
import ProfileRail from "../components/profile-rail";
import { useTenant } from "../components/tenant-provider";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ApiClientError,
  getStudentBootstrap,
  getStudentDocumentProfilePhoto,
  getStudentDocuments,
  getStudentFerpaAuthorization,
  getStudentProfile,
  getStudentRequirements,
  signOutFerpaDelegate,
  signOutStudent,
  updateStudentProfile,
} from "../lib/api-client";
import { getApiErrorMessage } from "../hooks/use-api-resource";

/**
 * Profile — the reference's `ProfilePage`, sectioned, not scrolled: five
 * leaves under one hero (About me, Contact and communication, Who can see
 * what, My documents, Where I came from), the tab row under the hero is what
 * changes, and `?section=` names the leaf. The legend ("n of m details are
 * yours") and the version line stay above the tabs on every leaf.
 *
 * Everything on it is read from the record the platform holds — the profile,
 * the documents, the checklist's document requirements and the FERPA
 * authorization — and every change goes back through the same API.
 */

type Section =
  | "profile"
  | "profile-contact"
  | "profile-access"
  | "profile-documents"
  | "profile-origins";

const SECTIONS: Record<string, Section> = {
  contact: "profile-contact",
  access: "profile-access",
  documents: "profile-documents",
  origins: "profile-origins",
};

type DelegateActor = Extract<NonNullable<StudentBootstrap["actor"]>, { type: "delegate" }>;

type Loaded = {
  bootstrap: StudentBootstrap;
  delegate: DelegateActor | null;
  profile: StudentProfile;
  documents: { status: "ready"; items: StudentDocument[] } | { status: "hidden" } | { status: "unavailable" };
  requirements: StudentRequirementDetail[];
  ferpa:
    | { status: "ready"; authorization: StudentFerpaAuthorization | null }
    | { status: "unavailable" }
    | { status: "delegate" };
};

function ProfilePageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const runtime = useTenant();
  const { tenant } = runtime;
  const active: Section = SECTIONS[params.get("section") ?? ""] ?? "profile";
  const openDocumentId = params.get("document");
  const highlight = params.get("line");
  const { toasts, push, dismiss } = useToasts();
  // `toast.js` knows `critical`; the loose module typing lists an older tone set.
  const pushToast = useCallback(
    (toast: ToastInput) => push(toast as unknown as Parameters<typeof push>[0]),
    [push],
  );

  const load = useCallback(async (signal: AbortSignal): Promise<Loaded> => {
    const bootstrap = await getStudentBootstrap(signal);
    const delegate = bootstrap.actor?.type === "delegate" ? bootstrap.actor : null;
    const canReadDocuments = !delegate || delegate.scopes.includes("documents");
    const canReadEnrollment = !delegate || delegate.scopes.includes("enrollment");
    const [profile, documents, requirements, ferpa] = await Promise.all([
      getStudentProfile(signal),
      canReadDocuments
        ? getStudentDocuments(signal).then(
            (list): Loaded["documents"] => ({ status: "ready", items: list.items }),
            (): Loaded["documents"] => ({ status: "unavailable" }),
          )
        : Promise.resolve<Loaded["documents"]>({ status: "hidden" }),
      canReadEnrollment
        ? getStudentRequirements(signal).then(
            (list) => list.items,
            () => [] as StudentRequirementDetail[],
          )
        : Promise.resolve([] as StudentRequirementDetail[]),
      delegate
        ? Promise.resolve<Loaded["ferpa"]>({ status: "delegate" })
        : getStudentFerpaAuthorization(signal).then(
            (result): Loaded["ferpa"] => ({ status: "ready", authorization: result.authorization }),
            (): Loaded["ferpa"] => ({ status: "unavailable" }),
          ),
    ]);
    return { bootstrap, delegate, profile, documents, requirements, ferpa };
  }, []);
  const resource = useApiResource(load);
  const refresh = resource.refresh;

  // A save returns the new record; keep it until the next load catches up.
  const [saved, setSaved] = useState<StudentProfile | null>(null);
  const profile =
    resource.data && saved && saved.version >= resource.data.profile.version
      ? saved
      : (resource.data?.profile ?? null);

  const serverDocuments = useMemo(
    () => (resource.data?.documents.status === "ready" ? resource.data.documents.items : []),
    [resource.data],
  );

  // A retry or a confirmation answers with the document as it now is. That
  // answer is kept over the list until the server has caught up with it, so a
  // stale read can never show "failed" again after she pressed retry.
  const [documentProjections, setDocumentProjections] = useState<
    Record<string, DocumentExtractionProjectionState>
  >({});
  // Reconciled while rendering, against the list just loaded: the projection
  // remembers whether the server has been seen processing, so a later terminal
  // answer is known to be the new one and not the stale one it replaced.
  const [reconciledFor, setReconciledFor] = useState(serverDocuments);
  if (reconciledFor !== serverDocuments) {
    setReconciledFor(serverDocuments);
    let changed = false;
    const next = { ...documentProjections };
    for (const [id, projection] of Object.entries(documentProjections)) {
      const candidate = serverDocuments.find((document) => document.id === id);
      if (!candidate) continue;
      const updated = reconcileDocumentExtractionProjection(projection, candidate);
      if (
        updated.document !== projection.document ||
        updated.supersededTerminalFingerprint !== projection.supersededTerminalFingerprint ||
        updated.observedCurrentProcessing !== projection.observedCurrentProcessing
      ) {
        next[id] = updated;
        changed = true;
      }
    }
    if (changed) setDocumentProjections(next);
  }
  const documents = useMemo(() => {
    const byId = new Map(serverDocuments.map((document) => [document.id, document]));
    for (const projection of Object.values(documentProjections)) {
      byId.set(
        projection.document.id,
        preferredDocumentProjection(byId.get(projection.document.id), projection),
      );
    }
    return [...byId.values()];
  }, [documentProjections, serverDocuments]);
  const documentsUnavailable = resource.data?.documents.status === "unavailable";
  const documentsHidden = resource.data?.documents.status === "hidden";
  const requirements = resource.data?.requirements ?? [];

  // Edward is still reading something: the record refreshes on its own.
  const processing = documents.some((document) => document.extraction?.status === "processing");
  useEffect(() => {
    if (!processing) return;
    const interval = window.setInterval(refresh, 2_500);
    return () => window.clearInterval(interval);
  }, [processing, refresh]);

  // Her own photograph, read out of the identity document she uploaded.
  const photoDocument = useMemo(() => profilePhotoDocument(documents), [documents]);
  const [photo, setPhoto] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!photoDocument) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    void getStudentDocumentProfilePhoto(photoDocument.id, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPhoto({ id: photoDocument.id, url: objectUrl });
      })
      .catch(() => {
        // The photo stays private when this session cannot read it.
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoDocument]);

  /* ------------------------------------------------------------------ *
   * Editing — one field at a time, saved through `updateStudentProfile`
   * ------------------------------------------------------------------ */
  const [edits, setEdits] = useState<Record<string, FieldEdit>>({});
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [channelSaving, setChannelSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const setOverlay = useCallback(() => {}, []);

  const identityRequirement = requirements.find(
    (item) => item.submissionType === "document" && item.documentCategory === "identity",
  );
  const transcriptRequirement = requirements.find(
    (item) => item.submissionType === "document" && item.documentCategory === "transcript",
  );

  function go(path: string) {
    router.push(runtime.href(path));
  }

  function changePhoto() {
    if (photoDocument) {
      go(`/profile?section=documents&document=${encodeURIComponent(photoDocument.id)}`);
    } else if (identityRequirement) {
      go(`/enrollment/requirements/${identityRequirement.slug}`);
    } else {
      go("/profile?section=documents");
    }
  }

  function editField(field: ProfileField) {
    if (field.photo) return changePhoto();
    if (!field.editKey) return;
    setEdits((current) => ({
      ...current,
      [field.id]: { draft: field.value ?? "", saving: false, error: null, conflict: false },
    }));
  }

  function patchEdit(id: string, patch: Partial<FieldEdit>) {
    setEdits((current) =>
      current[id] ? { ...current, [id]: { ...current[id], ...patch } } : current,
    );
  }

  async function saveProfile(input: Omit<UpdateStudentProfileInput, "expectedVersion">) {
    if (!profile) throw new Error("The profile has not loaded.");
    const next = await updateStudentProfile({ expectedVersion: profile.version, ...input });
    setSaved(next);
    refresh();
    return next;
  }

  async function saveField(field: ProfileField) {
    const edit = edits[field.id];
    if (!edit || !field.editKey) return;
    const value = edit.draft.trim();
    if (field.editKey === "preferredName" && !value) {
      patchEdit(field.id, { error: "A preferred name can’t be blank." });
      return;
    }
    patchEdit(field.id, { saving: true, error: null });
    try {
      await saveProfile({ [field.editKey]: field.editKey === "preferredName" ? value : value || null });
      setEdits((current) => {
        const next = { ...current };
        delete next[field.id];
        return next;
      });
      push({
        tone: "success",
        title: `Your ${field.label.toLowerCase()} is saved.`,
        body: "That took effect now, everywhere in the portal.",
      });
    } catch (caught) {
      const conflict = caught instanceof ApiClientError && caught.status === 409;
      patchEdit(field.id, {
        saving: false,
        conflict,
        error: conflict
          ? "Your record changed since this page loaded. Load the latest and save again — what you typed is kept."
          : getApiErrorMessage(caught),
      });
    }
  }

  function cancelEdit(field: ProfileField) {
    setEdits((current) => {
      const next = { ...current };
      delete next[field.id];
      return next;
    });
  }

  function reloadForEdit(field: ProfileField) {
    setSaved(null);
    patchEdit(field.id, { conflict: false, error: null });
    refresh();
  }

  async function chooseChannel(id: ChannelId) {
    if (!profile || id === profile.communicationPreference) return;
    const [, label] = channelOptions.find(([value]) => value === id) ?? [id, id];
    setChannelSaving(true);
    try {
      await saveProfile({ communicationPreference: id });
      push({
        tone: "success",
        title: `${tenant.shortName} will reach you by ${label.toLowerCase()} first.`,
        body: "That takes effect now, for every kind of message.",
      });
    } catch (caught) {
      const conflict = caught instanceof ApiClientError && caught.status === 409;
      pushToast({
        tone: "critical",
        title: conflict ? "Your record changed since this page loaded." : getApiErrorMessage(caught),
        body: conflict ? "Nothing was saved. The latest version is loading; choose again once it is here." : undefined,
      });
      if (conflict) {
        setSaved(null);
        refresh();
      }
    } finally {
      setChannelSaving(false);
    }
  }

  function askOffice(office: Office, field?: ProfileField) {
    openEdward({
      question: field
        ? `How do I reach ${office.name} about my ${field.label.toLowerCase()}?`
        : `How do I reach ${office.name}?`,
      context: {
        label: office.name,
        intent: "contact-office",
        office: office.id,
        topic: field ? field.id : "profile",
      },
    });
  }

  async function signOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await (resource.data?.delegate ? signOutFerpaDelegate() : signOutStudent());
      window.location.replace(runtime.href("/sign-in"));
    } catch (caught) {
      setSignOutError(getApiErrorMessage(caught));
      setSigningOut(false);
    }
  }

  const onDocumentChanged = useCallback(
    (document: StudentDocument) => {
      setDocumentProjections((current) => ({
        ...current,
        [document.id]: beginDocumentExtractionProjection(
          document,
          current[document.id]?.document ??
            serverDocuments.find((candidate) => candidate.id === document.id),
        ),
      }));
      refresh();
    },
    [refresh, serverDocuments],
  );

  /* ------------------------------------------------------------------ *
   * Render
   * ------------------------------------------------------------------ */
  if (resource.status === "loading" || !resource.data || !profile) {
    return (
      <PortalShell active="profile">
        {resource.status === "error" ? (
          <PageError label="your profile" onRetry={resource.reload} />
        ) : (
          <PageSkeleton label="your profile" />
        )}
      </PortalShell>
    );
  }

  const data = resource.data;
  const offices = officesFor(tenant, data.bootstrap.tenant);
  const identity = identityFor(
    profile,
    photo && photoDocument && photo.id === photoDocument.id ? photo.url : null,
  );
  const { groups, ownership, blanks } = buildProfile(profile, {
    photoOnFile: Boolean(photoDocument),
    photoUnavailable: documentsUnavailable || documentsHidden,
    tenantShortName: tenant.shortName,
  });
  const you = groups.find((group) => group.id === "you") as FieldGroup;
  const contact = groups.find((group) => group.id === "contact") as FieldGroup;
  const channel = profile.communicationPreference;
  const textBlocked = channel === "sms" && !profile.phoneVerified;
  const unchecked = profile.emailVerified === undefined && profile.phoneVerified === undefined;

  const grants =
    data.ferpa.status === "unavailable"
      ? null
      : data.ferpa.status === "ready" && data.ferpa.authorization?.status === "completed"
        ? data.ferpa.authorization.delegates.map((delegate) => ({
            name: delegate.fullName,
            endsOn: null,
          }))
        : [];

  const hero = {
    kicker: `Profile · Version ${profile.version} · Updated ${formatDate(profile.updatedAt, tenant.localization.locale) ?? "today"}`,
    title: `What ${tenant.shortName} knows about you.`,
    figure: (
      <>
        <Avatar person={identity} size="xl" alone />
        <button type="button" className="hero-figure-action" onClick={changePhoto}>
          <Icon name="camera" size={14} /> {identity.photo ? "Change photo" : "Add a photo"}
        </button>
      </>
    ),
  };

  const note = (
    <Notice tone="quiet" icon="shield">
      <strong>
        {ownership.yours} of {ownership.total} details are yours.
      </strong>{" "}
      Everything under <strong>Yours to change</strong> you can change here, and the change takes
      effect at once. Everything under <strong>{tenant.shortName}’s record</strong> belongs to the
      office named beside it. Each of those rows shows how to reach them.
      {blanks > 0 && (
        <em>
          {" "}
          {blanks} of yours {blanks === 1 ? "is" : "are"} still blank.
        </em>
      )}
      {unchecked && (
        <em> Verification couldn’t be checked just now, so no row on this page claims to be verified.</em>
      )}
      {identity.usingLegalName && (
        <em> {tenant.shortName} is using your legal first name until you set a preferred one.</em>
      )}
    </Notice>
  );

  function groupCard(group: FieldGroup) {
    return (
      <section className="section-card" key={group.id} aria-labelledby={`${group.id}-title`}>
        <div className="status-heading">
          <span className="status-icon record">
            <Icon name={group.icon} size={18} />
          </span>
          <div>
            <h2 id={`${group.id}-title`}>{group.title}</h2>
            <p>{group.lede}</p>
          </div>
        </div>

        <div className="card-rows field-rows">
          {runsFor(group, offices, tenant.shortName).map((run) => (
            <Fragment key={run.id}>
              <p className={`rows-label ${run.id}`}>
                <Icon name={run.icon} size={12} />
                <span>{run.label}</span>
                <em>{run.hint}</em>
              </p>
              {run.fields.map((field) => (
                <ProfileFieldRow
                  key={field.id}
                  field={field}
                  offices={offices}
                  channel={channel}
                  channelSaving={channelSaving}
                  textBlocked={textBlocked}
                  choiceOpen={field.choice ? choiceOpen : false}
                  edit={edits[field.id] ?? null}
                  onToggleChoice={() => setChoiceOpen((open) => !open)}
                  onChannel={(id) => void chooseChannel(id)}
                  onEdit={editField}
                  onDraft={(target, value) => patchEdit(target.id, { draft: value })}
                  onSave={(target) => void saveField(target)}
                  onCancel={cancelEdit}
                  onReload={reloadForEdit}
                  onAsk={askOffice}
                />
              ))}
            </Fragment>
          ))}
        </div>
      </section>
    );
  }

  return (
    <PortalShell
      active="profile"
      hero={hero}
      notice={note}
      tabs={<GroupTabs group="profile" activeId={active} />}
      rail={
        <ProfileRail
          grants={grants}
          offices={Object.values(offices)}
          signingOut={signingOut}
          signOutError={signOutError}
          onSignOut={() => void signOut()}
          onAsk={(office) => askOffice(office)}
        />
      }
    >
      {active === "profile" && groupCard(you)}

      {active === "profile-contact" && groupCard(contact)}

      {active === "profile-access" && (
        <ProfileAccess
          key={`${data.ferpa.status}:${data.ferpa.status === "ready" ? `${data.ferpa.authorization?.id ?? "none"}:${data.ferpa.authorization?.version ?? 0}` : ""}`}
          authorization={data.ferpa.status === "ready" ? data.ferpa.authorization : null}
          unavailable={data.ferpa.status === "unavailable"}
          delegateView={data.delegate ? { studentName: data.delegate.studentName } : null}
          onChanged={refresh}
          onRetry={resource.reload}
          onToast={pushToast}
          onOverlay={setOverlay}
        />
      )}

      {active === "profile-documents" &&
        (documentsHidden ? (
          <section className="section-card documents-section" aria-labelledby="documents-section-title">
            <div className="status-heading">
              <span className="status-icon record">
                <Icon name="file" size={18} />
              </span>
              <div>
                <h2 id="documents-section-title">Everything on file</h2>
                <p>This section was not shared with you.</p>
              </div>
            </div>
            <StateCard variant="empty" icon="lock" title="Documents are not part of your access">
              {data.delegate?.studentName ?? "The student"} chose which sections you can see, and
              documents are not one of them.
            </StateCard>
          </section>
        ) : (
          <DocumentsPanel
            requirements={requirements}
            documents={documents}
            unavailable={documentsUnavailable}
            openId={openDocumentId}
            onOpenChange={setOverlay}
            onDocumentChanged={onDocumentChanged}
            onRetry={resource.reload}
          />
        ))}

      {active === "profile-origins" && (
        <ProfileOrigins
          documents={documents}
          highlight={highlight}
          unavailable={documentsUnavailable || documentsHidden}
          transcriptRoute={
            transcriptRequirement ? `/enrollment/requirements/${transcriptRequirement.slug}` : null
          }
          tenantShortName={tenant.shortName}
          locale={tenant.localization.locale}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </PortalShell>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <PortalShell active="profile">
          <PageSkeleton label="your profile" />
        </PortalShell>
      }
    >
      <ProfilePageContent />
    </Suspense>
  );
}
