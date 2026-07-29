"use client";

import type {
  StudentDocumentList,
  StudentProfile,
  UpdateStudentProfileInput,
} from "@vv/contracts";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { PortalShell } from "../components/portal-shell";
import {
  ActionFeedback,
  ErrorState,
  LoadingState,
  PageCard,
} from "../components/portal-ui";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  getStudentDocuments,
  getStudentProfile,
  signOutStudent,
  updateStudentProfile,
} from "../lib/api-client";
import { useTenant } from "../components/tenant-provider";

function ProfileForm({
  profile,
  documents,
  reload,
}: {
  profile: StudentProfile;
  documents: StudentDocumentList;
  reload: () => void;
}) {
  const tenantRuntime = useTenant();
  const { tenant } = tenantRuntime;
  const [preferredName, setPreferredName] = useState(profile.preferredName);
  const [pronouns, setPronouns] = useState(profile.pronouns || "");
  const [mobilePhone, setMobilePhone] = useState(profile.mobilePhone || "");
  const [communicationPreference, setCommunicationPreference] = useState<
    "email" | "sms"
  >(profile.communicationPreference);
  const [profileVersion, setProfileVersion] = useState(profile.version);
  const [profileUpdatedAt, setProfileUpdatedAt] = useState(profile.updatedAt);
  const updateProfileAction = useCallback(
    (input: UpdateStudentProfileInput) => updateStudentProfile(input),
    [],
  );
  const saveProfile = useApiAction(updateProfileAction);
  const signOutAction = useCallback(() => signOutStudent(), []);
  const signOut = useApiAction(signOutAction);
  const latestTranscript = documents.items
    .filter((document) => document.category === "transcript")
    .sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt),
    )[0];

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveProfile.reset();

    try {
      const saved = await saveProfile.run({
        expectedVersion: profileVersion,
        preferredName: preferredName.trim(),
        pronouns: pronouns.trim() || null,
        mobilePhone: mobilePhone.trim() || null,
        communicationPreference,
      });
      setProfileVersion(saved.version);
      setProfileUpdatedAt(saved.updatedAt);
    } catch {
      // Keep the local fields visible so the student can review or reload.
    }
  };

  return (
    <div className="resource-layout">
      <div className="resource-aside">
        <PageCard eyebrow="Student-controlled fields" title="Personal profile">
          <form className="portal-form portal-form--roomy" onSubmit={submitProfile}>
            <div className="form-grid">
              <label className="field">
                <span>First name <small>Official record</small></span>
                <input value={profile.firstName ?? ""} readOnly />
              </label>
              <label className="field">
                <span>Last name <small>Official record</small></span>
                <input value={profile.lastName ?? ""} readOnly />
              </label>
              <label className="field">
                <span>Email address <small>Account credential</small></span>
                <input
                  value={profile.email ?? ""}
                  type="email"
                  readOnly
                />
                {profile.email ? (
                  <small>
                    {profile.emailVerified
                      ? "Verified"
                      : "Verification pending—delivery will be connected later."}
                  </small>
                ) : null}
              </label>
              <label className="field">
                <span>Preferred name</span>
                <input
                  value={preferredName}
                  onChange={(event) => setPreferredName(event.target.value)}
                  autoComplete="nickname"
                  required
                  maxLength={120}
                />
              </label>
              <label className="field">
                <span>Pronouns <small>Optional</small></span>
                <input
                  value={pronouns}
                  onChange={(event) => setPronouns(event.target.value)}
                  placeholder="For example: she/her"
                  maxLength={80}
                />
              </label>
              <label className="field">
                <span>Mobile phone <small>Optional</small></span>
                <input
                  value={mobilePhone}
                  onChange={(event) => setMobilePhone(event.target.value)}
                  type="tel"
                  autoComplete="tel"
                  maxLength={30}
                />
                {profile.phoneVerified !== undefined ? (
                  <small>
                    {profile.phoneVerified
                      ? "Verified"
                      : "Verification pending—SMS delivery will be connected later."}
                  </small>
                ) : null}
              </label>
              <label className="field">
                <span>Preferred communication</span>
                <select
                  value={communicationPreference}
                  onChange={(event) =>
                    setCommunicationPreference(
                      event.target.value as "email" | "sms",
                    )
                  }
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </label>
            </div>
            <ActionFeedback
              status={saveProfile.status}
              error={saveProfile.message}
              success="Your profile changes are saved."
            />
            <div className="form-actions">
              <button
                className="button button--primary"
                type="submit"
                disabled={saveProfile.status === "loading"}
              >
                {saveProfile.status === "loading"
                  ? "Saving profile…"
                  : saveProfile.status === "error"
                    ? "Retry changes"
                    : "Save changes"}
              </button>
              {saveProfile.status === "error" ? (
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={reload}
                >
                  Reload latest profile
                </button>
              ) : null}
            </div>
          </form>
        </PageCard>
        <PageCard eyebrow="Account-scoped records" title="Academic documents">
          {latestTranscript ? (
            <dl className="stacked-details">
              <div>
                <dt>Latest transcript</dt>
                <dd>{latestTranscript.fileName}</dd>
              </div>
              <div>
                <dt>Document status</dt>
                <dd>{latestTranscript.status.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>Structured extraction</dt>
                <dd>
                  {latestTranscript.extraction?.status.replaceAll("_", " ") ??
                    "Not started"}
                </dd>
              </div>
              <div>
                <dt>Courses found</dt>
                <dd>{latestTranscript.extraction?.courses?.length ?? 0}</dd>
              </div>
            </dl>
          ) : (
            <p className="compact-empty">
              No transcript has been uploaded for this account yet. Uploading
              one from My Enrollment will make it visible here automatically.
            </p>
          )}
        </PageCard>
      </div>
      <aside className="resource-aside">
        <div className="aside-note">
          <span aria-hidden="true">i</span>
          <h2>Your official record</h2>
          <p>
            These fields are student-controlled. Changes to legal identity or
            academic records require support from the registrar.
          </p>
          <a href={`mailto:${tenant.registrarEmail}`}>Contact the registrar</a>
        </div>
        <PageCard title="Record details">
          <dl className="stacked-details">
            <div>
              <dt>Profile version</dt>
              <dd>{profileVersion}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>
                {new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(profileUpdatedAt))}
              </dd>
            </div>
          </dl>
        </PageCard>
        <section className="profile-session-card">
          <div className="profile-session-card__icon" aria-hidden="true">↪</div>
          <div className="profile-session-card__status">
            <i aria-hidden="true" /> Signed in securely
          </div>
          <p className="eyebrow">Account security</p>
          <h2>Portal session</h2>
          <p>
            You are signed in to your {tenant.shortName} student record.
            Always sign out before leaving a shared device.
          </p>
          <ActionFeedback
            status={signOut.status}
            error={signOut.message}
            success="Signed out."
          />
          <button
            className="profile-session-card__button"
            type="button"
            disabled={signOut.status === "loading"}
            onClick={() => {
              void signOut.run().then(() => {
                window.location.replace(tenantRuntime.href("/sign-in"));
              }).catch(() => {
                // Keep the session control visible so the student can retry.
              });
            }}
          >
            <span>
              <strong>
                {signOut.status === "loading"
                  ? "Signing out…"
                  : signOut.status === "error"
                    ? "Retry sign out"
                    : "Sign out of the portal"}
              </strong>
              <small>End this session on this device</small>
            </span>
            <b aria-hidden="true">→</b>
          </button>
        </section>
      </aside>
    </div>
  );
}

