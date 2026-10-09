"use client";

import { StaffAvatar } from "./staff-avatar";

import Icon from "../design-system/Icon.jsx";
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
  person,
  onChoose,
}: {
  type: ConversationType;
  band?: "start" | null;
  mark: string;
  person?: { name: string; title?: string | null; component?: string | null } | null;
  onChoose: (type: ConversationType, node: HTMLElement | null) => void;
}) {
  const recommended = Boolean(band);
  const office = runningName(type.team);

  return (
    <article className={["task-card", "topic-row", recommended && "recommended"].filter(Boolean).join(" ")}>


      <div className="task-card-body">
        <div className="task-type-icon meeting" aria-hidden="true">
          <Icon name="calendar" size={21} weight="duotone" />
        </div>

        <div className="task-main">
          <h3>{type.label}</h3>
          <p>{type.blurb}</p>
          <div className="meeting-owner"><span className="meeting-owner-avatar">{person ? <StaffAvatar person={person}/> : type.team.split(" ").map(word => word[0]).slice(0,2).join("")}</span><span><strong>{person?.name || type.team}</strong><small>{person?.title || person?.component || "Your student support team"}</small></span></div>
        </div>

        <div className="task-action">
          <Button kind={recommended ? "primary" : "secondary"} icon="arrow" onClick={(event: React.MouseEvent<HTMLButtonElement>) => onChoose(type, event.currentTarget)}>
            Find a time
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
