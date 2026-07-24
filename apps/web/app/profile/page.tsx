"use client";

import type {
  StudentProfile,
  UpdateStudentProfileInput,
} from "@vv/contracts";
import { type FormEvent, useCallback, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import {
  ActionFeedback,
  ErrorState,
  LoadingState,
  PageCard,
} from "../components/portal-ui";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  getStudentProfile,
  signOutDemoStudent,
  updateStudentProfile,
} from "../lib/api-client";

function ProfileForm({
  profile,
  reload,
}: {
  profile: StudentProfile;
  reload: () => void;
}) {
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
  const signOutAction = useCallback(() => signOutDemoStudent(), []);
  const signOut = useApiAction(signOutAction);

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
      <PageCard eyebrow="Student-controlled fields" title="Personal profile">
        <form className="portal-form portal-form--roomy" onSubmit={submitProfile}>
          <div className="form-grid">
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
      <aside className="resource-aside">
        <div className="aside-note">
          <span aria-hidden="true">i</span>
          <h2>Your official record</h2>
          <p>
            These fields are student-controlled. Changes to legal identity or
            academic records require support from the registrar.
          </p>
          <a href="mailto:registrar@aster.edu">Contact the registrar</a>
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
        <PageCard title="Portal session">
          <p className="form-intro">
            Sign out when you are finished, especially on a shared device.
          </p>
          <ActionFeedback
            status={signOut.status}
            error={signOut.message}
            success="Signed out."
          />
          <button
            className="button button--secondary"
            type="button"
            disabled={signOut.status === "loading"}
            onClick={() => {
              void signOut.run().then(() => {
                window.location.replace("/sign-in");
              }).catch(() => {
                // Keep the session control visible so the student can retry.
              });
            }}
          >
            {signOut.status === "loading"
              ? "Signing out…"
              : signOut.status === "error"
                ? "Retry sign out"
                : "Sign out"}
          </button>
        </PageCard>
      </aside>
    </div>
  );
}

export default function ProfilePage() {
  const loadProfile = useCallback(
    (signal: AbortSignal) => getStudentProfile(signal),
    [],
  );
  const profile = useApiResource(loadProfile);

  return (
    <PortalShell
      active="profile"
      eyebrow="Your account"
      title="Profile"
      description="Keep the student-controlled parts of your Aster profile current."
    >
      {profile.status === "loading" ? (
        <LoadingState label="Loading your profile" />
      ) : profile.status === "error" ? (
        <ErrorState message={profile.error} onRetry={profile.reload} />
      ) : (
        <ProfileForm
          profile={profile.data}
          reload={profile.refresh}
          key={profile.data.version}
        />
      )}
    </PortalShell>
  );
}
