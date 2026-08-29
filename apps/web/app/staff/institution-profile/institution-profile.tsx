"use client";

import Icon from "../../design-system/Icon.jsx";
import Avatar from "../../design-system/primitives/Avatar.jsx";
import Card, { CardHead } from "../../design-system/primitives/Card.jsx";
import StatusPill from "../../design-system/primitives/StatusPill.jsx";
import AnchorCard from "../../design-system/primitives/AnchorCard.jsx";
import Tooltip from "../../design-system/primitives/Tooltip.jsx";
import Notice from "../../design-system/patterns/Notice.jsx";
import PageHero from "../../design-system/patterns/PageHero.jsx";
import SummaryFigure from "../../design-system/patterns/SummaryFigure.jsx";
import { useTenant } from "../../components/tenant-provider";
import {
  ACADEMICS,
  AID_FACTS,
  AS_OF,
  ATTRIBUTES,
  CASELOAD_NOTE,
  COMPOSITION,
  COST_LADDER,
  COST_TOTAL,
  CYCLE_BLURB,
  DISCOUNT_NOTE,
  FUNNEL,
  LARGEST_MAJORS,
  MILESTONES,
  OFFICES,
  OFFICES_BLURB,
  OVERVIEW,
  PELL_NOTE,
  PROFILE_OWNER,
  PROJECTION_NOTE,
  SCHOOLS,
} from "./profile-data";
import "./institution-profile.css";

/**
 * Institution profile — who the institution is, before any of its work.
 *
 * ## Why this page wears the student portal's clothes
 *
 * The workspace's own page is a heading over a grid of operational cards, and it
 * is right for the work: a task board is a table, and a table wants the whitest
 * plane and the shortest radius it can get (`audentra-design-styles/tokens.css`,
 * the `.staff` layer). This page is not work. It is the one page in the staff
 * portal nobody *does* anything on — it is read, once, to learn what the
 * institution is, and then re-read to settle an argument about a number.
 *
 * That is the same job the student sections do — My Enrollment, My Financials,
 * My Health — and the design already has a shape for it: a saturated band that
 * says where you are, one figure tucked under it with the person who owns the
 * subject beside it, then cards in a column with a rail of provenance next to
 * them. So the page uses that shape, from the same components and the same
 * tokens, rather than a second dialect of it.
 *
 * What it does *not* do is escape the workspace. The staff shell keeps its
 * sidebar, its topbar and its search; this is a page inside it, centred in the
 * column the way `.content-wrap` centres a student page, and
 * `institution-profile.css` is only what it takes to hold the portal's type and
 * ink inside a shell that sets its own.
 *
 * Every figure is the demo's, from `profile-data.ts`. The tenant's *name* is the
 * platform's, because that one the platform does publish.
 */

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("en-US");

