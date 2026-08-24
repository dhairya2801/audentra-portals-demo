"use client";

import Icon from "../design-system/Icon.jsx";
import AnchorCard from "../design-system/primitives/AnchorCard.jsx";
import type { Office } from "./profile-logic";
import { useTenant } from "./tenant-provider";

/**
 * The profile rail — the reference's `ProfileRail`: the standing on access,
 * the way out, and the offices that hold what the student cannot change.
 *
 * `grants` is `null` when the authorization could not be read, `[]` when the
 * student has given nobody access — they read differently on screen because
 * a student who cannot see their own authorizations is owed a different
 * sentence from one who has none.
 */
export interface RailGrant {
  name: string;
  endsOn: string | null;
}

export default function ProfileRail({
  grants,
  offices,
  signingOut,
  signOutError,
  onSignOut,
  onAsk,
}: {
  grants: RailGrant[] | null;
  offices: Office[];
  signingOut: boolean;
  signOutError: string | null;
  onSignOut: () => void;
  onAsk: (office: Office) => void;
}) {
  const { href } = useTenant();
  const people = grants?.length ?? 0;
  const first = grants?.[0];

  return (
    <>
      <AnchorCard variant="access" label="Who can see your record">
        <strong className="counts-figure">
          {grants === null ? "—" : people === 0 ? "Only you" : `${people} ${people === 1 ? "person" : "people"}`}
          <small>
            {grants === null
              ? "this couldn’t be checked just now"
              : people === 0
                ? "nobody else has been given access"
                : first?.endsOn
                  ? `${first.name}, until ${first.endsOn}`
                  : people === 1
                    ? first?.name
                    : `${first?.name} and ${people - 1} more`}
          </small>
        </strong>

        <div className="counts-divider" />

        <p className="access-note">
          <Icon name="lock" size={15} />
          Private by default. Nothing about you is shared unless you chose it, section by section.
        </p>
      </AnchorCard>

      <div className="session-card">
        <span className="session-icon" aria-hidden="true">
          <Icon name="signout" size={19} />
        </span>
        <span className="panel-label">Ending your session</span>
        <p>
          On a shared or library computer, closing the tab does not sign you out. Whoever opens the
          portal next would land in your record: your aid, your address, your grades.
        </p>
        {signOutError ? (
          <p className="session-meta session-error" role="alert">
            <Icon name="alert" size={13} /> {signOutError}
          </p>
        ) : null}
        <button className="secondary-button" onClick={onSignOut} disabled={signingOut}>
          <Icon name="signout" size={16} /> {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>

      <div className="offices-card">
        <span className="panel-label">Who changes the rest</span>
        {offices.map((office) => (
          <div className="office-row" key={office.id}>
            <strong>{office.name}</strong>
            <p>{office.holds}</p>
            {office.where || office.hours || office.url || office.email ? (
              <p className="office-meta">
                {office.where ? (
                  <span>
                    <Icon name="pin" size={12} /> {office.where}
                  </span>
                ) : null}
                {office.hours ? (
                  <span>
                    <Icon name="clock" size={12} /> {office.hours}
                  </span>
                ) : null}
                {office.url ? (
                  <span>
                    <Icon name="external" size={12} />{" "}
                    <a href={href(office.url)}>Contact {office.short}</a>
                  </span>
                ) : office.email ? (
                  <span>
                    <Icon name="mail" size={12} />{" "}
                    <a href={`mailto:${office.email}`}>{office.email}</a>
                  </span>
                ) : null}
              </p>
            ) : null}
            <button className="learn-link" onClick={() => onAsk(office)}>
              Ask {office.short} <Icon name="arrow" size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
