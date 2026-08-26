"use client";
import Icon from "../../design-system/Icon.jsx";
import Modal from "../../design-system/patterns/Modal.jsx";
import Button from "../../design-system/primitives/Button.jsx";
import { PortalMark } from "../../components/portal-ui";
import { Confetti } from "./Confetti";

type ShareTarget = {
  id: "linkedin" | "xcom" | "instagram" | "facebook";
  name: string;
  icon: string;
  kind: "link" | "save";
};

/**
 * LinkedIn and X take a share-by-link on the web. Instagram and Facebook do
 * not, so those two get the image and the words, to take with her. Four
 * identical buttons would be a lie about two of them.
 */
const SHARE_TARGETS: ShareTarget[] = [
  { id: "linkedin", name: "LinkedIn", icon: "linkedin", kind: "link" },
  { id: "xcom", name: "X", icon: "xcom", kind: "link" },
  { id: "instagram", name: "Instagram", icon: "instagram", kind: "save" },
  { id: "facebook", name: "Facebook", icon: "facebook", kind: "save" },
];

function shareText(name: string, institution: string, classYear: string) {
  return `${name} is joining ${institution}, ${classYear}.`;
}

/** The composed card, drawn once more on a canvas so it can be saved. */
function saveShareImage(name: string, institution: string, classYear: string) {
  const width = 1080;
  const height = 608;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  const style = getComputedStyle(document.documentElement);
  const from = style.getPropertyValue("--purple-grad-from").trim() || "#5e47cd";
  const to = style.getPropertyValue("--purple-grad-to").trim() || "#735ee0";
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.font = "600 64px sans-serif";
  context.fillText(name, 72, 300);
  context.font = "400 36px sans-serif";
  context.globalAlpha = 0.85;
  context.fillText(classYear, 72, 360);
  context.font = "500 28px sans-serif";
  context.fillText(institution, 72, height - 72);
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${institution.replace(/\s+/g, "-").toLowerCase()}-${classYear.replace(/\s+/g, "-").toLowerCase()}.png`;
  link.click();
}

/**
 * What happens on Yes. The heading is `It's official` and not `You're in`:
 * she was already in; she held an offer. What just happened is that she
 * accepted. Closing without sharing is exactly as easy as sharing.
 */
export function CelebrationModal({
  name,
  institution,
  classYear,
  term,
  siteUrl,
  onClose,
  onContinue,
}: {
  name: string;
  institution: string;
  classYear: string;
  term: string;
  siteUrl: string;
  onClose: () => void;
  onContinue: () => void;
}) {
  const text = shareText(name, institution, classYear);

  const share = (target: ShareTarget) => {
    if (target.kind === "save") {
      saveShareImage(name, institution, classYear);
      return;
    }
    const url =
      target.id === "linkedin"
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(siteUrl)}`
        : `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(siteUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Modal
      className="modal-panel wide celebration"
      labelledBy="celebration-title"
      onClose={onClose}
      foot={
        <div className="celebration-foot">
          <Button kind="primary" icon="arrow" onClick={onContinue}>
            Continue to step 2
          </Button>
        </div>
      }
    >
      <Confetti />

      <div className="celebration-split">
        <div className="celebration-say">
          <div className="celebration-mark">
            <PortalMark />
          </div>

          <h2 id="celebration-title" className="celebration-title">
            It’s official, {name}. You’re joining {institution}.
          </h2>
          <p className="celebration-lede">
            {classYear}, starting {term}. Nine steps left, and none of them today.
          </p>

          <div className="share-block">
            <p className="share-lede">
              <Icon name="share" size={16} /> Tell people, if you want to.
            </p>

            <div className="share-targets">
              {SHARE_TARGETS.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className="share-target"
                  onClick={() => share(target)}
                >
                  <Icon name={target.icon} size={20} />
                  <span className="share-target-name">{target.name}</span>
                  <span className="share-target-kind">
                    {target.kind === "link" ? "Opens a post" : "Saves the image"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="share-card" role="img" aria-label={`${name}, ${classYear} at ${institution}`}>
          <span className="share-card-crest">
            <PortalMark />
          </span>
          <strong className="share-card-name">{name}</strong>
          <span className="share-card-line">{classYear}</span>
          <span className="share-card-foot">{institution}</span>
        </div>
      </div>
    </Modal>
  );
}
