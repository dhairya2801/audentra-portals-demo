"use client";
import { useEffect, useRef } from "react";

/**
 * The one piece of motion in this product that is decoration. No dependency,
 * the brand's own colours read off the cascade, and once: it fires on mount
 * and does not loop. `prefers-reduced-motion` turns it off entirely.
 */
const COUNT = 130;
const LIFE = 3200;

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
      "--purple-400",
      "--green-200",
      "--purple-600",
      "--green-500",
      "--purple-100",
    ]
      .map((token) => style.getPropertyValue(token).trim())
      .filter(Boolean);
    if (!colours.length) return undefined;

    const ratio = window.devicePixelRatio || 1;
    const width = node.clientWidth;
    const height = node.clientHeight;
    node.width = width * ratio;
    node.height = height * ratio;
    context.scale(ratio, ratio);

    const pieces = Array.from({ length: COUNT }, (_, i) => {
      const spread = ((i * 2654435761) % 1000) / 1000;
      const drift = ((i * 40503) % 1000) / 1000;
      return {
        x: spread * width,
        y: -20 - drift * height * 0.6,
        size: 5 + drift * 5,
        vx: (drift - 0.5) * 1.4,
        vy: 1.6 + spread * 2.2,
        spin: (spread - 0.5) * 0.28,
        angle: spread * Math.PI * 2,
        colour: colours[i % colours.length],
      };
    });

    let frame = 0;
    const started = performance.now();

    function draw(now: number) {
      const elapsed = now - started;
      if (!context) return;
      if (elapsed > LIFE) {
        context.clearRect(0, 0, width, height);
        return;
      }
      const fade = elapsed > LIFE - 600 ? (LIFE - elapsed) / 600 : 1;
      context.clearRect(0, 0, width, height);
      context.globalAlpha = fade;

      for (const piece of pieces) {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.angle += piece.spin;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
        context.fillStyle = piece.colour;
        context.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
        context.restore();
      }

      frame = requestAnimationFrame(draw);
    }

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas className="confetti" ref={canvas} aria-hidden="true" />;
}
