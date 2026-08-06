"use client";

import {
  type CSSProperties,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./reward-celebration.module.css";

type Celebration = {
  id: number;
  delta: number;
};

type ConfettiStyle = CSSProperties & {
  "--left": string;
  "--delay": string;
  "--duration": string;
  "--drift": string;
  "--turn": string;
  "--confetti-color": string;
};

const colors = ["#f2b824", "#2f7d5b", "#3979ad", "#d86f5b", "#8a4770"];

const confetti = Array.from({ length: 28 }, (_, index): ConfettiStyle => ({
  "--left": `${(index * 37) % 100}%`,
  "--delay": `${(index % 8) * 55}ms`,
  "--duration": `${900 + (index % 6) * 90}ms`,
  "--drift": `${((index * 19) % 120) - 60}px`,
  "--turn": `${180 + (index % 5) * 90}deg`,
  "--confetti-color": colors[index % colors.length],
}));

export function RewardCelebration({
  tenantSlug,
  studentId,
  pointName,
  lifetimePoints,
}: {
  tenantSlug: string;
  studentId: string;
  pointName: string;
  lifetimePoints: number;
}) {
  const previousPoints = useRef<number | null>(null);
  const activeIdentityKey = useRef<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  useEffect(() => {
    const identityKey = `${tenantSlug}:${studentId}`;
    if (activeIdentityKey.current !== identityKey) {
      activeIdentityKey.current = identityKey;
      previousPoints.current = null;
      setCelebration(null);
    }
    const storageKey = `audentra:reward-balance:${identityKey}`;
    let previous = previousPoints.current;
    if (previous === null) {
      try {
        const stored = window.sessionStorage.getItem(storageKey);
        const parsed = stored === null ? Number.NaN : Number(stored);
        previous = Number.isFinite(parsed) ? parsed : lifetimePoints;
      } catch {
        previous = lifetimePoints;
      }
    }
    if (lifetimePoints > previous) {
      setCelebration({
        id: Date.now(),
        delta: lifetimePoints - previous,
      });
    }
    previousPoints.current = lifetimePoints;
    try {
      window.sessionStorage.setItem(storageKey, String(lifetimePoints));
    } catch {
      // The in-memory comparison still works when storage is unavailable.
    }
  }, [lifetimePoints, studentId, tenantSlug]);

  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), 5_500);
    return () => window.clearTimeout(timer);
  }, [celebration]);

  if (!celebration) return null;

  return (
    <aside className={styles.celebration} role="status" aria-live="polite">
      <div className={styles.confetti} aria-hidden="true">
        {confetti.map((pieceStyle, index) => (
          <i className={styles.piece} style={pieceStyle} key={index} />
        ))}
      </div>
      <div className={styles.card}>
        <span className={styles.mark} aria-hidden="true">✦</span>
        <div>
          <small>Task reward earned</small>
          <strong>
            +{celebration.delta} {pointName}
          </strong>
          <p>Your new balance is {lifetimePoints} {pointName}.</p>
        </div>
        <button
          type="button"
          aria-label="Dismiss reward celebration"
          onClick={() => setCelebration(null)}
        >
          ×
        </button>
      </div>
    </aside>
  );
}
