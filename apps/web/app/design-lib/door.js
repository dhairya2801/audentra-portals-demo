/**
 * The door — Part A §12 of the review of 2026-08-21, built 2026-08-22.
 *
 * No route to a person appears before Edward. Where a screen used to offer a
 * direct line to an office, that control now opens Edward **with the question
 * written and not sent**: the student reads it, fixes it if the screen guessed
 * wrong, and sends it herself. A question sent on her behalf is a conversation
 * she did not choose to start; the point is to spare her the typing, not the
 * decision.
 *
 * It is an event rather than a prop because the door has to work from any
 * feature, and `Edward` is mounted once by the shell and owns its own state.
 * Nothing here imports a feature: the caller supplies the question, in the
 * student's voice, naming the specific item (§12.4), and a context — what the
 * composer's chip should say, which office the question is for, and the hint
 * the answer can use.
 *
 *   openEdward({
 *     question: 'Academic Advising hasn’t posted any times. How do I get in touch with them?',
 *     context: { label: 'Appointments · Academic advising', topic: 'academic', office: null, intent: 'advisor', taskId: null },
 *   });
 *
 * The hand-off is the other direction: when Edward's escalation sends her to a
 * page, what she already said travels with her (§6.4: "Whatever you already
 * told Edward goes with it, so you don't start over"). It is written once and
 * read once, by the page that consumes that kind of route.
 */

const OPEN = 'edward:open';
const HANDOFF = 'aster.edward.handoff';

export function openEdward({ question = '', context = null } = {}) {
  window.dispatchEvent(new CustomEvent(OPEN, { detail: { question, context } }));
}

export function onEdwardOpen(handler) {
  const listen = (event) => handler(event.detail ?? {});
  window.addEventListener(OPEN, listen);
  return () => window.removeEventListener(OPEN, listen);
}

/** `{ kind, route, topic, topicId, office, question, context }` — one route's luggage. */
export function stashHandoff(handoff) {
  try {
    window.sessionStorage.setItem(HANDOFF, JSON.stringify(handoff));
  } catch {
    // A page that cannot remember the hand-off still lands; she re-types.
  }
}

/**
 * A route that lands on the page she is already on changes no hash, so the page
 * does not remount to read the stash. The hand-off announces itself instead,
 * and a page that consumes a kind listens for it as well as reading on mount.
 */
const HANDOFF_EVENT = 'edward:handoff';

export function announceHandoff() {
  window.dispatchEvent(new CustomEvent(HANDOFF_EVENT));
}

export function onHandoff(handler) {
  window.addEventListener(HANDOFF_EVENT, handler);
  return () => window.removeEventListener(HANDOFF_EVENT, handler);
}

/** Read once and gone. A `kind` other than the stashed one leaves it for the page it is for. */
export function takeHandoff(kind) {
  try {
    const raw = window.sessionStorage.getItem(HANDOFF);
    if (!raw) return null;
    const handoff = JSON.parse(raw);
    if (kind && handoff.kind !== kind) return null;
    window.sessionStorage.removeItem(HANDOFF);
    return handoff;
  } catch {
    return null;
  }
}
