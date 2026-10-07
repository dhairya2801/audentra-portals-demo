"use client";

import { useId } from "react";
import { EdwardButton } from "./cards";
import { topicById } from "./catalog";
import { Glyph } from "./glyphs";
import type { BrewDetailLevelId, BrewInsight } from "./types";
import styles from "./insight-card.module.css";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 });

export function InstitutionalInsightCard({ insight, level, onOpen, onAskEdward }: {
  insight: BrewInsight;
  level: BrewDetailLevelId;
  onOpen?: () => void;
  onAskEdward?: () => void;
}) {
  const titleId = useId();
  const topic = topicById(insight.topic);
  const forecast = insight.forecast;
  return (
    <article className={styles.card} data-insight-id={insight.id} aria-labelledby={titleId}>
      <div className={styles.tags}>
        <span className={styles.topic}><Glyph name={topic?.icon ?? "sparkle"} size={14} />{topic?.title ?? insight.label}</span>
        <span className={styles.confidence}>Confidence {insight.confidence}%</span>
      </div>
      <h3 id={titleId} className={styles.title}>
        <button type="button" onClick={onOpen}>{insight.title}</button>
      </h3>
      <p className={styles.summary}>{insight.summary}</p>
      <div className={styles.impact}>
        <p className={styles.label}>{forecast ? "Forecasted impact" : insight.impactLabel}</p>
        {forecast ? (
          <dl className={styles.metrics}>
            <div><dt>Students exposed</dt><dd>{forecast.studentsExposed}</dd></div>
            <div><dt>Estimated loss risk</dt><dd>{forecast.estimatedLoss.join("–")}</dd></div>
            <div><dt>Net tuition at risk</dt><dd>{forecast.estimatedLoss.map((count) => money.format(count * forecast.netTuitionPerStudent)).join("–")}</dd></div>
          </dl>
        ) : (
          <div className={styles.chips}>{insight.impact.map((chip) => <strong className={styles[chip.tone]} key={chip.label}>{chip.label}</strong>)}</div>
        )}
        <p className={styles.note}>{forecast?.note ?? insight.projection}</p>
      </div>
      <p className={styles.reason}><b>Why it matters:</b> {insight.whyItMatters ?? insight.context}</p>
      <div className={styles.move}>
        <p className={styles.label}>Recommended next move</p>
        <p>{insight.recommendations[level]}</p>
      </div>
      <details className={styles.evidence} open={level === "deep"}>
        <summary>Why am I seeing this? <span aria-hidden="true" /></summary>
        <p>{level === "context" ? insight.context : insight.deepDive}</p>
        {level !== "glance" ? <p>{insight.stats[level]}</p> : null}
      </details>
      {onAskEdward ? <EdwardButton label={`Ask Edward about ${insight.label}`} onClick={onAskEdward} /> : null}
      <button className={styles.details} type="button" onClick={onOpen}>View details <Glyph name="arrow" size={13} /></button>
    </article>
  );
}