export default function ProfilePage() {
  const { tenant } = useTenant();
  const loadProfile = useCallback(
    (signal: AbortSignal) =>
      Promise.all([
        getStudentProfile(signal),
        getStudentDocuments(signal),
      ]).then(([profile, documents]) => ({ profile, documents })),
    [],
  );
  const profileResource = useApiResource(loadProfile);
  const refreshProfile = profileResource.refresh;
  const hasProcessingDocument =
    profileResource.data?.documents.items.some(
      (document) => document.extraction?.status === "processing",
    ) ?? false;

  useEffect(() => {
    if (!hasProcessingDocument) return;
    const interval = window.setInterval(refreshProfile, 1_500);
    return () => window.clearInterval(interval);
  }, [hasProcessingDocument, refreshProfile]);

  return (
    <PortalShell
      active="profile"
      eyebrow="Your account"
      title="Profile"
      description={`Keep the student-controlled parts of your ${tenant.shortName} profile current.`}
    >
      {profileResource.status === "loading" ? (
        <LoadingState label="Loading your profile" />
      ) : profileResource.status === "error" ? (
        <ErrorState
          message={profileResource.error}
          onRetry={profileResource.reload}
        />
      ) : (
        <ProfileForm
          profile={profileResource.data.profile}
          documents={profileResource.data.documents}
          reload={profileResource.refresh}
          key={profileResource.data.profile.version}
        />
      )}
    </PortalShell>
  );
}
