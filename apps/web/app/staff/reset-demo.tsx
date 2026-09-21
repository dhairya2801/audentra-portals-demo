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
      if (event.key === "audentra:demo-reset") window.location.assign("/staff");
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
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("audentra.demo-board.preview:")) localStorage.removeItem(key);
      }
      localStorage.setItem("audentra:demo-reset", String(Date.now()));
    } catch { /* Storage is optional; the server has already restored the demo. */ }
    window.location.assign("/staff");
  }

  if (!enabled) return null;
  return <div className={styles.control}>
    <button type="button" className={styles.trigger} onClick={() => { setError(""); dialog.current?.showModal(); }}>Reset demo</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="reset-demo-title"
      onCancel={event => { if (pending) event.preventDefault(); }}>
      <h2 id="reset-demo-title">Start a fresh demo?</h2>
      <p>This restores the saved starting state for both Ada and Camila, including steps, points,
        uploads, reviews, messages, and financial changes made during this demo.</p>
      <p>Everyone using this demo will need to sign in again. Changes since the starting state will be discarded.</p>
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="button" disabled={pending} onClick={() => dialog.current?.close()}>Cancel</button>
        <button type="button" className={styles.confirm} disabled={pending} onClick={() => void confirmReset()}>
          {pending ? "Resetting…" : "Reset demo"}
        </button>
      </div>
      {pending && <p role="status">Restoring the demo. Please keep this page open.</p>}
    </dialog>
  </div>;
}