export function InstitutionProfileView({
  navigate,
}: {
  /** The workspace's own navigator — the message button opens Messages, not a student route. */
  navigate: (view: "messages") => void;
}) {
  const { tenant } = useTenant();
  const name = tenant.name || "Aster University";

  const onContact = (channel: "email" | "message") => {
    if (channel === "email") {
      window.location.href = `mailto:${PROFILE_OWNER.email}`;
      return;
    }
    navigate("messages");
  };

  const undergraduateTotal = SCHOOLS.reduce((sum, school) => sum + school.undergraduates, 0);
  const largestSchool = Math.max(...SCHOOLS.map((school) => school.undergraduates));
  const largestStage = Math.max(...FUNNEL.map((stage) => stage.students));
  const totalStaff = OFFICES.reduce((sum, office) => sum + office.staff, 0);
  const remaining = MILESTONES.filter((milestone) => !milestone.done).length;

  return (
    <div className="institution-profile">
      <div className="institution-profile__page">
        <PageHero
          kicker={`${name} · Institutional profile`}
          title="Who Aster is, in numbers."
          lede="A private nonprofit university in upstate New York — 5,420 students across four schools, and one incoming class the whole operational calendar is built around."
          motif="buildings"
        />

        <section className="page-summary" aria-label="Institution at a glance">
          <div className="summary-main">
            <SummaryFigure
              label="Total enrollment"
              figure={`${number.format(5420)} students`}
            >
              {number.format(4180)} undergraduate and {number.format(1240)} graduate, across four
              schools. Minimally selective, and tuition-dependent.
            </SummaryFigure>

            {/* The bar seats the person who owns this record, on the rule
                `AdvisorBar` states: an office is a thing, and a thing never gets
                a face. It is written out here rather than reused because the
                workspace's two channels are not the student portal's — the
                second button opens Messages in this shell. */}
            <div className="advisor-bar">
              <Avatar person={PROFILE_OWNER} size="md" className="advisor-avatar" />
              <div className="advisor-bar-copy">
                <span className="panel-label">{PROFILE_OWNER.label}</span>
                <strong>
                  {PROFILE_OWNER.name}
                  <span> · {PROFILE_OWNER.office}</span>
                </strong>
              </div>
              <div className="advisor-actions">
                <Tooltip tip="Email">
                  <button
                    className="advisor-action"
                    type="button"
                    aria-label={`Email ${PROFILE_OWNER.name}`}
                    onClick={() => onContact("email")}
                  >
                    <Icon name="mail" size={16} />
                  </button>
                </Tooltip>
                <Tooltip tip="Message">
                  <button
                    className="advisor-action"
                    type="button"
                    aria-label={`Message ${PROFILE_OWNER.name}`}
                    onClick={() => onContact("message")}
                  >
                    <Icon name="message" size={16} />
                  </button>
                </Tooltip>
              </div>
              <span className="advisor-note">
                Institutional Research publishes this profile. Every operational figure elsewhere in
                the workspace is derived from it.
              </span>
            </div>
          </div>

          <div className="summary-alert">
            <Notice tone="soon" icon="flag">
              The Fall 2027 projection assumes deposits keep arriving through August. The deposit
              rate is running 6.1 points behind last year.
            </Notice>
          </div>
        </section>

        <div className="page-body">
          <div className="page-main">
            {/* ── The institution ─────────────────────────────────────────── */}
            <Card>
              <CardHead
                icon="buildings"
                title="The institution"
                note={`Founded ${OVERVIEW.founded} in ${OVERVIEW.place}`}
              />
              <p className="profile-prose">{OVERVIEW.blurb}</p>
              <p className="profile-prose profile-prose--muted">{OVERVIEW.posture}</p>

              <dl className="fact-grid">
                {ATTRIBUTES.map((attribute) => (
                  <div className="fact" key={attribute.label}>
                    <dt>{attribute.label}</dt>
                    <dd>
                      {attribute.value}
                      {attribute.note ? <small>{attribute.note}</small> : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            {/* ── Academics ───────────────────────────────────────────────── */}
            <Card>
              <CardHead
                icon="degree"
                title="Academics"
                note={`${ACADEMICS.undergraduatePrograms} undergraduate and ${ACADEMICS.graduatePrograms} graduate programs`}
              />
              <p className="profile-prose">{ACADEMICS.blurb}</p>

              <ul className="school-list">
                {SCHOOLS.map((school) => {
                  const share = Math.round((school.undergraduates / undergraduateTotal) * 100);
                  return (
                    <li className="school" key={school.name}>
                      <div className="school__head">
                        <strong>{school.name}</strong>
                        <span className="school__count">
                          {number.format(school.undergraduates)}
                          <small>undergraduates</small>
                        </span>
                      </div>
                      <div
                        className="school__bar"
                        style={{ "--share": `${(school.undergraduates / largestSchool) * 100}%` } as React.CSSProperties}
                        aria-hidden="true"
                      >
                        <i />
                      </div>
                      <div className="school__meta">
                        <span>{share}% of undergraduates</span>
                        <span>{school.programs} programs</span>
                        <span>
                          Anchor · <b>{school.anchor}</b>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="profile-prose profile-prose--muted profile-prose--tight">
                {ACADEMICS.calendar}
              </p>
            </Card>

            {/* ── Cost and aid ────────────────────────────────────────────── */}
            <Card>
              <CardHead
                icon="wallet"
                title="Cost and aid"
                note="Published price, and what is actually paid"
              />

              <div className="ladder">
                {COST_LADDER.map((line) => (
                  <div className="ladder__line" key={line.label}>
                    <span>{line.label}</span>
                    <b>{money.format(line.amount)}</b>
                  </div>
                ))}
                <div className="ladder__line ladder__line--total">
                  <span>{COST_TOTAL.label}</span>
                  <b>{money.format(COST_TOTAL.amount)}</b>
                </div>
              </div>

              <dl className="fact-grid fact-grid--wide">
                {AID_FACTS.map((fact) => (
                  <div className="fact" key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>
                      {fact.value}
                      <small>{fact.note}</small>
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="profile-callout profile-callout--amber">
                <span className="profile-callout__mark" aria-hidden="true">
                  <Icon name="alert" size={16} />
                </span>
                <p>{DISCOUNT_NOTE}</p>
              </div>
            </Card>

            {/* ── The Fall 2027 class ─────────────────────────────────────── */}
            <Card>
              <CardHead
                icon="chart"
                title="The Fall 2027 class"
                note={`Where the funnel stands on ${AS_OF}`}
              />

              <ol className="funnel">
                {FUNNEL.map((stage) => (
                  <li className={`funnel__stage funnel__stage--${stage.tone}`} key={stage.stage}>
                    <div className="funnel__head">
                      <strong>{stage.stage}</strong>
                      <span className="funnel__value">{number.format(stage.students)}</span>
                    </div>
                    <div
                      className="funnel__bar"
                      style={{ "--share": `${(stage.students / largestStage) * 100}%` } as React.CSSProperties}
                      aria-hidden="true"
                    >
                      <i />
                    </div>
                    <div className="funnel__meta">
                      {stage.rate ? (
                        <span className="funnel__rate">
                          <b>{stage.rate}</b> {stage.baseLabel}
                        </span>
                      ) : (
                        <span className="funnel__rate funnel__rate--base">The base</span>
                      )}
                      {stage.note ? <span className="funnel__note">{stage.note}</span> : null}
                    </div>
                  </li>
                ))}
              </ol>

              <div className="profile-callout">
                <span className="profile-callout__mark" aria-hidden="true">
                  <Icon name="info" size={16} />
                </span>
                <p>{PROJECTION_NOTE}</p>
              </div>
            </Card>

            {/* ── The admission cycle ─────────────────────────────────────── */}
            <Card>
              <CardHead
                icon="calendar"
                title="The admission cycle"
                note={`Rolling admission · ${remaining} milestones still ahead`}
              />
              <p className="profile-prose">{CYCLE_BLURB}</p>

              <ol className="timeline">
                {MILESTONES.map((milestone) => (
                  <li
                    className={milestone.done ? "timeline__row is-past" : "timeline__row"}
                    key={`${milestone.label}-${milestone.date}`}
                  >
                    <span className="timeline__mark" aria-hidden="true">
                      {milestone.done ? <Icon name="check" size={11} /> : null}
                    </span>
                    <span className="timeline__label">{milestone.label}</span>
                    <span className="timeline__date">{milestone.date}</span>
                    <span className="timeline__state">
                      {milestone.done ? (
                        <StatusPill tone="done">Passed</StatusPill>
                      ) : (
                        <StatusPill tone="quiet">Ahead</StatusPill>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>

            {/* ── Offices ─────────────────────────────────────────────────── */}
            <Card>
              <CardHead
                icon="users"
                title="Offices"
                note={`${OFFICES.length} offices · ${totalStaff} people`}
              />
              <p className="profile-prose">{OFFICES_BLURB}</p>

              <ul className="office-list">
                {OFFICES.map((office) => (
                  <li className="office" key={office.name}>
                    <span className="office__staff">
                      {office.staff}
                      <small>staff</small>
                    </span>
                    <span className="office__copy">
                      <strong>{office.name}</strong>
                      <small>Owns {office.owns}.</small>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="profile-callout">
                <span className="profile-callout__mark" aria-hidden="true">
                  <Icon name="users" size={16} />
                </span>
                <p>{CASELOAD_NOTE}</p>
              </div>
            </Card>
          </div>

          {/* ── The rail: when this was true, who is in the class, where the pressure is ── */}
          <aside className="page-rail">
            <AnchorCard variant="deadline" label="Stated as of" figure={AS_OF}>
              <p>
                Sixty days before classes begin, and twenty-three days after the deposit deadline.
                Every figure on this page is that day&rsquo;s.
              </p>
            </AnchorCard>

            <div className="provenance-card">
              <span className="panel-label">Who is in the class</span>
              <ul className="share-list">
                {COMPOSITION.map((row) => (
                  <li key={row.label}>
                    <span className="share-list__label">{row.label}</span>
                    <span
                      className="share-list__bar"
                      style={{ "--share": `${row.share}%` } as React.CSSProperties}
                      aria-hidden="true"
                    >
                      <i />
                    </span>
                    <b>{row.share}%</b>
                  </li>
                ))}
              </ul>
            </div>

            <div className="provenance-card">
              <span className="panel-label">Largest majors</span>
              <div className="interest-chips">
                {LARGEST_MAJORS.map((major) => (
                  <span key={major}>{major}</span>
                ))}
              </div>
            </div>

            <div className="provenance-card">
              <span className="panel-label">Where the pressure is</span>
              <p>{PELL_NOTE}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
