import Icon from '../Icon.jsx';
import Avatar from '../primitives/Avatar.jsx';

/**
 * Everything that has happened to this record, in order.
 *
 * The work log was one of the two things the check-in of 2026-08-21 asked us to
 * define and nobody had. It is **the history of the record** — every state
 * change, who did what and when, every message sent, every note added, and
 * every draft Edward proposed — and not a productivity report about a member of
 * staff. That distinction is the whole design: a log about the case belongs to
 * the case and can be shown, in part, to the student it is about; a log about a
 * person is a different product and this one refuses to become it.
 *
 * It is also what makes an outcome mean anything. A task that says *Package
 * accepted* with nothing behind it is an assertion. With the log behind it, it
 * is a record — which is the same relationship the student's own *Where I came
 * from* has to the figures on her degree.
 *
 * ## Two weights and no more
 *
 * The failure mode of every timeline is the undifferentiated wall, and the
 * Mobbin sweep of 2026-08-24 shows the fix is not more variety but less:
 *
 *   - a **person** entry has a face and a body — something somebody wrote;
 *   - a **system** entry is a glyph, one sentence, and a time on the right.
 *
 * Nothing gets a third weight. A run of system entries folds into one line the
 * way Attio's does (*"changed Stage and 7 other attributes"*), because six
 * consecutive field changes are one event to a reader and six to a database.
 *
 * ## One section, filtered — not four sections
 *
 * Jira already uses our word, and its arrangement is the one to take: a single
 * *Activity* section with a filter row at its head — `All · Comments · History ·
 * Work log`. Four separate sections would make a reader choose where to look
 * before they know what they are looking for, and would put the same event in
 * two places the moment a comment also changed a state.
 */
export function WorkLog({ filters = [], active, onFilter, children, title = 'Activity' }) {
  return (
    <section className="worklog" aria-label={title}>
      <div className="worklog-head">
        <h3>{title}</h3>
        {filters.length ? (
          <div className="worklog-filters" role="tablist" aria-label={`${title} filter`}>
            {filters.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={f === active}
                className={f === active ? 'active' : undefined}
                onClick={() => onFilter?.(f)}
              >
                {f}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <ol className="worklog-entries">{children}</ol>
    </section>
  );
}

/**
 * One thing that happened.
 *
 * `person` makes it a person entry — pass the same shape `Avatar` takes. Without
 * one it is a system entry and wants an `icon`. `body` is what was written, and
 * it only ever belongs to a person entry: the system does not have prose.
 *
 * `visibility` is the guardrail travelling into the log. A note that was
 * internal when it was written is still internal three weeks later, and a
 * reader who cannot tell is a reader who will quote it to the student.
 */
export function LogEntry({ person, icon = 'circle', title, body, time, visibility, tone }) {
  const kind = person ? 'person' : 'system';

  return (
    <li className={['log-entry', kind, tone].filter(Boolean).join(' ')}>
      <span className="log-mark">
        {person ? <Avatar person={person} size="sm" /> : <Icon name={icon} size={14} />}
      </span>
      <div className="log-copy">
        <p className="log-title">{title}</p>
        {body ? <div className="log-body">{body}</div> : null}
        {visibility}
      </div>
      <time className="log-time">{time}</time>
    </li>
  );
}

/**
 * A run of system entries, folded.
 *
 * Six field changes in the same second are one event to a reader. The fold
 * states how many it holds and opens in place; it never hides a person's words,
 * which is why it takes a `count` and a `summary` rather than children of any
 * kind the caller chooses.
 */
export function LogFold({ summary, count, open = false, onToggle, children, time }) {
  return (
    <li className={['log-entry', 'system', 'fold', open ? 'open' : null].filter(Boolean).join(' ')}>
      <span className="log-mark">
        <Icon name="circle" size={14} />
      </span>
      <div className="log-copy">
        <button type="button" className="log-fold-toggle" onClick={onToggle} aria-expanded={open}>
          {summary}
          {typeof count === 'number' ? <span className="log-fold-count">{count}</span> : null}
          <Icon name="chevron" size={13} />
        </button>
        {open ? <ol className="log-fold-entries">{children}</ol> : null}
      </div>
      {time ? <time className="log-time">{time}</time> : null}
    </li>
  );
}

export default WorkLog;
