"use client";

import type {
  CompleteStudentFerpaInput,
  FerpaDelegateInput,
  FerpaPortalScope,
  StudentFerpaAuthorization,
  StudentFerpaDelegate,
} from "@vv/contracts";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ApiClientError,
  completeStudentFerpaAuthorization,
  getStudentBootstrap,
  getStudentFerpaAuthorization,
  issueStudentFerpaDelegateLink,
  revokeStudentFerpaDelegateLink,
  updateStudentFerpaAccess,
} from "../lib/api-client";
import { useTenant } from "./tenant-provider";
import { ErrorState, LoadingState } from "./portal-ui";
import styles from "./ferpa-access-center.module.css";

export type FerpaAccessCenterMode = "task" | "manage" | "delegate";

const scopeOptions: ReadonlyArray<{
  value: FerpaPortalScope;
  label: string;
  description: string;
  symbol: string;
}> = [
  { value: "dashboard", label: "Dashboard", description: "See the student home and high-level progress", symbol: "⌂" },
  { value: "enrollment", label: "My Enrollment", description: "View and act on enrollment requirements", symbol: "✓" },
  { value: "financials", label: "My Financials", description: "See aid, balances, and financial next steps", symbol: "$" },
  { value: "classrooms", label: "My Classrooms", description: "Review courses and academic information", symbol: "▤" },
  { value: "campus_life", label: "My Campus Life", description: "Explore events, clubs, and campus activities", symbol: "◎" },
  { value: "edward", label: "Edward AI", description: "Use the student’s AI support workspace", symbol: "✦" },
  { value: "documents", label: "My Documents", description: "View and upload student documents", symbol: "↑" },
  { value: "messages", label: "Messages", description: "Read portal messages and mark them reviewed", symbol: "✉" },
  { value: "appointments", label: "Appointments", description: "Schedule and review advising appointments", symbol: "◷" },
  { value: "payments", label: "Payments", description: "View and complete eligible payments", symbol: "◇" },
  { value: "profile", label: "Profile", description: "View and update ordinary profile details", symbol: "○" },
  { value: "help", label: "Help", description: "Contact support and review help resources", symbol: "?" },
];

const FERPA_DOCUMENT_ASSET_PREFIXES = new Set(["aster", "harvard"]);
const DEFAULT_FERPA_DOCUMENT_ASSET_PREFIX = "aster";

type FerpaDocumentAsset = {
  name: string;
  pdf: string;
  preview: string;
  signatureBox: { x: number; y: number; width: number; height: number };
};

function ferpaDocumentForTenant(
  tenantSlug: string,
  tenantShortName: string,
): FerpaDocumentAsset {
  const assetPrefix = FERPA_DOCUMENT_ASSET_PREFIXES.has(tenantSlug)
    ? tenantSlug
    : DEFAULT_FERPA_DOCUMENT_ASSET_PREFIX;
  return {
    name: `${tenantShortName} FERPA Information Release`,
    pdf: `/documents/onboarding/${assetPrefix}-ferpa-release.pdf`,
    preview: `/documents/onboarding/${assetPrefix}-ferpa-release-page-1.png`,
    signatureBox: { x: 9.8, y: 44.7, width: 53, height: 5.4 },
  };
}

type FerpaDelegateRelationship = StudentFerpaDelegate["relationship"];

const relationshipOptions: Array<{ value: FerpaDelegateRelationship; label: string }> = [
  { value: "parent", label: "Parent" },
  { value: "guardian", label: "Guardian" },
  { value: "partner", label: "Spouse or partner" },
  { value: "relative", label: "Relative" },
  { value: "sponsor", label: "Sponsor" },
  { value: "other", label: "Other trusted person" },
];

type DelegateDraft = FerpaDelegateInput & { clientKey: string };

function draftFromDelegate(delegate: StudentFerpaDelegate): DelegateDraft {
  return { ...delegate, clientKey: delegate.id };
}

function emptyDelegate(): DelegateDraft {
  return {
    clientKey: crypto.randomUUID(),
    fullName: "",
    relationship: "parent",
    email: "",
    scopes: [],
  };
}

