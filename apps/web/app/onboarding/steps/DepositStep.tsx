"use client";
import type { StudentOnboardingData } from "@vv/contracts";
import Card from "../../design-system/primitives/Card.jsx";
import FieldGroup from "../../design-system/patterns/FieldGroup.jsx";
import ChoiceList from "../../design-system/patterns/ChoiceList.jsx";
import Field from "../../design-system/primitives/Field.jsx";
import Notice from "../../design-system/patterns/Notice.jsx";
import Icon from "../../design-system/Icon.jsx";

type Choice = NonNullable<StudentOnboardingData["depositChoice"]>;

export const WAIVER_OFFICE = "Student Accounts";

/**
 * Step 10. The amount is stated once, in its own block, plainly. Radios, no
 * cards, so the three can be compared. The third option is the most important
 * one on this screen: whoever cannot pay is exactly who needs it plainly
 * available and free of shame.
 */
export function DepositStep({
  amount,
  deadline,
  paid,
  paidOn,
  value,
  card,
  onChange,
  onCard,
  onWaiver,
}: {
  amount: string;
  deadline: string;
  paid: boolean;
  paidOn: string | null;
  value: Choice | undefined;
  card: { number: string; expiry: string; cvc: string };
  onChange: (choice: Choice) => void;
  onCard: (patch: Partial<{ number: string; expiry: string; cvc: string }>) => void;
  onWaiver: () => void;
}) {
  const options: Array<[Choice, string, string]> = paid
    ? [["pay_now", "Paid", `Received${paidOn ? ` ${paidOn}` : ""}. Your place is confirmed.`]]
    : [
        ["pay_now", "Pay it now", "Takes a minute. Your place is confirmed straight away."],
        [
          "pay_later",
          "Accept now, pay by the deadline",
          `Your place is held until then. ${WAIVER_OFFICE} sends a reminder before it.`,
        ],
        [
          "waiver_or_deferral",
          "Ask for a waiver or a later date",
          "If paying now isn’t possible. Asking doesn’t affect your offer.",
        ],
      ];

  return (
    <Card>
      <section className="amount-block">
        <p className="amount-figure">{amount}</p>
        <p className="amount-lines">
          Credited against your first tuition bill, and refundable until {deadline}.
        </p>
      </section>

      <FieldGroup plain className="spaced" label="How will you pay the deposit?" labelId="deposit-label">
        <ChoiceList
          name="deposit"
          labelledBy="deposit-label"
          options={options}
          value={paid ? "pay_now" : value ?? null}
          onChange={(choice: Choice) => {
            if (choice === "waiver_or_deferral") return onWaiver();
            return onChange(choice);
          }}
        />

        {!paid && value === "pay_now" ? (
          <div className="card-payment">
            <Field
              label="Card number"
              inputMode="numeric"
              autoComplete="off"
              value={card.number}
              onChange={(number: string) => onCard({ number })}
            />
            <div className="field-pair">
              <Field label="Expires" autoComplete="off" value={card.expiry} onChange={(expiry: string) => onCard({ expiry })} />
              <Field label="CVC" inputMode="numeric" autoComplete="off" value={card.cvc} onChange={(cvc: string) => onCard({ cvc })} />
            </div>
            <p className="field-foot">
              <Icon name="info" size={14} /> This is a demonstration processor. Type any 16 digits;
              the number is not stored.
            </p>
          </div>
        ) : null}

        {!paid && value === "waiver_or_deferral" ? (
          <Notice tone="working" icon="clock">
            {WAIVER_OFFICE} reads your request once this step is saved. Your place is held while they
            read it.
          </Notice>
        ) : null}
      </FieldGroup>
    </Card>
  );
}
