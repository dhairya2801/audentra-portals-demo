export type BrowserVoiceErrorCategory =
  | "microphone_permission_denied"
  | "microphone_unavailable"
  | "livekit_token_failure"
  | "livekit_connection_failure"
  | "worker_not_ready"
  | "browser_autoplay_rejected"
  | "audio_track_failure"
  | "reconnect_failure"
  | "session_expired"
  | "unknown_voice_error";

export interface BrowserVoiceEventFields {
  conversationId?: string | undefined;
  voiceSessionId?: string | undefined;
  requestId?: string | undefined;
  userMessageId?: string | undefined;
  assistantMessageId?: string | undefined;
  trackId?: string | undefined;
  provider?: string | undefined;
  errorCategory?: BrowserVoiceErrorCategory | undefined;
  [key: string]: unknown;
}

type BrowserVoiceEventSink = (record: Record<string, unknown>) => void;

let sink: BrowserVoiceEventSink = (record) => console.info(JSON.stringify(record));

export function emitBrowserVoiceEvent(
  event: string,
  fields: BrowserVoiceEventFields = {},
): void {
  sink({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "vv-web",
    event,
    ...Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    ),
  });
}

export function emitBrowserVoiceMetric(
  metricName: string,
  fields: BrowserVoiceEventFields = {},
): void {
  emitBrowserVoiceEvent("voice_metric", {
    metricType: "counter",
    metricName,
    value: 1,
    ...fields,
  });
}

export function emitBrowserRecoverableError(
  errorCategory: BrowserVoiceErrorCategory,
  fields: BrowserVoiceEventFields = {},
): void {
  emitBrowserVoiceEvent("recoverable_voice_error", {
    ...fields,
    errorCategory,
  });
  emitBrowserVoiceMetric("recoverable_errors", {
    ...fields,
    errorCategory,
  });
}

export function setBrowserVoiceEventSinkForTest(
  next?: BrowserVoiceEventSink,
): void {
  sink = next ?? ((record) => console.info(JSON.stringify(record)));
}

export function nonNegativeBrowserDuration(value: number): number {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}
