import type { AskEdwardResponse } from "@vv/contracts";

export const EDWARD_VOICE_TOPICS = {
  response: "student-assistant.voice.response.v1",
  error: "student-assistant.voice.error.v1",
  state: "student-assistant.voice.state.v1",
} as const;

export const EDWARD_STOP_SPEAKING_RPC =
  "student-assistant.stop-speaking.v1";

export type EdwardVoiceUiState =
  | "idle"
  | "requesting_microphone"
  | "connecting"
  | "listening"
  | "user_speaking"
  | "thinking"
  | "assistant_speaking"
  | "interrupted"
  | "reconnecting"
  | "recoverable_error"
  | "ended";

export type EdwardVoiceAgentState =
  | "initializing"
  | "listening"
  | "thinking"
  | "speaking"
  | "reconnecting"
  | "error";

/**
 * A canonical assistant turn as published over the voice room. The contract
 * marks the conversation ids optional on `AskEdwardResponse` because legacy
 * gateway replies omit them; a canonical voice event always carries them, and
 * `parseVoiceJsonEvent` enforces that at runtime.
 */
export type EdwardCanonicalVoiceResponse = AskEdwardResponse & {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  studentAssistant?: unknown;
};

export interface EdwardVoiceError {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface EdwardVoiceCaption {
  segmentId: string;
  text: string;
  final: boolean;
}

export interface EdwardVoiceResponseEvent {
  type: typeof EDWARD_VOICE_TOPICS.response;
  voiceSessionId: string;
  response: EdwardCanonicalVoiceResponse;
}

export interface EdwardVoiceErrorEvent {
  type: typeof EDWARD_VOICE_TOPICS.error;
  voiceSessionId: string;
  error: EdwardVoiceError;
}

export interface EdwardVoiceStateEvent {
  type: typeof EDWARD_VOICE_TOPICS.state;
  voiceSessionId: string;
  state: EdwardVoiceAgentState;
}

export const EDWARD_VOICE_STATE_LABELS: Record<EdwardVoiceUiState, string> = {
  idle: "Voice is off",
  requesting_microphone: "Requesting microphone access",
  connecting: "Connecting voice",
  listening: "Listening",
  user_speaking: "You are speaking",
  thinking: "Edward is thinking",
  assistant_speaking: "Edward is speaking",
  interrupted: "Edward's speech was stopped",
  reconnecting: "Reconnecting voice",
  recoverable_error: "Voice needs attention",
  ended: "Voice session ended",
};

const agentStates = new Set<EdwardVoiceAgentState>([
  "initializing",
  "listening",
  "thinking",
  "speaking",
  "reconnecting",
  "error",
]);

export function parseVoiceJsonEvent(
  topic: string,
  text: string,
):
  | EdwardVoiceResponseEvent
  | EdwardVoiceErrorEvent
  | EdwardVoiceStateEvent
  | null {
  if (!Object.values(EDWARD_VOICE_TOPICS).includes(topic as never)) return null;

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.type !== topic) return null;
  if (typeof value.voiceSessionId !== "string") return null;

  if (topic === EDWARD_VOICE_TOPICS.response) {
    if (!isCanonicalResponse(value.response)) return null;
    return value as unknown as EdwardVoiceResponseEvent;
  }
  if (topic === EDWARD_VOICE_TOPICS.error) {
    if (
      !isRecord(value.error) ||
      typeof value.error.code !== "string" ||
      typeof value.error.message !== "string" ||
      typeof value.error.recoverable !== "boolean"
    ) {
      return null;
    }
    return value as unknown as EdwardVoiceErrorEvent;
  }
  if (!agentStates.has(value.state as EdwardVoiceAgentState)) return null;
  return value as unknown as EdwardVoiceStateEvent;
}

function isCanonicalResponse(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.conversationId === "string" &&
    typeof value.userMessageId === "string" &&
    typeof value.assistantMessageId === "string" &&
    typeof value.message === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
