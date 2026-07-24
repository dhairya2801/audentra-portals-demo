"use client";

import type {
  ActivityEventInput,
  ActivityEventName,
} from "@vv/contracts";
import { useCallback, useEffect, useRef } from "react";
import { sendActivityEvents } from "../lib/api-client";

type ActivityProperty = string | number | boolean | null;
type ActivityProperties = Record<string, ActivityProperty>;

const propertyAllowlist: Record<ActivityEventName, readonly string[]> = {
  "ui.portal_session_started.v1": ["entry_point"],
  "ui.dashboard_viewed.v1": ["projection_version"],
  "ui.admission_offer_viewed.v1": ["offer_status"],
  "ui.admission_decision_started.v1": ["decision", "entry_point"],
  "ui.enrollment_started.v1": ["entry_point"],
  "ui.enrollment_step_viewed.v1": ["step_code", "entry_point"],
  "ui.help_opened.v1": ["context"],
};

const MAX_BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 4_000;

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function createEventId() {
  return crypto.randomUUID();
}

function getSessionId() {
  const key = "aster_portal_session_id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;

  const sessionId = createId("session");
  sessionStorage.setItem(key, sessionId);
  return sessionId;
}

function sanitizeProperties(
  eventName: ActivityEventName,
  properties: ActivityProperties,
) {
  const allowedKeys = new Set(propertyAllowlist[eventName]);

  return Object.fromEntries(
    Object.entries(properties).filter(([key]) => allowedKeys.has(key)),
  );
}

class ActivityBuffer {
  private events: ActivityEventInput[] = [];
  private sending = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  enqueue(event: ActivityEventInput) {
    this.events.push(event);

    if (this.events.length >= MAX_BATCH_SIZE) {
      void this.flush();
      return;
    }

    this.timer ??= setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  async flush(keepalive = false) {
    if (this.sending || this.events.length === 0) return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    const batch = this.events.splice(0, MAX_BATCH_SIZE);
    this.sending = true;

    try {
      await sendActivityEvents(batch, { keepalive });
    } catch {
      // Activity is deliberately best-effort and must not block portal actions.
    } finally {
      this.sending = false;
      if (this.events.length > 0 && !keepalive) {
        void this.flush();
      }
    }
  }
}

const activityBuffer = new ActivityBuffer();

export function useActivityTracking() {
  const pageInstanceId = useRef<string | null>(null);

  useEffect(() => {
    pageInstanceId.current = createId("page");

    const flushOnLeave = () => {
      void activityBuffer.flush(true);
    };

    window.addEventListener("pagehide", flushOnLeave);
    return () => window.removeEventListener("pagehide", flushOnLeave);
  }, []);

  const track = useCallback(
    (eventName: ActivityEventName, properties: ActivityProperties = {}) => {
      try {
        if (!pageInstanceId.current) return;

        activityBuffer.enqueue({
          eventId: createEventId(),
          eventName,
          occurredAt: new Date().toISOString(),
          sessionId: getSessionId(),
          pageInstanceId: pageInstanceId.current,
          properties: sanitizeProperties(eventName, properties),
        });
      } catch {
        // Storage/privacy restrictions must never interrupt a student action.
      }
    },
    [],
  );

  return { track };
}
