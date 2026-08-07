import type { StaffOperationsWorkspace } from "@vv/contracts";
import { useMemo, useState } from "react";
import { useTenant } from "../../components/tenant-provider";
import { buildMorningBrewBriefing, MORNING_BREW_CONNECTORS, MORNING_BREW_TOPICS } from "./data";
import { EdwardPanel } from "./edward-panel";
import type { MorningBrewConnectorId, MorningBrewDestination, MorningBrewMetric, MorningBrewTopicId } from "./types";

function greetingFor(hour: number) { return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"; }
function relativeUpdate(value: string, now: Date) {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 60_000));
  if (!Number.isFinite(minutes) || minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hr${hours === 1 ? "" : "s"} ago`;
  return "Latest workspace snapshot";
}
function SourceTag({ source }: { source: "workspace" | "modeled" | "connected_demo" }) {
  return <span className={`brew-source brew-source--${source}`}>{source === "workspace" ? "Live workspace" : source === "modeled" ? "Modeled" : "Connected demo"}</span>;
}
function Sparkline({ metric }: { metric: MorningBrewMetric }) {
  const width = 160, height = 44, min = Math.min(...metric.points), max = Math.max(...metric.points), range = Math.max(max - min, 1);
  const points = metric.points.map((point, index) => `${(index / Math.max(metric.points.length - 1, 1)) * width},${height - 5 - ((point - min) / range) * (height - 10)}`).join(" ");
  return <svg className={`brew-sparkline ${metric.favorable ? "" : "brew-sparkline--watch"}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={points}/></svg>;
}

