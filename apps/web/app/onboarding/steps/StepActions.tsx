"use client";
import Button from "../../design-system/primitives/Button.jsx";
import Icon from "../../design-system/Icon.jsx";
import type { Screen } from "../flow";

/**
 * The bar that closes every step: `Back`, then `Skip for now`, then the save.
 *
 * The skip is absent on a required step, never disabled — a greyed-out skip
 * is an offer withdrawn in front of her. On an optional step it sits at a real
 * size and a real contrast, because a step set aside is a real answer.
 */
export function StepActions({
  screen,
  first,
  saving,
  saveLabel = "Save and continue",
  onBack,
  onSkip,
  onSave,
}: {
  screen: Screen;
  first: boolean;
  saving: boolean;
  saveLabel?: string;
  onBack: () => void;
  onSkip: () => void;
  onSave: () => void;
}) {
  return (
    <div className="step-actions">
      {!first && (
        <button type="button" className="text-button step-back" onClick={onBack}>
          <Icon name="back" size={15} /> Back
        </button>
      )}

      <div className="step-forward">
        {!screen.required && (
          <button type="button" className="text-button step-skip" onClick={onSkip} disabled={saving}>
            Skip for now
          </button>
        )}
        <Button kind="primary" icon="arrow" pending={saving} onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
