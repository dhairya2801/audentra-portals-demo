"use client";

import { useEffect, useRef, useState } from "react";
import { getDemoResetStatus, resetDemo } from "../lib/api-client";
import styles from "./reset-demo.module.css";

/** Only a deliberately configured disposable demo advertises this control. */
export function ResetDemo() {
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    void getDemoResetStatus(controller.signal).then(result => setEnabled(result.enabled)).catch(() => {});
    const onReset = (event: StorageEvent) => {
      if (event.key === "audentra:demo-reset") window.dispatchEvent(new Event("focus"));
    };
    window.addEventListener("storage", onReset);
    return () => { controller.abort(); window.removeEventListener("storage", onReset); };
  }, []);

  async function confirmReset() {
    setPending(true);
    setError("");
    try {
      await resetDemo();
    } catch {
      setError("The demo could not be reset. Please retry or ask the demo operator to check it.");
      setPending(false);
      return;
    }
    try {
      localStorage.setItem("audentra:demo-reset", String(Date.now()));
    } catch { /* Storage is optional; the server has already restored the demo. */ }
    dialog.current?.close();
    setPending(false);
    window.dispatchEvent(new Event("focus"));
    document.querySelector<HTMLIFrameElement>("#approved-task-board")?.contentWindow?.postMessage(
      {type: "audentra:board:invalidate"}, window.location.origin,
    );
  }

  if (!enabled) return null;
  return <div className={styles.control}>
    <button type="button" className={styles.trigger} aria-label="Reset demo" title="Reset demo" onClick={() => { setError(""); dialog.current?.showModal(); }}><span aria-hidden="true" className={styles.resetIcon}>↺</span><span className={styles.resetLabel}>Reset demo</span></button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="reset-demo-title"
      onCancel={event => { if (pending) event.preventDefault(); }}>
      <h2 id="reset-demo-title">Start a fresh demo?</h2>
      <p>This returns Ada’s configured transcript, identity/passport, immunization and financial-aid document requirements to pending and removes their review cards.</p>
      <p>Other students, unrelated tasks and next steps are preserved. Original documents and review history remain on file; you stay signed in.</p>
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="button" disabled={pending} onClick={() => dialog.current?.close()}>Cancel</button>
        <button type="button" className={styles.confirm} disabled={pending} onClick={() => void confirmReset()}>
          {pending ? "Resetting…" : "Reset demo"}
        </button>
      </div>
      {pending && <p role="status">Resetting Ada’s document requirements. Please keep this page open.</p>}
    </dialog>
  </div>;
}
