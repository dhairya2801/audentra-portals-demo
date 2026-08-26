"use client";
import { useEffect, useRef } from "react";

/**
 * The one piece of motion in this product that is decoration. No dependency,
 * the brand's own colours read off the cascade, and once: it fires on mount
 * and does not loop. `prefers-reduced-motion` turns it off entirely.
 *
 * The canvas is measured after the panel's entrance has run, not on mount —
 * the modal scales in, and a canvas sized during that first frame draws every
 * piece into a corner of the box it will end up with.
 */
const COUNT = 160;
const LIFE = 4200;
const SETTLE_MS = 260;

type Piece = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  wobble: number;
  wobbleSpeed: number;
  colour: string;
  round: boolean;
};

export function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const node = canvas.current;
    if (!node) return undefined;
    const context = node.getContext("2d");
    if (!context) return undefined;

    const style = getComputedStyle(document.documentElement);
    const colours = [
      "--purple-400",
      "--purple-500",
      "--purple-200",
      "--green-200",
      "--green-500",
      "--purple-100",
      "--purple-600",
    ]
      .map((token) => style.getPropertyValue(token).trim())
      .filter(Boolean);
    if (!colours.length) return undefined;

    let frame = 0;
    let stopped = false;
    let width = 0;
    let height = 0;
    let pieces: Piece[] = [];

    function size() {
      const ratio = window.devicePixelRatio || 1;
      const box = node!.getBoundingClientRect();
      width = Math.max(1, Math.round(box.width));
      height = Math.max(1, Math.round(box.height));
      node!.width = width * ratio;
      node!.height = height * ratio;
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function seed() {
      pieces = Array.from({ length: COUNT }, (_, i) => {
        const a = ((i * 2654435761) % 1000) / 1000;
        const b = ((i * 40503) % 1000) / 1000;
        const c = ((i * 7919) % 1000) / 1000;
        const w = 6 + b * 8;
        return {
          x: a * width,
          y: -20 - b * height * 0.45,
          w,
          h: w * (0.45 + c * 0.4),
          vx: (b - 0.5) * 1.2,
          vy: 1.9 + a * 1.8,
          spin: (a - 0.5) * 0.22,
          angle: a * Math.PI * 2,
          wobble: c * Math.PI * 2,
          wobbleSpeed: 0.08 + c * 0.1,
          colour: colours[i % colours.length],
          round: i % 5 === 0,
        };
      });
    }

    let last = 0;
    function draw(now: number, started: number) {
      if (stopped) return;
      const elapsed = now - started;
      // Time-based, so a throttled tab or a slow frame rate falls the same
      // distance in the same second instead of hanging at the top edge.
      const step = last ? Math.min(3, (now - last) / (1000 / 60)) : 1;
      last = now;
      if (elapsed > LIFE) {
        context!.clearRect(0, 0, width, height);
        return;
      }
      const fade = elapsed > LIFE - 800 ? (LIFE - elapsed) / 800 : 1;
      context!.clearRect(0, 0, width, height);
      context!.globalAlpha = fade;

      for (const piece of pieces) {
        piece.x += (piece.vx + Math.sin(piece.wobble) * 0.6) * step;
        piece.y += piece.vy * step;
        piece.angle += piece.spin * step;
        piece.wobble += piece.wobbleSpeed * step;
        if (piece.y > height + 20) continue;
        context!.save();
        context!.translate(piece.x, piece.y);
        context!.rotate(piece.angle);
        // The wobble reads as the piece turning over in the air.
        context!.scale(1, Math.max(0.15, Math.abs(Math.cos(piece.wobble))));
        context!.fillStyle = piece.colour;
        if (piece.round) {
          context!.beginPath();
          context!.arc(0, 0, piece.w / 2.4, 0, Math.PI * 2);
          context!.fill();
        } else {
          context!.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        }
        context!.restore();
      }

      frame = requestAnimationFrame((next) => draw(next, started));
    }

    const timer = window.setTimeout(() => {
      size();
      seed();
      frame = requestAnimationFrame((now) => draw(now, now));
    }, SETTLE_MS);

    const onResize = () => size();
    window.addEventListener("resize", onResize);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas className="confetti" ref={canvas} aria-hidden="true" />;
}
