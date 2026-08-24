"use client";

import Icon from "../design-system/Icon.jsx";
import EdwardAsk from "../design-system/patterns/EdwardAsk.jsx";
import { openEdward } from "../design-lib/door.js";

/**
 * The rail — the reference's `CampusRail` without the interests card: the
 * platform publishes no student interests, so the card that ranks by them has
 * nothing true to say. What stays is where the board comes from, with the feed's
 * own timestamp.
 */
export function CampusRail({ office, updated }: { office: string; updated: string | null }) {
  return (
    <div className="provenance-card">
      <span className="panel-label">Where this comes from</span>
      <p>
        <strong>{office}</strong> publishes every event and organization on this page. Staff
        write it in the campus life editor. The portal only shows it.
      </p>
      {updated && (
        <div className="provenance-meta">
          <span>
            <Icon name="clock" size={14} /> Updated {updated}
          </span>
        </div>
      )}
      <EdwardAsk
        label="Ask Student Life"
        mark="E"
        onClick={() =>
          openEdward({
            question: `Who publishes what’s on My Campus Life, and how do I reach ${office}?`,
            context: {
              label: "My Campus Life · Where this comes from",
              intent: "campus-publisher",
              office: "student-life",
            },
          })
        }
      />
    </div>
  );
}