function normalizedDelegates(delegates: DelegateDraft[]): FerpaDelegateInput[] {
  return delegates.map((delegate) => ({
    id: delegate.id || undefined,
    fullName: delegate.fullName.trim(),
    relationship: delegate.relationship,
    email: delegate.email.trim().toLowerCase(),
    scopes: [...new Set(delegate.scopes)],
  }));
}

function relationshipLabel(value: FerpaDelegateRelationship) {
  return relationshipOptions.find((option) => option.value === value)?.label ?? "Delegate";
}

function SignaturePad({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const begin = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const current = point(event);
    context.beginPath();
    context.moveTo(current.x, current.y);
  };

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const current = point(event);
    context.strokeStyle = "#17324d";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineTo(current.x, current.y);
    context.stroke();
  };

  const finish = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !drawing.current) return;
    drawing.current = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className={styles.signaturePad}>
      <canvas
        ref={canvasRef}
        width={760}
        height={180}
        aria-label="Draw your signature"
        onPointerDown={begin}
        onPointerMove={draw}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
      <div>
        <small>{value ? "Signature captured" : "Use a mouse, touch, or pen"}</small>
        <button type="button" onClick={clear}>Clear signature</button>
      </div>
    </div>
  );
}

function FerpaDocumentPreview({
  document,
  signerName,
  signatureMethod,
  signatureImageData,
}: {
  document: FerpaDocumentAsset;
  signerName: string;
  signatureMethod: "typed" | "drawn";
  signatureImageData?: string;
}) {
  return (
    <fieldset className="form-section document-packet">
      <legend>Read your FERPA authorization</legend>
      <div className="document-packet__stage">
        <div className="document-packet__page">
          <img src={document.preview} alt={`${document.name} page 1`} />
          <div
            className="document-signature-placement"
            style={{
              left: `${document.signatureBox.x}%`,
              top: `${document.signatureBox.y}%`,
              width: `${document.signatureBox.width}%`,
              height: `${document.signatureBox.height}%`,
            }}
            aria-label="FERPA signature placement preview"
          >
            {signatureMethod === "drawn" && signatureImageData ? (
              <img src={signatureImageData} alt="Your drawn FERPA signature" />
            ) : signerName.trim() ? (
              <span>{signerName.trim()}</span>
            ) : null}
          </div>
        </div>
        <div className="document-packet__caption">
          <strong>{document.name}</strong>
          <span>Page 1 of 1 · signature location highlighted</span>
          <a href={document.pdf} target="_blank" rel="noreferrer">
            Open the full PDF
          </a>
        </div>
      </div>
    </fieldset>
  );
}

function StudentManagedNotice({ studentName }: { studentName?: string }) {
  return (
    <section className={styles.managedNotice} aria-labelledby="ferpa-managed-title">
      <span aria-hidden="true">◆</span>
      <div>
        <p className={styles.eyebrow}>FERPA privacy control</p>
        <h2 id="ferpa-managed-title">Managed by the student</h2>
        <p>
          Only {studentName || "the student"} can sign the FERPA authorization,
          add or remove people, change page access, or manage secure links. You
          can continue using every non-FERPA action available in your granted sections.
        </p>
      </div>
    </section>
  );
}

