"use client";
import Card, { CardHead, CardRows } from "../../design-system/primitives/Card.jsx";
import Button from "../../design-system/primitives/Button.jsx";
import Icon from "../../design-system/Icon.jsx";
import type { Screen, ScreenId } from "../flow";

/** Where a skipped step is finished, so the offer to come back is a route and not a promise. */
const WHERE: Partial<Record<ScreenId, { label: string; route: string }>> = {
  health: { label: "Health", route: "/health" },
  photo: { label: "My Documents", route: "/documents" },
  housing: { label: "Housing", route: "/housing" },
  deposit: { label: "Payments", route: "/payments" },
};

/**
 * The end of the flow, and deliberately not a celebration over an unfinished
 * list. Two counts, not one: saved and set aside are different facts. The
 * button closes the flow on the platform and opens the portal.
 */
export function FinishCard({
  institution,
  saved,
  skippedScreens,
  pending,
  href,
  onFinish,
}: {
  institution: string;
  saved: number;
  skippedScreens: Screen[];
  pending: boolean;
  href: (route: string) => string;
  onFinish: () => void;
}) {
  const skipped = skippedScreens.length;

  return (
    <>
      <Card className="finish-card">
        <CardHead
          kind="status"
          icon="check"
          tone="done"
          title="That’s onboarding done."
          note={
            skipped
              ? `${saved} steps saved and ${skipped} set aside. Nothing is waiting on you today.`
              : `All ${saved} steps saved. Nothing is waiting on you today.`
          }
        />
        <div className="card-body">
          <p className="body-copy">
            {institution} has what it needs to open your record. From here, everything lives in the
            portal: your checklist, your documents, your money and your room, each in the section
            that owns it.
          </p>
          <Button kind="primary" icon="arrow" pending={pending} onClick={onFinish}>
            Go to My Enrollment
          </Button>
        </div>
      </Card>

      {skipped > 0 && (
        <Card>
          <CardHead
            kind="card"
            icon="half"
            title="What you set aside"
            note="Still open, still yours, and none of it is late."
          />
          <CardRows>
            {skippedScreens.map((screen) => {
              const where = WHERE[screen.id];
              return (
                <div key={screen.id} className="set-aside">
                  <span className="set-aside-copy">
                    <strong>{screen.name}</strong>
                    <small>{screen.question}</small>
                  </span>
                  {where ? (
                    <a className="text-button" href={href(where.route)}>
                      Finish it in {where.label} <Icon name="arrow" size={14} />
                    </a>
                  ) : null}
                </div>
              );
            })}
          </CardRows>
        </Card>
      )}
    </>
  );
}
