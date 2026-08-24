"use client";

import Icon from "../design-system/Icon.jsx";
import ActionBand from "../design-system/patterns/ActionBand.jsx";
import EdwardAsk from "../design-system/patterns/EdwardAsk.jsx";
import Button from "../design-system/primitives/Button.jsx";
import { openEdward } from "../design-lib/door.js";
import { type ConversationType, runningName } from "./appointments-logic";

/**
 * One topic a student can book a conversation about — the reference's `TopicRow`, on the
 * checklist's row anatomy. The backend publishes no times: the student chooses one, so every row
 * offers `Book a time`, and the facts line says so instead of quoting a count it does not have.
 */
export function AppointmentsTopicRow({
  type,
  band = null,
  mark,
  onChoose,
}: {
  type: ConversationType;
  band?: "start" | null;
  mark: string;
  onChoose: (type: ConversationType, node: HTMLElement | null) => void;
}) {
  const recommended = Boolean(band);
  const office = runningName(type.team);

  return (
    <article className={["task-card", "topic-row", recommended && "recommended"].filter(Boolean).join(" ")}>
      {band === "start" && <ActionBand icon="spark" label="Start here" />}

      <div className="task-card-body">
        <div className="task-type-icon meeting" aria-hidden="true">
          <Icon name="calendar" size={21} weight="duotone" />
        </div>

        <div className="task-main">
          <div className="task-meta-row">
            <span>{type.category}</span>
          </div>
          <h3>{type.label}</h3>
          <p>{type.blurb}</p>
          <div className="task-facts">
            <span>
              <Icon name="users" size={15} /> {type.team}
            </span>
            <span>
              <Icon name="calendar" size={15} /> You choose the time
            </span>
          </div>
        </div>

        <div className="task-action">
          <Button kind={recommended ? "primary" : "secondary"} icon="arrow" onClick={(event: React.MouseEvent<HTMLButtonElement>) => onChoose(type, event.currentTarget)}>
            Book a time
          </Button>
          <EdwardAsk
            mark={mark}
            onClick={() =>
              openEdward({
                question: `I want to talk to ${office} about ${type.label.toLowerCase()}. What should I bring to the conversation?`,
                context: { label: `Appointments · ${type.label}`, topic: type.id, intent: "advisor" },
              })
            }
          />
        </div>
      </div>
    </article>
  );
}