function FerpaEditor({
  initial,
  mode,
  requirementId,
  onSaved,
}: {
  initial: StudentFerpaAuthorization;
  mode: Exclude<FerpaAccessCenterMode, "delegate">;
  requirementId?: string;
  onSaved?: () => void;
}) {
  const tenantRuntime = useTenant();
  const { tenant } = tenantRuntime;
  const [canonical, setCanonical] = useState(initial);
  const [expectedVersion, setExpectedVersion] = useState(initial.version);
  const [decision, setDecision] = useState<"grant" | "no_access" | null>(initial.accessDecision);
  const [delegates, setDelegates] = useState<DelegateDraft[]>(() =>
    initial.delegates.length ? initial.delegates.map(draftFromDelegate) : [],
  );
  const [signerName, setSignerName] = useState(
    initial.document.status === "signed" ? initial.document.signerName : "",
  );
  const [signatureMethod, setSignatureMethod] = useState<"typed" | "drawn">("typed");
  const [signatureImageData, setSignatureImageData] = useState("");
  const [signatureReady, setSignatureReady] = useState(initial.document.status === "signed");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [revealedLinks, setRevealedLinks] = useState<Record<string, string>>({});
  const [copiedDelegate, setCopiedDelegate] = useState<string | null>(null);
  const idempotencyKeys = useRef<Record<string, string>>({});
  const feedbackRef = useRef<HTMLDivElement>(null);
  const delegateListRef = useRef<HTMLDivElement>(null);
  const addDelegateButtonRef = useRef<HTMLButtonElement>(null);
  const isCompleted = canonical.status === "completed";
  const canManage = canonical.capabilities.canManageAccess;
  const ferpaDocument = ferpaDocumentForTenant(tenant.slug, tenant.shortName);

  const selectedScopeCount = useMemo(
    () => delegates.reduce((total, delegate) => total + delegate.scopes.length, 0),
    [delegates],
  );

  useEffect(() => {
    if (error) feedbackRef.current?.focus();
  }, [error]);

  const updateDelegate = (clientKey: string, update: Partial<DelegateDraft>) => {
    setDelegates((current) => current.map((delegate) =>
      delegate.clientKey === clientKey ? { ...delegate, ...update } : delegate,
    ));
    setSuccess(null);
  };

  const addDelegate = () => {
    setDelegates((current) => [...current, emptyDelegate()]);
    window.requestAnimationFrame(() => {
      const cards = delegateListRef.current?.querySelectorAll<HTMLElement>(
        `.${styles.delegateCard}`,
      );
      cards?.item(cards.length - 1)?.querySelector<HTMLInputElement>("input")?.focus();
    });
  };

  const removeDelegate = (clientKey: string) => {
    setDelegates((current) => current.filter((item) => item.clientKey !== clientKey));
    window.requestAnimationFrame(() => addDelegateButtonRef.current?.focus());
  };

  const validateAccess = () => {
    if (!decision) return "Choose whether to grant anyone access.";
    if (decision === "no_access") return null;
    if (delegates.length === 0) return "Add at least one parent or guardian, or choose no access.";
    const normalized = normalizedDelegates(delegates);
    for (const delegate of normalized) {
      if (!delegate.fullName || !delegate.email) return "Enter a name and email for every person.";
      if (!delegate.email.includes("@")) return "Enter a valid email address for every person.";
      if (delegate.scopes.length === 0) return `Choose at least one page for ${delegate.fullName}.`;
    }
    const emails = normalized.map((delegate) => delegate.email);
    if (new Set(emails).size !== emails.length) return "Each person must use a different email address.";
    return null;
  };

  const reloadVersionWithoutLosingDraft = async () => {
    setBusy("refresh");
    setError(null);
    try {
      const latest = (await getStudentFerpaAuthorization()).authorization;
      if (!latest) throw new Error("The FERPA task is no longer assigned.");
      setCanonical(latest);
      setExpectedVersion(latest.version);
      setConflict(false);
      setSuccess("Latest record loaded. Your unsaved choices are still here for review.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The latest FERPA record could not be loaded.");
    } finally {
      setBusy(null);
    }
  };

  const handleFailure = (caught: unknown) => {
    if (caught instanceof ApiClientError && caught.status === 409) {
      setConflict(true);
      setError("Someone updated this FERPA record while you were editing. Load the latest version to safely reapply your choices.");
      return;
    }
    setError(caught instanceof Error ? caught.message : "The FERPA update could not be saved.");
  };

  const confirmSignature = () => {
    setError(null);
    if (!signerName.trim()) {
      setError("Enter your full legal name before signing.");
      return;
    }
    if (signatureMethod === "drawn" && !signatureImageData) {
      setError("Draw your signature before continuing.");
      return;
    }
    setSignatureReady(true);
    setSuccess("Signature is ready. Review the access summary, then complete FERPA.");
  };

  const save = async () => {
    setError(null);
    setSuccess(null);
    const accessError = validateAccess();
    if (accessError) {
      setError(accessError);
      return;
    }
    if (!isCompleted && canonical.document.status !== "signed") {
      if (!signatureReady) {
        setError("Sign the FERPA authorization before completing this task.");
        return;
      }
      if (!signerName.trim()) {
        setError("Enter your full legal name before completing FERPA.");
        return;
      }
      if (signatureMethod === "drawn" && !signatureImageData) {
        setError("Draw your signature before completing FERPA.");
        return;
      }
    }
    setBusy("save");
    try {
      const draftDelegates = decision === "grant" ? normalizedDelegates(delegates) : [];
      const result = isCompleted
        ? await updateStudentFerpaAccess(canonical.id, {
            expectedVersion,
            accessDecision: decision!,
            delegates: draftDelegates,
          })
        : await completeStudentFerpaAuthorization(
            requirementId || canonical.requirementId,
            {
              expectedVersion,
              signature: canonical.document.status === "signed"
                ? undefined
                : {
                    accepted: true,
                    signerName: signerName.trim(),
                    signatureMethod,
                    ...(signatureMethod === "drawn" && signatureImageData
                      ? { signatureImageData }
                      : {}),
                  } as CompleteStudentFerpaInput["signature"],
              accessDecision: decision!,
              delegates: draftDelegates,
            },
            idempotencyKeys.current.complete ||= crypto.randomUUID(),
          );
      if (!result.authorization) throw new Error("The updated FERPA record was not returned.");
      idempotencyKeys.current.complete = "";
      setCanonical(result.authorization);
      setExpectedVersion(result.authorization.version);
      setDecision(result.authorization.accessDecision);
      setDelegates(result.authorization.delegates.map(draftFromDelegate));
      setSignatureReady(result.authorization.document.status === "signed");
      setConflict(false);
      setSuccess(isCompleted ? "Access changes saved. They apply immediately." : "FERPA is complete. You can manage access here at any time.");
      onSaved?.();
    } catch (caught) {
      handleFailure(caught);
    } finally {
      setBusy(null);
    }
  };

  const manageLink = async (delegate: StudentFerpaDelegate, action: "issue" | "revoke") => {
    setBusy(`${action}:${delegate.id}`);
    setError(null);
    setSuccess(null);
    try {
      if (action === "revoke") {
        const result = await revokeStudentFerpaDelegateLink(canonical.id, delegate.id, expectedVersion);
        if (!result.authorization) throw new Error("The updated FERPA record was not returned.");
        setCanonical(result.authorization);
        setExpectedVersion(result.authorization.version);
        setDelegates(result.authorization.delegates.map(draftFromDelegate));
        setRevealedLinks((current) => {
          const next = { ...current };
          delete next[delegate.id];
          return next;
        });
        setSuccess(`Access link revoked for ${delegate.fullName}.`);
      } else {
        const key = idempotencyKeys.current[delegate.id] ||= crypto.randomUUID();
        const result = await issueStudentFerpaDelegateLink(canonical.id, delegate.id, expectedVersion, key);
        idempotencyKeys.current[delegate.id] = "";
        const rawUrl = `${window.location.origin}${tenantRuntime.href("/delegate")}#token=${encodeURIComponent(result.token)}`;
        setRevealedLinks((current) => ({ ...current, [delegate.id]: rawUrl }));
        setExpectedVersion(result.authorizationVersion);
        setCanonical((current) => ({
          ...current,
          version: result.authorizationVersion,
          delegates: current.delegates.map((currentDelegate) =>
            currentDelegate.id === delegate.id
              ? {
                  ...currentDelegate,
                  link: {
                    ...currentDelegate.link,
                    status: "active",
                    issuedAt: currentDelegate.link.issuedAt ?? result.issuedAt,
                    rotatedAt:
                      currentDelegate.link.status === "active"
                        ? result.issuedAt
                        : currentDelegate.link.rotatedAt,
                    lastUsedAt: null,
                    updatedAt: result.issuedAt,
                  },
                }
              : currentDelegate,
          ),
        }));
        setSuccess(`A new secure link is ready for ${delegate.fullName}. It will only be shown this time.`);
      }
      onSaved?.();
    } catch (caught) {
      handleFailure(caught);
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async (delegateId: string) => {
    const url = revealedLinks[delegateId];
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedDelegate(delegateId);
      window.setTimeout(() => setCopiedDelegate((current) => current === delegateId ? null : current), 2_000);
    } catch {
      setError("Copy was blocked by the browser. Select the secure link and copy it manually.");
    }
  };

  if (
    !isCompleted &&
    canonical.document.status === "unsigned" &&
    canonical.configuration.signatureProvider === "docusign"
  ) {
    return (
      <section
        className={`${styles.center} ${mode === "task" ? styles.task : styles.manage}`}
        aria-labelledby="ferpa-access-title"
      >
        <header className={styles.hero}>
          <div className={styles.heroIcon} aria-hidden="true">◆</div>
          <div>
            <p className={styles.eyebrow}>Privacy & trusted access</p>
            <h2 id="ferpa-access-title">FERPA access</h2>
            <p>This authorization is configured for an unavailable signing provider.</p>
          </div>
        </header>
        <div className={styles.feedback} data-kind="error" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>DocuSign is not available</strong>
            <p>
              This task cannot fall back to a different signing method. Ask an
              administrator to publish it with built-in e-signature, then return
              here to complete FERPA.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`${styles.center} ${mode === "task" ? styles.task : styles.manage}`} aria-labelledby="ferpa-access-title">
      <header className={styles.hero}>
        <div className={styles.heroIcon} aria-hidden="true">◆</div>
        <div>
          <p className={styles.eyebrow}>Privacy & trusted access</p>
          <h2 id="ferpa-access-title">FERPA access</h2>
          <p>
            Sign once, then decide exactly who can help—and which parts of your
            {` ${tenant.shortName} `}portal each person can use.
          </p>
        </div>
        <div className={styles.status} data-status={isCompleted ? "complete" : "incomplete"}>
          <span aria-hidden="true">{isCompleted ? "✓" : "○"}</span>
          <div><small>FERPA task</small><strong>{isCompleted ? "Complete" : "Needs action"}</strong></div>
        </div>
      </header>

      <ol className={styles.progress} aria-label="FERPA completion progress">
        <li data-complete={canonical.document.status === "signed" || signatureReady}><span>1</span><div><strong>Authorization</strong><small>Review and e-sign</small></div></li>
        <li data-complete={canonical.accessDecision !== null}><span>2</span><div><strong>Access</strong><small>Choose people and pages</small></div></li>
        <li data-complete={isCompleted}><span>3</span><div><strong>Finish</strong><small>Confirm your choices</small></div></li>
      </ol>

      <div className={styles.body}>
        <section className={styles.document} aria-labelledby="ferpa-document-title">
          <div className={styles.sectionHeading}>
            <span className={styles.stepNumber}>01</span>
            <div><p className={styles.eyebrow}>Authorization document</p><h3 id="ferpa-document-title">Review and sign your FERPA authorization</h3></div>
            <span className={styles.completionBadge} data-complete={canonical.document.status === "signed" || signatureReady}>
              {canonical.document.status === "signed" ? "Signed" : signatureReady ? "Ready" : "Required"}
            </span>
          </div>
          {canonical.document.status === "signed" ? (
            <>
              <FerpaDocumentPreview
                document={ferpaDocument}
                signerName={canonical.document.signerName}
                signatureMethod={canonical.document.signatureMethod}
              />
              <div className={styles.signedSummary}>
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>{canonical.document.title || "FERPA authorization signed"}</strong>
                  <p>
                    Signed by {canonical.document.signerName || "the student"}
                    {canonical.document.signedAt ? ` on ${new Intl.DateTimeFormat(tenant.localization.locale, { dateStyle: "medium" }).format(new Date(canonical.document.signedAt))}` : ""}.
                    Access changes do not require another signature.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.signatureWorkspace}>
              <FerpaDocumentPreview
                document={ferpaDocument}
                signerName={signerName}
                signatureMethod={signatureMethod}
                signatureImageData={signatureImageData}
              />
              <label className={styles.field}>
                <span>Full legal name</span>
                <input value={signerName} onChange={(event) => { setSignerName(event.target.value); setSignatureReady(false); }} autoComplete="name" maxLength={160} disabled={!canonical.capabilities.canSign} />
              </label>
              <fieldset className={styles.methodChoice}>
                <legend>Signature method</legend>
                <label data-selected={signatureMethod === "typed"}><input type="radio" name="ferpaSignatureMethod" value="typed" checked={signatureMethod === "typed"} onChange={() => { setSignatureMethod("typed"); setSignatureReady(false); }} /><span aria-hidden="true">Aa</span><div><strong>Type my signature</strong><small>Your legal name becomes the signature mark</small></div></label>
                <label data-selected={signatureMethod === "drawn"}><input type="radio" name="ferpaSignatureMethod" value="drawn" checked={signatureMethod === "drawn"} onChange={() => { setSignatureMethod("drawn"); setSignatureReady(false); }} /><span aria-hidden="true">✎</span><div><strong>Draw my signature</strong><small>Use a mouse, touch, or pen</small></div></label>
              </fieldset>
              {signatureMethod === "drawn" ? <SignaturePad value={signatureImageData} onChange={(value) => { setSignatureImageData(value); setSignatureReady(false); }} /> : (
                <div className={styles.typedSignature} aria-label="Typed signature preview">{signerName.trim() || "Your name appears here"}</div>
              )}
              <label className={styles.consent}><input type="checkbox" checked={signatureReady} onChange={(event) => setSignatureReady(event.target.checked)} /><span>I consent to use this electronic signature for the FERPA authorization.</span></label>
              <button className="button button--secondary" type="button" onClick={confirmSignature} disabled={!canonical.capabilities.canSign}>Sign FERPA authorization</button>
            </div>
          )}
        </section>

        <section className={styles.access} aria-labelledby="ferpa-parent-title">
          <div className={styles.sectionHeading}>
            <span className={styles.stepNumber}>02</span>
            <div><p className={styles.eyebrow}>Per-person permissions</p><h3 id="ferpa-parent-title">Parent and guardian access</h3></div>
            <span className={styles.scopeCount}>{decision === "no_access" ? "Private" : `${selectedScopeCount} page ${selectedScopeCount === 1 ? "grant" : "grants"}`}</span>
          </div>
          <p className={styles.sectionIntro}>Your record is private by default. Permissions are independent for each person and take effect as soon as you save.</p>

          <div className={styles.decisionCards} role="radiogroup" aria-label="Choose a FERPA access decision">
            <label data-selected={decision === "grant"}><input type="radio" name="ferpaDecision" value="grant" checked={decision === "grant"} onChange={() => { setDecision("grant"); setSuccess(null); }} disabled={!canManage} /><span aria-hidden="true">+</span><div><strong>Grant selected access</strong><small>I want one or more trusted people to use specific portal pages.</small></div></label>
            <label data-selected={decision === "no_access"}><input type="radio" name="ferpaDecision" value="no_access" checked={decision === "no_access"} onChange={() => { setDecision("no_access"); setSuccess(null); }} disabled={!canManage} /><span aria-hidden="true">◇</span><div><strong>Do not grant anyone access</strong><small>Keep every portal section student-only for now.</small></div></label>
          </div>

          {decision === "grant" ? (
            <div ref={delegateListRef} className={styles.delegateList}>
              {delegates.map((delegate, index) => {
                const canonicalDelegate = delegate.id ? canonical.delegates.find((item) => item.id === delegate.id) : undefined;
                return (
                  <article className={styles.delegateCard} key={delegate.clientKey}>
                    <header>
                      <div className={styles.avatar} aria-hidden="true">{delegate.fullName.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || index + 1}</div>
                      <div><small>Authorized person {index + 1}</small><h4>{delegate.fullName || "New parent or guardian"}</h4><p>{relationshipLabel(delegate.relationship)}</p></div>
                      <button type="button" onClick={() => removeDelegate(delegate.clientKey)} disabled={!canManage}>Remove person</button>
                    </header>
                    <div className={styles.identityGrid}>
                      <label className={styles.field}><span>Full name</span><input value={delegate.fullName} onChange={(event) => updateDelegate(delegate.clientKey, { fullName: event.target.value })} autoComplete="name" maxLength={160} disabled={!canManage} /></label>
                      <label className={styles.field}><span>Relationship</span><select value={delegate.relationship} onChange={(event) => updateDelegate(delegate.clientKey, { relationship: event.target.value as FerpaDelegateRelationship })} disabled={!canManage}>{relationshipOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                      <label className={styles.field}><span>Email address</span><input type="email" value={delegate.email} onChange={(event) => updateDelegate(delegate.clientKey, { email: event.target.value })} autoComplete="email" maxLength={254} disabled={!canManage} /></label>
                    </div>
                    <div className={styles.scopeHeading}><div><strong>What can this person access?</strong><small>Normal actions are available inside every selected page. FERPA controls always stay student-only.</small></div><div><button type="button" onClick={() => updateDelegate(delegate.clientKey, { scopes: scopeOptions.map((option) => option.value) })} disabled={!canManage}>Select all</button><button type="button" onClick={() => updateDelegate(delegate.clientKey, { scopes: [] })} disabled={!canManage}>Clear</button></div></div>
                    <div className={styles.scopeGrid}>
                      {scopeOptions.map((scope) => {
                        const checked = delegate.scopes.includes(scope.value);
                        return <label data-selected={checked} key={scope.value}><input type="checkbox" checked={checked} onChange={(event) => updateDelegate(delegate.clientKey, { scopes: event.target.checked ? [...delegate.scopes, scope.value] : delegate.scopes.filter((value) => value !== scope.value) })} disabled={!canManage} /><span aria-hidden="true">{scope.symbol}</span><div><strong>{scope.label}</strong><small>{scope.description}</small></div><i aria-hidden="true">{checked ? "✓" : ""}</i></label>;
                      })}
                    </div>
                    <div className={styles.accessSummary}><strong>What {delegate.fullName || "this person"} can access</strong><p>{delegate.scopes.length ? delegate.scopes.map((scope) => scopeOptions.find((option) => option.value === scope)?.label).filter(Boolean).join(" · ") : "No pages selected yet"}</p></div>
                    {isCompleted && canonicalDelegate && canonical.capabilities.canManageLinks ? (
                      <div className={styles.linkManager}>
                        <div><small>Permanent secure link</small><strong>{canonicalDelegate.link.status === "active" ? "Active" : canonicalDelegate.link.status === "revoked" ? "Revoked" : "Not created"}</strong><p>Anyone with this link can act within the selected pages. Share it privately.</p></div>
                        <div className={styles.linkActions}>
                          <button className="button button--secondary" type="button" onClick={() => void manageLink(canonicalDelegate, "issue")} disabled={busy !== null}>{canonicalDelegate.link.status === "active" ? "Rotate link" : "Create secure link"}</button>
                          {canonicalDelegate.link.status === "active" ? <button className={styles.dangerButton} type="button" onClick={() => void manageLink(canonicalDelegate, "revoke")} disabled={busy !== null}>Revoke access</button> : null}
                        </div>
                        {revealedLinks[canonicalDelegate.id] ? <div className={styles.revealedLink} role="status"><label><span>Copy now—this link is only shown once</span><input readOnly value={revealedLinks[canonicalDelegate.id]} onFocus={(event) => event.currentTarget.select()} /></label><button type="button" onClick={() => void copyLink(canonicalDelegate.id)}>{copiedDelegate === canonicalDelegate.id ? "Copied" : "Copy link"}</button></div> : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {delegates.length < 4 ? <button ref={addDelegateButtonRef} className={styles.addDelegate} type="button" onClick={addDelegate} disabled={!canManage}><span aria-hidden="true">+</span><div><strong>Add parent or guardian</strong><small>Up to four trusted people</small></div></button> : null}
            </div>
          ) : decision === "no_access" ? (
            <div className={styles.privateState}><span aria-hidden="true">◇</span><div><strong>Your portal stays private</strong><p>No parent, guardian, partner, or sponsor will receive portal access. You can change this later from Profile or My Enrollment.</p></div></div>
          ) : <div className={styles.choicePrompt}><strong>Make an explicit privacy choice</strong><p>Choose selected access or no access above. FERPA is never inferred from an empty form.</p></div>}
        </section>

        <section className={styles.review} aria-labelledby="ferpa-review-title">
          <div><p className={styles.eyebrow}>Final review</p><h3 id="ferpa-review-title">Confirm your FERPA choices</h3><p>{decision === "no_access" ? "No one else will receive portal access." : decision === "grant" ? `${delegates.length} ${delegates.length === 1 ? "person" : "people"} will receive ${selectedScopeCount} total page grants.` : "Choose an access decision to continue."}</p></div>
          <button className="button button--primary" type="button" onClick={() => void save()} disabled={busy !== null || !canManage}>{busy === "save" ? "Saving FERPA…" : isCompleted ? "Save access" : "Complete FERPA"}</button>
        </section>
        {error ? <div ref={feedbackRef} className={styles.feedback} data-kind="error" role="alert" tabIndex={-1}><span aria-hidden="true">!</span><div><strong>{conflict ? "Your record changed" : "FERPA was not saved"}</strong><p>{error}</p>{conflict ? <button type="button" onClick={() => void reloadVersionWithoutLosingDraft()} disabled={busy !== null}>Load latest without losing my edits</button> : null}</div></div> : null}
        {success ? <div className={styles.feedback} data-kind="success" role="status"><span aria-hidden="true">✓</span><p>{success}</p></div> : null}
      </div>
    </section>
  );
}

export function FerpaAccessCenter({
  mode = "manage",
  requirementId,
  onSaved,
  onCompletionChange,
  context,
}: {
  mode?: FerpaAccessCenterMode;
  requirementId?: string;
  onSaved?: () => void;
  onCompletionChange?: (complete: boolean) => void;
  context?: "onboarding";
}) {
  const load = useCallback(async (signal: AbortSignal) => {
    const bootstrap = await getStudentBootstrap(signal);
    if (bootstrap.actor?.type === "delegate") {
      return { delegate: bootstrap.actor, authorization: null };
    }
    const result = await getStudentFerpaAuthorization(signal);
    return { delegate: null, authorization: result.authorization };
  }, []);
  const resource = useApiResource(load);

  useEffect(() => {
    if (resource.status !== "ready") return;
    onCompletionChange?.(
      !resource.data.authorization ||
      resource.data.authorization.status === "completed" ||
      (context === "onboarding" && resource.data.authorization.flowKind === "enrollment"),
    );
  }, [context, onCompletionChange, resource.data, resource.status]);

  if (mode === "delegate") return <StudentManagedNotice />;
  if (resource.status === "loading") return <LoadingState label="Loading FERPA access" />;
  if (resource.status === "error") return <ErrorState message={resource.error} onRetry={resource.reload} />;
  if (resource.data.delegate) return <StudentManagedNotice studentName={resource.data.delegate.studentName} />;
  if (context === "onboarding" && resource.data.authorization?.flowKind === "enrollment") {
    return (
      <section className={styles.unassigned} aria-labelledby="ferpa-access-title">
        <span aria-hidden="true">◆</span>
        <div><p className={styles.eyebrow}>Privacy & trusted access</p><h2 id="ferpa-access-title">FERPA access</h2><p>Your FERPA authorization is assigned to My Enrollment. Continue onboarding now, then complete and manage the task from your enrollment checklist.</p></div>
      </section>
    );
  }
  if (!resource.data.authorization) {
    return (
      <section className={styles.unassigned} aria-labelledby="ferpa-access-title">
        <span aria-hidden="true">◆</span>
        <div><p className={styles.eyebrow}>Privacy & trusted access</p><h2 id="ferpa-access-title">FERPA access</h2><p>Your institution has not assigned a FERPA authorization task yet. When it is assigned, it will appear here and in My Enrollment.</p></div>
      </section>
    );
  }
  return <FerpaEditor initial={resource.data.authorization} mode={mode} requirementId={requirementId} onSaved={() => { onCompletionChange?.(true); resource.refresh(); onSaved?.(); }} />;
}

export { scopeOptions as ferpaPortalScopeOptions };