export function MorningBrewDashboard({
  workspace, topics, connectors, navigate, onCustomize, onManageConnections,
}: {
  workspace: StaffOperationsWorkspace;
  topics: MorningBrewTopicId[];
  connectors: Record<MorningBrewConnectorId, boolean>;
  navigate: (destination: MorningBrewDestination) => void;
  onCustomize: () => void;
  onManageConnections: () => void;
}) {
  const tenantRuntime = useTenant();
  const [now] = useState(() => new Date());
  const [edwardOpen, setEdwardOpen] = useState(false);
  const briefing = useMemo(() => buildMorningBrewBriefing(workspace, topics, connectors), [workspace, topics, connectors]);
  const firstName = workspace.currentStaff.name.split(" ")[0] || "there";
  const fullDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now);
  const selectedTopics = MORNING_BREW_TOPICS.filter((topic) => topics.includes(topic.id));
  const connectedCount = Object.values(connectors).filter(Boolean).length;

  return (
    <div className="brew-briefing">
      <header className="brew-hero">
        <div className="brew-a-motif" aria-hidden="true">A</div>
        <div className="brew-hero__masthead"><span className="brew-edition-label">Morning Brew · Executive briefing</span><span>{fullDate}</span></div>
        <div className="brew-hero__main">
          <div><p className="brew-greeting">{greetingFor(now.getHours())}, {firstName}.</p><h1>{briefing.headline}</h1><p>{briefing.deck}</p></div>
          <div className="brew-hero__edition"><span className="brew-hero__mark">A</span><span>{tenantRuntime.tenant.shortName} daily edition</span><strong>{briefing.readTimeMinutes} min read</strong><small>{relativeUpdate(briefing.updatedAt, now)}</small></div>
        </div>
        <div className="brew-topic-bar"><span>Your edition</span><div>{selectedTopics.map((topic) => <span key={topic.id}>{topic.title}</span>)}</div><button type="button" onClick={onCustomize}>Customize</button></div>
      </header>

      <section className="brew-command-row" aria-label="Connected daily context">
        <button className="brew-context-card" type="button" onClick={onManageConnections}><span className="brew-context-card__icon brew-context-card__icon--mail">O</span><div><small>Outlook</small><strong>{connectors.outlook ? "23 unread" : "Not connected"}</strong><p>{connectors.outlook ? "2 messages need a decision" : "Add important email highlights"}</p></div><b>→</b></button>
        <button className="brew-context-card" type="button" onClick={onManageConnections}><span className="brew-context-card__icon brew-context-card__icon--calendar">31</span><div><small>Calendar</small><strong>{connectors.calendar ? "3 meetings" : "Not connected"}</strong><p>{connectors.calendar ? "First at 8:30 AM · 2 high priority" : "Add agenda and preparation notes"}</p></div><b>→</b></button>
        <button className="brew-context-card brew-context-card--connections" type="button" onClick={onManageConnections}><span className="brew-context-card__icon">↗</span><div><small>Connected context</small><strong>{connectedCount} of {MORNING_BREW_CONNECTORS.length} sources</strong><p>Manage briefing connections</p></div><b>→</b></button>
        <button className="brew-edward-callout" type="button" onClick={() => setEdwardOpen(true)}><span className="brew-edward-callout__mark">E<i /></span><div><small>Executive copilot</small><strong>Talk with Edward</strong><p>Ask a question about today’s briefing</p></div><b>→</b></button>
      </section>

      <section className="brew-lead" aria-labelledby="brew-lead-title">
        <header className="brew-section-heading"><div><p className="eyebrow">Decision brief</p><h2 id="brew-lead-title">What you need to know</h2></div><span>{briefing.stories.length} high-signal stories · personalized for you</span></header>
        {briefing.stories.length ? <div className="brew-story-grid">{briefing.stories.map((story, index) => (
          <article className={`brew-story brew-story--${story.tone}`} key={story.id}><div className="brew-story__topline"><span>{String(index + 1).padStart(2,"0")}</span><small>{story.label}</small><SourceTag source={story.source}/></div><h3>{story.title}</h3><p>{story.summary}</p><div className="brew-story__takeaway"><span>Why it matters</span><p>{story.takeaway}</p></div>{story.destination ? <button type="button" onClick={() => navigate(story.destination!)}>Open related workspace <span>→</span></button> : null}</article>
        ))}</div> : <div className="brew-empty-state"><strong>Your edition is intentionally quiet</strong><p>Add another interest to surface more executive signals.</p><button type="button" onClick={onCustomize}>Customize Morning Brew</button></div>}
      </section>

      <section className="brew-snapshot" aria-labelledby="brew-snapshot-title"><header className="brew-section-heading brew-section-heading--compact"><div><p className="eyebrow">Enrollment & executive pulse</p><h2 id="brew-snapshot-title">The institution in one glance</h2></div><span>Workspace signals plus clearly labeled planning models</span></header><div className="brew-metric-grid">{briefing.metrics.map((metric) => <article className="brew-metric" key={metric.id}><div className="brew-metric__label"><span>{metric.label}</span><i className={`brew-delta ${metric.favorable ? "" : "brew-delta--watch"}`}>{metric.direction === "up" ? "↑" : metric.direction === "down" ? "↓" : "—"} {metric.delta}</i></div><strong>{metric.value}</strong><small>{metric.comparison}</small><Sparkline metric={metric}/><SourceTag source={metric.source}/></article>)}</div></section>

      <div className="brew-editorial-grid">
        <section className="brew-feed"><header className="brew-section-heading brew-section-heading--compact"><div><p className="eyebrow">Meaningful movement</p><h2>Since yesterday</h2></div></header><div className="brew-timeline">{briefing.changes.map((change) => <article key={change.id}><span className={`brew-timeline__dot brew-timeline__dot--${change.tone}`}/><time>{change.time}</time><div><h3>{change.title}</h3><p>{change.detail}</p><SourceTag source={change.source}/></div></article>)}</div></section>
        <section className="brew-attention"><header className="brew-section-heading brew-section-heading--compact"><div><p className="eyebrow">Priority queue</p><h2>Needs your attention</h2></div></header><div className="brew-attention-list">{briefing.attention.length ? briefing.attention.map((item) => <button type="button" onClick={() => item.destination && navigate(item.destination)} key={item.id}><span><strong>{item.count}</strong><small>{item.label}</small></span><span><p>{item.detail}</p><i>{item.urgency.replaceAll("_", " ")}</i><SourceTag source={item.source}/></span><b>→</b></button>) : <div className="brew-empty-state"><strong>No material exceptions</strong><p>Your selected areas are within expected ranges.</p></div>}</div></section>
      </div>

      {(connectors.calendar || connectors.outlook) ? <div className="brew-day-grid">
        {connectors.calendar ? <section className="brew-day-panel"><header className="brew-section-heading brew-section-heading--compact"><div><p className="eyebrow">Connected demo · Calendar</p><h2>Today’s agenda</h2></div><button type="button" onClick={onManageConnections}>Manage</button></header><div className="brew-meeting-list">{briefing.meetings.map((meeting) => <article key={meeting.id}><time>{meeting.time}<small>{meeting.duration}</small></time><span className={meeting.priority === "high" ? "is-high" : ""}/><div><strong>{meeting.title}</strong><p>{meeting.detail}</p><aside>{meeting.attendees.map((attendee) => <i key={attendee}>{attendee}</i>)}</aside></div></article>)}</div></section> : null}
        {connectors.outlook ? <section className="brew-day-panel"><header className="brew-section-heading brew-section-heading--compact"><div><p className="eyebrow">Connected demo · Outlook</p><h2>Important emails</h2></div><button type="button" onClick={() => setEdwardOpen(true)}>Ask Edward</button></header><div className="brew-email-list">{briefing.emails.map((email) => <article key={email.id}><span className={email.priority === "high" ? "is-high" : ""}/><div><small>{email.sender}</small><strong>{email.subject}</strong><p>{email.summary}</p></div><time>{email.time}</time></article>)}</div></section> : null}
      </div> : <section className="brew-connect-empty"><div><span>↗</span><div><p className="eyebrow">Make it your morning</p><h2>Add your calendar or Outlook context</h2><p>See today’s meetings, preparation notes, and important email summaries alongside institutional signals.</p></div></div><button className="button button--primary" type="button" onClick={onManageConnections}>Manage Connections</button></section>}

      {briefing.news.length ? <section className="brew-news"><header className="brew-section-heading brew-section-heading--compact"><div><p className="eyebrow">External intelligence · Synthetic demo feed</p><h2>Industry, government & policy</h2></div><span>Interpreted for institutional relevance</span></header><div className="brew-news-grid">{briefing.news.map((item) => <article key={item.id}><div><span>{item.category}</span><time>{item.published}</time></div><h3>{item.headline}</h3><p><strong>Why it matters:</strong> {item.relevance}</p><small>{item.sourceName}</small></article>)}</div></section> : null}

      <footer className="brew-colophon"><span>Audentra Morning Brew</span><p>Workspace-derived signals are labeled “Live workspace.” Planning, connector, and external-intelligence content is synthetic demonstration data.</p><div><button type="button" onClick={onCustomize}>Customize Morning Brew</button><button type="button" onClick={onManageConnections}>Manage Connections</button></div></footer>
      <EdwardPanel open={edwardOpen} briefing={briefing} onClose={() => setEdwardOpen(false)}/>
    </div>
  );
}
