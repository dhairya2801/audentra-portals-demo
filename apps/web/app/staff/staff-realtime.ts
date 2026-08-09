import { API_BASE_URL } from "../lib/api-client";
import { currentTenantSlug } from "../lib/tenant";

export interface StaffRealtimeEvent<T = unknown> {
  id: number;
  type: string;
  data: T;
}

interface StaffRealtimeOptions {
  onEvent: (event: StaffRealtimeEvent) => void;
  onConnectionChange?: (connected: boolean) => void;
}

const RETRY_MINIMUM_MS = 500;
const RETRY_MAXIMUM_MS = 10_000;

function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timeout = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

function parseEventBlock(block: string): StaffRealtimeEvent | null {
  let id: number | null = null;
  let type = "message";
  const data: string[] = [];

  for (const rawLine of block.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "id") {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed) && parsed >= 0) id = parsed;
    } else if (field === "event") {
      type = value || "message";
    } else if (field === "data") {
      data.push(value);
    }
  }

  if (id === null || data.length === 0) return null;
  const rawData = data.join("\n");
  let parsedData: unknown = rawData;
  try {
    parsedData = JSON.parse(rawData) as unknown;
  } catch {
    // A text event is still a valid invalidation signal.
  }
  return { id, type, data: parsedData };
}

/**
 * Subscribe to durable staff invalidations without depending on sticky sessions.
 *
 * Native EventSource cannot attach the tenant header used by the platform, so
 * this small fetch-based SSE client keeps the same credential and tenant
 * boundary as every other portal request.
 */
export function connectStaffRealtime({
  onEvent,
  onConnectionChange,
}: StaffRealtimeOptions) {
  const controller = new AbortController();
  let cursor: number | null = null;

  const run = async () => {
    let retryDelay = RETRY_MINIMUM_MS;
    while (!controller.signal.aborted) {
      try {
        const eventUrl =
          cursor === null
            ? `${API_BASE_URL}/v1/staff/events`
            : `${API_BASE_URL}/v1/staff/events?after=${encodeURIComponent(
                String(cursor),
              )}`;
        const response = await fetch(
          eventUrl,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "text/event-stream",
              "X-Tenant-Slug": currentTenantSlug(),
            },
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok || !response.body) {
          throw new Error(`Staff event stream returned ${response.status}`);
        }

        onConnectionChange?.(true);
        retryDelay = RETRY_MINIMUM_MS;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done }).replaceAll("\r\n", "\n");
          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const event = parseEventBlock(block);
            if (event && event.id > (cursor ?? -1)) {
              cursor = event.id;
              if (event.type !== "staff.stream.ready") onEvent(event);
            }
            boundary = buffer.indexOf("\n\n");
          }
          if (done) break;
        }
      } catch {
        if (controller.signal.aborted) break;
      } finally {
        onConnectionChange?.(false);
      }

      await wait(retryDelay, controller.signal);
      retryDelay = Math.min(RETRY_MAXIMUM_MS, retryDelay * 2);
    }
  };

  void run();
  return () => controller.abort();
}
