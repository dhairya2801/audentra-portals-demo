"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StaffBrewNewsArticle, StaffBrewNewsFeed } from "@vv/contracts";
import { getBrewNews } from "../../lib/api-client";
import { Glyph } from "./glyphs";
function Article({
  item,
  checkedAt,
}: {
  item: StaffBrewNewsArticle;
  checkedAt: string;
}) {
  const [failed, setFailed] = useState(false);
  const older =
    Date.parse(checkedAt) - Date.parse(item.publishedAt) > 7 * 86400000;
  return (
    <li className="brew-news-card">
      {item.imageUrl && !failed ? (
        <img
          className="brew-news-card__cover"
          src={item.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          width={200}
          height={200}
        />
      ) : (
        <span
          className="brew-news-card__cover brew-news-card__fallback"
          aria-label="Publisher artwork unavailable"
        >
          HED
        </span>
      )}
      <div className="brew-news-card__body">
        <span className="brew-news-card__byline">
          {item.source}
          <time dateTime={item.publishedAt}>
            {new Date(item.publishedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </time>
        </span>
        <h3>
          <a href={item.url} target="_blank" rel="noreferrer noopener">
            {item.title}
          </a>
        </h3>
        <p className="brew-news-card__bearing">{item.summary}</p>
        <small>
          {older
            ? "Older article · check publication date"
            : "Publisher report"}{" "}
          ·{" "}
          <a href={item.url} target="_blank" rel="noreferrer noopener">
            Read source ↗
          </a>
        </small>
      </div>
    </li>
  );
}
export function LiveNews() {
  const [feed, setFeed] = useState<StaffBrewNewsFeed | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const rail = useRef<HTMLOListElement>(null);
  const [paging, setPaging] = useState({ start: true, end: true, first: 1, last: 4 });
  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    const measure = () => {
      const card = node.firstElementChild as HTMLElement | null;
      const step = (card?.offsetWidth ?? 0) + parseFloat(getComputedStyle(node).columnGap || "0");
      const first = step ? Math.round(node.scrollLeft / step) + 1 : 1;
      const visible = step ? Math.max(1, Math.round((node.clientWidth + 16) / step)) : 4;
      setPaging({ start: node.scrollLeft <= 2, end: node.scrollLeft >= node.scrollWidth - node.clientWidth - 2, first, last: Math.min(first + visible - 1, feed?.articles.length ?? 0) });
    };
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    return () => { node.removeEventListener("scroll", measure); resize.disconnect(); };
  }, [feed]);
  const turn = (direction: number) => {
    const node = rail.current;
    if (!node) return;
    node.scrollBy({ left: direction * (node.clientWidth + 16), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const active = useRef(false),
    last = useRef(0);
  const refresh = useCallback(async (force = false) => {
    if (active.current) return;
    active.current = true;
    setLoading(true);
    setError("");
    try {
      setFeed(await getBrewNews(force));
      last.current = Date.now();
    } catch {
      setError(
        "News could not be refreshed. Check your connection and try again.",
      );
    } finally {
      active.current = false;
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const focus = () => {
      if (!document.hidden && Date.now() - last.current >= 900000)
        void refresh();
    };
    window.addEventListener("focus", focus);
    const timer = setInterval(focus, 60000);
    return () => {
      window.removeEventListener("focus", focus);
      clearInterval(timer);
      window.clearTimeout(initial);
    };
  }, [refresh]);
  return (
    <section
      className="brew-news brew-live-news"
      aria-labelledby="brew-news-title"
    >
      <header className="brew-section-head">
        <h2 id="brew-news-title">
          <i className="brew-section-head__mark brew-section-head__mark--navy">
            <Glyph name="broadcast" size={19} />
          </i>
          Higher Ed News<small>From the publisher</small>
        </h2>
        <div className="brew-news-actions">
        {!!feed?.articles.length && <>
          <span className="brew-news-position" aria-live="polite">{paging.first}–{paging.last} of {feed.articles.length}</span>
          <span className="brew-reel__controls">
            <button type="button" disabled={paging.start} onClick={() => turn(-1)} aria-label="Previous news" aria-controls="brew-news-rail"><Glyph name="prev" size={14} /></button>
            <button type="button" disabled={paging.end} onClick={() => turn(1)} aria-label="Next news" aria-controls="brew-news-rail"><Glyph name="next" size={14} /></button>
          </span>
        </>}
        <button
          className="brew-news-refresh"
          type="button"
          disabled={loading}
          onClick={() => void refresh(true)}
        >
          {loading ? "Refreshing…" : "Refresh news"}
        </button>
        </div>
      </header>
      <p
        className="brew-news-status"
        role={error || feed?.state === "error" ? "alert" : "status"}
      >
        {error ||
          feed?.message ||
          (feed?.state === "stale"
            ? "Saved feed is out of date. Refresh to check the publisher."
            : null) ||
          (loading && !feed
            ? "Fetching the latest publisher feed…"
            : feed?.state === "empty"
              ? "The publisher has no dated articles available."
              : feed?.fetchedAt
                ? `Feed checked ${new Date(feed.fetchedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${feed.cached ? " · cached" : ""}`
                : "")}
      </p>
      {!!feed?.articles.length && (
        <ol className="brew-news__rail" id="brew-news-rail" ref={rail} tabIndex={0} aria-label="Higher education articles">
          {feed.articles.map((item) => (
            <Article key={item.id} item={item} checkedAt={feed.checkedAt} />
          ))}
        </ol>
      )}
      <p className="brew-news__basis">
        Publisher headlines and summaries, refreshed on a 15-minute cache. Dates
        belong to each article. Institutional comparisons await editorial
        approval; this feed does not generate them.
      </p>
    </section>
  );
}
