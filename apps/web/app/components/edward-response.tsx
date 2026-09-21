import type { EdwardSemanticBlock } from "@vv/contracts";
import { TenantLink as Link } from "./tenant-link";
import { safePortalDestination } from "../lib/safe-destination";
import styles from "./edward-response.module.css";

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "America/New_York",
      }).format(parsed);
}

function destination(href?: string) {
  if (!href) return null;
  const value = safePortalDestination(href, "/dashboard");
  return !value.external && value.href === href ? value.href : null;
}

export function EdwardResponse({ block }: { block: EdwardSemanticBlock }) {
  switch (block.type) {
    case "answer":
      return <p className={styles.answer}>{block.text}</p>;
    case "next_action":
      return (
        <section className={styles.next} aria-label="Next step">
          <span className={styles.nextMark} aria-hidden="true">
            ↗
          </span>
          <div>
            <h4>Next step</h4>
            <p>{block.text}</p>
          </div>
        </section>
      );
    case "explanation":
      return (
        <details className={styles.explanation}>
          <summary>{block.title}</summary>
          <p>{block.text}</p>
        </details>
      );
    case "facts":
      return (
        <section className={styles.record} aria-label={block.title}>
          <h4>{block.title}</h4>
          <dl className={styles.facts}>
            {block.items.map((item, i) => (
              <div key={i}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          {block.note ? <p className={styles.note}>{block.note}</p> : null}
        </section>
      );
    case "checklist":
      return (
        <section className={styles.record} aria-label={block.title}>
          <div className={styles.recordHead}>
            <h4>{block.title}</h4>
            <span>{block.total} items</span>
          </div>
          <ol className={styles.checklist}>
            {block.items.map((item, i) => {
              const href = destination(item.href);
              const done = /^(completed|accepted|waived|not applicable)$/i.test(
                item.status,
              );
              const waiting = /review|blocked|pending/i.test(item.status);
              return (
                <li key={i}>
                  <span
                    className={styles.check}
                    data-done={done}
                    aria-hidden="true"
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <div className={styles.taskBody}>
                    {href ? (
                      <Link href={href}>
                        {item.title}
                        <span aria-hidden="true"> ↗</span>
                      </Link>
                    ) : (
                      <strong>{item.title}</strong>
                    )}
                    <div className={styles.taskMeta}>
                      <span
                        className={styles.status}
                        data-tone={
                          done ? "success" : waiting ? "waiting" : "neutral"
                        }
                      >
                        {item.status}
                      </span>
                      {item.owner ? <span>{item.owner}</span> : null}
                    </div>
                    {item.detail ? <p>{item.detail}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
          {block.total > block.items.length ? (
            <p className={styles.note}>
              Showing {block.items.length} of {block.total} items.
            </p>
          ) : null}
        </section>
      );
    case "contacts":
      return (
        <section className={styles.record} aria-label={block.title}>
          <h4>{block.title}</h4>
          <ul className={styles.contacts}>
            {block.items.map((person, i) => (
              <li key={i}>
                <span className={styles.personMark} aria-hidden="true">
                  {person.name
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div>
                  <strong>{person.name}</strong>
                  <span>
                    {person.role}
                    {person.status === "On leave" ? " · On leave" : ""}
                  </span>
                  <span>{person.office}</span>
                  {/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(person.email) ? (
                    <a href={`mailto:${person.email}`}>{person.email}</a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      );
    case "timeline":
      return (
        <details className={styles.record}>
          <summary>{block.title}</summary>
          <ol className={styles.timeline}>
            {block.items.map((item, i) => (
              <li key={i}>
                <time dateTime={item.at}>{date(item.at)}</time>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </li>
            ))}
          </ol>
        </details>
      );
    case "sources":
      return (
        <details className={styles.sources}>
          <summary>
            <span aria-hidden="true">▤</span> Policy evidence{" "}
            <span>{block.items.length} sources</span>
          </summary>
          <p className={styles.note}>
            Retrieved university passages. Applicability is shown for each
            source.
          </p>
          {block.items.map((source, i) => (
            <details className={styles.source} key={i}>
              <summary>
                {source.title}
                <span>
                  Version {source.version} ·{" "}
                  {source.applicability === "applies"
                    ? "Applies to this record"
                    : "Applicability not established"}
                </span>
              </summary>
              <h5>{source.section}</h5>
              <p className={styles.excerpt}>{source.excerpt}</p>
              <small>{source.citation}</small>
            </details>
          ))}
        </details>
      );
    case "record_context":
      return (
        <p className={styles.context}>
          <span aria-hidden="true">◷</span> {block.label} · as of{" "}
          <time dateTime={block.asOf}>{date(block.asOf)}</time>
          <span>New York time</span>
        </p>
      );
  }
}
