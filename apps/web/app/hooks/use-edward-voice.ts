"use client";

import type {
  AssistantPageContext,
  AssistantVoiceSessionCredentials,
} from "@vv/contracts";
import type {
  Participant,
  RemoteTrack,
  Room,
  TranscriptionSegment,
} from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiClientError,
  createAssistantVoiceSession,
  refreshAssistantVoiceSessionToken,
} from "../lib/api-client";
import {
  EDWARD_STOP_SPEAKING_RPC,
  EDWARD_VOICE_TOPICS,
  parseVoiceJsonEvent,
  type EdwardCanonicalVoiceResponse,
  type EdwardVoiceAgentState,
  type EdwardVoiceCaption,
  type EdwardVoiceUiState,
} from "../lib/edward-voice";
import {
  emitBrowserRecoverableError,
  emitBrowserVoiceEvent,
  emitBrowserVoiceMetric,
  nonNegativeBrowserDuration,
  type BrowserVoiceErrorCategory,
} from "../lib/voice-observability";

const workerReadyTimeoutMs = 15_000;
let liveKitClientPromise: Promise<typeof import("livekit-client")> | null = null;

function loadLiveKitClient() {
  liveKitClientPromise ??= import("livekit-client");
  return liveKitClientPromise;
}

export interface EdwardVoiceProblem {
  code: string;
  message: string;
  recovery: string;
  canRetry: boolean;
  sessionExpired?: boolean;
}

interface UseEdwardVoiceOptions {
  conversationId: string | null;
  pageContext: AssistantPageContext;
  onCanonicalResponse(response: EdwardCanonicalVoiceResponse): void;
  /**
   * The platform answered 404 when asked to open a voice session — this
   * backend has no voice service. The caller can fall back to browser
   * speech, mirroring how conversation persistence degrades.
   */
  onUnavailable?(): void;
}

export interface EdwardVoiceControls {
  state: EdwardVoiceUiState;
  caption: EdwardVoiceCaption | null;
  problem: EdwardVoiceProblem | null;
  microphoneActive: boolean;
  prepareVoice(): void;
  startVoice(conversationId?: string): Promise<void>;
  stopSpeaking(): Promise<void>;
  endVoice(): Promise<void>;
  retryVoice(): Promise<void>;
  enableAudioPlayback(): Promise<void>;
}

export function useEdwardVoice({
  conversationId,
  pageContext,
  onCanonicalResponse,
  onUnavailable,
}: UseEdwardVoiceOptions): EdwardVoiceControls {
  const [state, setState] = useState<EdwardVoiceUiState>("idle");
  const [caption, setCaption] = useState<EdwardVoiceCaption | null>(null);
  const [problem, setProblem] = useState<EdwardVoiceProblem | null>(null);
  const [microphoneActive, setMicrophoneActive] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceSessionIdRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const unbindRoomRef = useRef<(() => void) | null>(null);
  const workerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userEndingRef = useRef(false);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  const agentIdentityRef = useRef<string | null>(null);
  const agentStateRef = useRef<EdwardVoiceAgentState>("initializing");
  const seenUserMessageIdsRef = useRef(new Set<string>());
  const seenAssistantMessageIdsRef = useRef(new Set<string>());
  const audioElementsRef = useRef(new Set<HTMLMediaElement>());
  const problemRef = useRef<EdwardVoiceProblem | null>(null);
  const conversationIdRef = useRef(conversationId);
  const pageContextRef = useRef(pageContext);
  const responseHandlerRef = useRef(onCanonicalResponse);
  const unavailableHandlerRef = useRef(onUnavailable);
  const reconnectStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    conversationIdRef.current = conversationId;
    pageContextRef.current = pageContext;
    responseHandlerRef.current = onCanonicalResponse;
    unavailableHandlerRef.current = onUnavailable;
  }, [conversationId, onCanonicalResponse, onUnavailable, pageContext]);

  const clearWorkerTimer = useCallback(() => {
    if (workerTimerRef.current) clearTimeout(workerTimerRef.current);
    workerTimerRef.current = null;
  }, []);

  const updateProblem = useCallback((next: EdwardVoiceProblem | null) => {
    problemRef.current = next;
    if (!mountedRef.current) return;
    setProblem(next);
    if (next) setState(next.sessionExpired ? "ended" : "recoverable_error");
  }, []);

  const cleanupRoom = useCallback(
    async (expectedRoom?: Room): Promise<void> => {
      const room = expectedRoom ?? roomRef.current;
      if (!room || (expectedRoom && roomRef.current !== expectedRoom)) return;
      clearWorkerTimer();
      unbindRoomRef.current?.();
      unbindRoomRef.current = null;
      for (const topic of Object.values(EDWARD_VOICE_TOPICS)) {
        room.unregisterTextStreamHandler(topic);
      }
      for (const element of audioElementsRef.current) {
        element.pause();
        element.remove();
      }
      audioElementsRef.current.clear();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      roomRef.current = null;
      agentIdentityRef.current = null;
      if (mountedRef.current) {
        setCaption(null);
        setMicrophoneActive(false);
      }
      await room.disconnect(true).catch(() => undefined);
    },
    [clearWorkerTimer],
  );

  const handleCanonicalResponse = useCallback(
    (response: EdwardCanonicalVoiceResponse) => {
      const activeConversationId = conversationIdRef.current;
      if (!activeConversationId || response.conversationId !== activeConversationId) {
        return;
      }
      const duplicate =
        seenUserMessageIdsRef.current.has(response.userMessageId) ||
        seenAssistantMessageIdsRef.current.has(response.assistantMessageId);
      seenUserMessageIdsRef.current.add(response.userMessageId);
      seenAssistantMessageIdsRef.current.add(response.assistantMessageId);
      if (duplicate) return;
      if (mountedRef.current) setCaption(null);
      responseHandlerRef.current(response);
    },
    [],
  );

  const setStateFromAgent = useCallback((agentState: EdwardVoiceAgentState) => {
    agentStateRef.current = agentState;
    if (!mountedRef.current || problemRef.current) return;
    const next: EdwardVoiceUiState =
      agentState === "initializing"
        ? "connecting"
        : agentState === "speaking"
          ? "assistant_speaking"
          : agentState === "error"
            ? "recoverable_error"
            : agentState;
    setState(next);
  }, []);

  const bindRoom = useCallback(
    (
      room: Room,
      generation: number,
      liveKit: typeof import("livekit-client"),
    ) => {
      const { RoomEvent, Track } = liveKit;
      const isCurrent = () =>
        mountedRef.current &&
        generationRef.current === generation &&
        roomRef.current === room;
      const markWorkerReady = () => {
        if (!isCurrent()) return;
        clearWorkerTimer();
      };
      const onText = (topic: string) =>
        room.registerTextStreamHandler(topic, (reader, participant) => {
          agentIdentityRef.current = participant.identity;
          void reader
            .readAll()
            .then((text) => {
              if (!isCurrent()) return;
              const event = parseVoiceJsonEvent(topic, text);
              if (
                !event ||
                event.voiceSessionId !== voiceSessionIdRef.current
              ) {
                return;
              }
              markWorkerReady();
              if (event.type === EDWARD_VOICE_TOPICS.response) {
                handleCanonicalResponse(event.response);
                return;
              }
              if (event.type === EDWARD_VOICE_TOPICS.error) {
                updateProblem({
                  code: event.error.code,
                  message: event.error.message,
                  recovery: event.error.recoverable
                    ? "Your text conversation is safe. Choose Try again to continue voice."
                    : "End voice and continue typing in Edward.",
                  canRetry: event.error.recoverable,
                });
                return;
              }
              setStateFromAgent(event.state);
            })
            .catch(() => {
              if (isCurrent()) {
                updateProblem({
                  code: "VOICE_EVENT_UNREADABLE",
                  message: "Edward's voice update could not be read.",
                  recovery: "Choose Reconnect voice, or continue typing.",
                  canRetry: true,
                });
              }
            });
        });

      for (const topic of Object.values(EDWARD_VOICE_TOPICS)) onText(topic);

      const onTranscription = (
        segments: TranscriptionSegment[],
        participant?: Participant,
      ) => {
        if (!isCurrent() || participant?.identity !== room.localParticipant.identity) {
          return;
        }
        const segment = segments.at(-1);
        const text = segment?.text.trim();
        if (!segment || !text) return;
        setCaption({ segmentId: segment.id, text, final: segment.final });
      };
      const onActiveSpeakers = (speakers: Participant[]) => {
        if (!isCurrent() || problemRef.current) return;
        const userIsSpeaking = speakers.some(
          (speaker) => speaker.identity === room.localParticipant.identity,
        );
        if (userIsSpeaking) {
          setState("user_speaking");
        } else if (agentStateRef.current === "listening") {
          setState("listening");
        }
      };
      const attachAudio = (track: RemoteTrack) => {
        if (!isCurrent() || track.kind !== Track.Kind.Audio) return;
        const element = track.attach();
        element.autoplay = true;
        element.dataset.edwardVoiceAudio = "true";
        element.hidden = true;
        audioElementsRef.current.add(element);
        document.body.append(element);
        const trackId = track.sid;
        emitBrowserVoiceEvent("browser_audio_subscribed", {
          conversationId: conversationIdRef.current ?? undefined,
          voiceSessionId: voiceSessionIdRef.current ?? undefined,
          trackId,
          provider: "livekit",
        });
        void element.play().then(
          () => {
            emitBrowserVoiceEvent("browser_audio_playback_started", {
              conversationId: conversationIdRef.current ?? undefined,
              voiceSessionId: voiceSessionIdRef.current ?? undefined,
              trackId,
              provider: "livekit",
            });
            emitBrowserVoiceMetric("audio_playback_successes", {
              voiceSessionId: voiceSessionIdRef.current ?? undefined,
            });
          },
          (error: unknown) => {
            if (!isCurrent()) return;
            emitBrowserRecoverableError("browser_autoplay_rejected", {
              conversationId: conversationIdRef.current ?? undefined,
              voiceSessionId: voiceSessionIdRef.current ?? undefined,
              trackId,
              provider: "livekit",
              errorCode: namedError(error),
            });
            emitBrowserVoiceMetric("audio_playback_failures", {
              voiceSessionId: voiceSessionIdRef.current ?? undefined,
              errorCategory: "browser_autoplay_rejected",
            });
            updateProblem(audioPlaybackProblem());
          },
        );
      };
      const detachAudio = (track: RemoteTrack) => {
        for (const element of track.detach()) {
          audioElementsRef.current.delete(element);
          element.remove();
        }
      };
      const onTrackSubscribed = (track: RemoteTrack) => attachAudio(track);
      const onTrackUnsubscribed = (track: RemoteTrack) => detachAudio(track);
      const onReconnecting = () => {
        if (!isCurrent()) return;
        reconnectStartedAtRef.current = performance.now();
        emitBrowserVoiceEvent("reconnect_started", {
          conversationId: conversationIdRef.current ?? undefined,
          voiceSessionId: voiceSessionIdRef.current ?? undefined,
          provider: "livekit",
          trigger: "transport",
        });
        emitBrowserVoiceMetric("reconnect_attempts", {
          voiceSessionId: voiceSessionIdRef.current ?? undefined,
        });
        if (!problemRef.current) setState("reconnecting");
      };
      const onReconnected = () => {
        if (!isCurrent()) return;
        const startedAt = reconnectStartedAtRef.current;
        reconnectStartedAtRef.current = null;
        emitBrowserVoiceEvent("reconnect_completed", {
          conversationId: conversationIdRef.current ?? undefined,
          voiceSessionId: voiceSessionIdRef.current ?? undefined,
          provider: "livekit",
          ...(startedAt === null
            ? {}
            : {
                durationMs: nonNegativeBrowserDuration(
                  performance.now() - startedAt,
                ),
              }),
        });
        emitBrowserVoiceMetric("reconnect_successes", {
          voiceSessionId: voiceSessionIdRef.current ?? undefined,
        });
        updateProblem(null);
        setStateFromAgent(agentStateRef.current);
      };
      const onDisconnected = () => {
        if (!isCurrent() || userEndingRef.current) return;
        updateProblem({
          code: "VOICE_LIVEKIT_DISCONNECTED",
          message: "The voice connection ended unexpectedly.",
          recovery: "Choose Reconnect voice. Your text conversation is still available.",
          canRetry: true,
        });
        emitBrowserRecoverableError("livekit_connection_failure", {
          conversationId: conversationIdRef.current ?? undefined,
          voiceSessionId: voiceSessionIdRef.current ?? undefined,
          provider: "livekit",
        });
        void cleanupRoom(room);
      };
      const onPlaybackChanged = (playing: boolean) => {
        if (!isCurrent() || playing) return;
        updateProblem({
          code: "VOICE_AUDIO_PLAYBACK_BLOCKED",
          message: "Your browser blocked Edward's audio playback.",
          recovery: "Choose Enable audio, then continue the voice session.",
          canRetry: true,
        });
        emitBrowserRecoverableError("browser_autoplay_rejected", {
          conversationId: conversationIdRef.current ?? undefined,
          voiceSessionId: voiceSessionIdRef.current ?? undefined,
          provider: "livekit",
        });
      };
      const onMediaDevicesError = (error: Error) => {
        if (!isCurrent()) return;
        updateProblem(microphoneProblem(error));
        emitBrowserRecoverableError(browserErrorCategory(error), {
          conversationId: conversationIdRef.current ?? undefined,
          voiceSessionId: voiceSessionIdRef.current ?? undefined,
          provider: "browser",
          errorCode: namedError(error),
        });
      };

      room
        .on(RoomEvent.TranscriptionReceived, onTranscription)
        .on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers)
        .on(RoomEvent.TrackSubscribed, onTrackSubscribed)
        .on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
        .on(RoomEvent.Reconnecting, onReconnecting)
        .on(RoomEvent.Reconnected, onReconnected)
        .on(RoomEvent.Disconnected, onDisconnected)
        .on(RoomEvent.AudioPlaybackStatusChanged, onPlaybackChanged)
        .on(RoomEvent.MediaDevicesError, onMediaDevicesError);

      unbindRoomRef.current = () => {
        room
          .off(RoomEvent.TranscriptionReceived, onTranscription)
          .off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers)
          .off(RoomEvent.TrackSubscribed, onTrackSubscribed)
          .off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
          .off(RoomEvent.Reconnecting, onReconnecting)
          .off(RoomEvent.Reconnected, onReconnected)
          .off(RoomEvent.Disconnected, onDisconnected)
          .off(RoomEvent.AudioPlaybackStatusChanged, onPlaybackChanged)
          .off(RoomEvent.MediaDevicesError, onMediaDevicesError);
      };
    },
    [
      cleanupRoom,
      clearWorkerTimer,
      handleCanonicalResponse,
      setStateFromAgent,
      updateProblem,
    ],
  );

  const connectVoice = useCallback(
    async (mode: "create" | "reconnect") => {
      const activeConversationId = conversationIdRef.current;
      if (!activeConversationId || startingRef.current) return;
      let microphonePermissionReported = false;
      startingRef.current = true;
      userEndingRef.current = false;
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      await cleanupRoom();
      updateProblem(null);
      setCaption(null);
      setState("requesting_microphone");

      if (mode === "reconnect") {
        reconnectStartedAtRef.current = performance.now();
        emitBrowserVoiceEvent("reconnect_started", {
          conversationId: activeConversationId,
          voiceSessionId: voiceSessionIdRef.current ?? undefined,
          provider: "livekit",
          trigger: "user",
        });
        emitBrowserVoiceMetric("reconnect_attempts", {
          voiceSessionId: voiceSessionIdRef.current ?? undefined,
        });
      }

      const liveKit = await loadLiveKitClient();
      if (generationRef.current !== generation) return;
      const room = new liveKit.Room();
      roomRef.current = room;
      bindRoom(room, generation, liveKit);
      // Invoke while handling the explicit microphone action so browsers can
      // unlock their audio context before the remote agent track arrives.
      void room.startAudio().catch((error: unknown) => {
        if (generationRef.current !== generation) return;
        emitBrowserRecoverableError("browser_autoplay_rejected", {
          conversationId: activeConversationId,
          voiceSessionId: voiceSessionIdRef.current ?? undefined,
          provider: "livekit",
          errorCode: namedError(error),
        });
        updateProblem(audioPlaybackProblem());
      });

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw browserMediaError();
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        emitBrowserVoiceEvent("microphone_permission_outcome", {
          conversationId: activeConversationId,
          voiceSessionId: voiceSessionIdRef.current ?? undefined,
          provider: "browser",
          outcome: "granted",
        });
        microphonePermissionReported = true;
        if (generationRef.current !== generation) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const microphone = stream.getAudioTracks()[0];
        if (!microphone) {
          stream.getTracks().forEach((track) => track.stop());
          throw noMicrophoneError();
        }
        mediaStreamRef.current = stream;
        setState("connecting");

        let credentials: AssistantVoiceSessionCredentials;
        if (mode === "reconnect" && voiceSessionIdRef.current) {
          credentials = await refreshAssistantVoiceSessionToken(
            voiceSessionIdRef.current,
          );
        } else {
          credentials = await createAssistantVoiceSession({
            conversationId: activeConversationId,
            pageContext: pageContextRef.current,
          });
          voiceSessionIdRef.current = credentials.voice_session_id;
        }
        if (generationRef.current !== generation) return;
        await room.connect(
          credentials.server_url,
          credentials.participant_token,
          { autoSubscribe: true },
        );
        emitBrowserVoiceEvent("room_connection_state", {
          conversationId: activeConversationId,
          voiceSessionId: credentials.voice_session_id,
          provider: "livekit",
          state: "connected",
        });
        if (generationRef.current !== generation) return;
        await room.localParticipant.publishTrack(microphone, {
          source: liveKit.Track.Source.Microphone,
          name: "edward-microphone",
        });
        if (generationRef.current !== generation) return;
        setMicrophoneActive(true);
        setState("listening");
        if (mode === "reconnect") {
          const startedAt = reconnectStartedAtRef.current;
          reconnectStartedAtRef.current = null;
          emitBrowserVoiceEvent("reconnect_completed", {
            conversationId: activeConversationId,
            voiceSessionId: credentials.voice_session_id,
            provider: "livekit",
            ...(startedAt === null
              ? {}
              : {
                  durationMs: nonNegativeBrowserDuration(
                    performance.now() - startedAt,
                  ),
                }),
          });
          emitBrowserVoiceMetric("reconnect_successes", {
            voiceSessionId: credentials.voice_session_id,
          });
        }
        workerTimerRef.current = setTimeout(() => {
          if (
            mountedRef.current &&
            generationRef.current === generation &&
            roomRef.current === room
          ) {
            updateProblem({
              code: "VOICE_WORKER_UNAVAILABLE",
              message: "Edward's voice worker did not become ready.",
              recovery: "Choose Reconnect voice, or continue typing.",
              canRetry: true,
            });
            emitBrowserRecoverableError("worker_not_ready", {
              conversationId: activeConversationId,
              voiceSessionId: credentials.voice_session_id,
              provider: "livekit",
            });
          }
        }, workerReadyTimeoutMs);
      } catch (error) {
        if (generationRef.current !== generation) return;
        if (
          mode === "create" &&
          error instanceof ApiClientError &&
          error.status === 404
        ) {
          // The platform has no voice service. Degrade quietly: the caller
          // decides what voice affordance remains (browser speech).
          await cleanupRoom(room);
          voiceSessionIdRef.current = null;
          if (mountedRef.current) setState("idle");
          unavailableHandlerRef.current?.();
          return;
        }
        updateProblem(connectionProblem(error));
        const category = browserErrorCategory(error);
        if (!microphonePermissionReported) {
          emitBrowserVoiceEvent("microphone_permission_outcome", {
            conversationId: activeConversationId,
            voiceSessionId: voiceSessionIdRef.current ?? undefined,
            provider: "browser",
            outcome:
              category === "microphone_permission_denied" ? "denied" : "failed",
            errorCategory: category,
          });
        }
        emitBrowserRecoverableError(
          mode === "reconnect" ? "reconnect_failure" : category,
          {
            conversationId: activeConversationId,
            voiceSessionId: voiceSessionIdRef.current ?? undefined,
            provider: "livekit",
            errorCode: namedError(error),
          },
        );
        await cleanupRoom(room);
      } finally {
        startingRef.current = false;
      }
    },
    [bindRoom, cleanupRoom, updateProblem],
  );

  const startVoice = useCallback(
    async (nextConversationId?: string) => {
      // A conversation created moments ago may not have propagated through
      // React state yet; accept it directly so voice can start immediately.
      if (nextConversationId) conversationIdRef.current = nextConversationId;
      voiceSessionIdRef.current = null;
      seenUserMessageIdsRef.current.clear();
      seenAssistantMessageIdsRef.current.clear();
      await connectVoice("create");
    },
    [connectVoice],
  );

  const stopSpeaking = useCallback(async () => {
    const requestedAt = performance.now();
    emitBrowserVoiceEvent("interruption_requested", {
      conversationId: conversationIdRef.current ?? undefined,
      voiceSessionId: voiceSessionIdRef.current ?? undefined,
      provider: "livekit",
      reason: "explicit_stop",
    });
    const room = roomRef.current;
    const destinationIdentity = agentIdentityRef.current;
    if (!room || !destinationIdentity) {
      updateProblem({
        code: "VOICE_WORKER_UNAVAILABLE",
        message: "Edward's voice worker is not ready to stop speech.",
        recovery: "Choose Reconnect voice, or end voice and continue typing.",
        canRetry: true,
      });
      return;
    }
    try {
      const payload = await room.localParticipant.performRpc({
        destinationIdentity,
        method: EDWARD_STOP_SPEAKING_RPC,
        payload: "{}",
        responseTimeout: 8_000,
      });
      const result = JSON.parse(payload) as { stopped?: unknown };
      if (result.stopped === true) {
        setState("interrupted");
      } else {
        setStateFromAgent(agentStateRef.current);
      }
      emitBrowserVoiceEvent("interruption_completed", {
        conversationId: conversationIdRef.current ?? undefined,
        voiceSessionId: voiceSessionIdRef.current ?? undefined,
        provider: "livekit",
        stopped: result.stopped === true,
        durationMs: nonNegativeBrowserDuration(performance.now() - requestedAt),
      });
      emitBrowserVoiceMetric("interruptions", {
        voiceSessionId: voiceSessionIdRef.current ?? undefined,
      });
    } catch {
      updateProblem({
        code: "VOICE_STOP_FAILED",
        message: "Edward's speech could not be stopped through the voice service.",
        recovery: "End voice to stop all session audio, or continue typing.",
        canRetry: true,
      });
      emitBrowserRecoverableError("unknown_voice_error", {
        conversationId: conversationIdRef.current ?? undefined,
        voiceSessionId: voiceSessionIdRef.current ?? undefined,
        provider: "livekit",
      });
    }
  }, [setStateFromAgent, updateProblem]);

  const endVoice = useCallback(async () => {
    userEndingRef.current = true;
    generationRef.current += 1;
    await cleanupRoom();
    emitBrowserVoiceEvent("voice_session_ended", {
      conversationId: conversationIdRef.current ?? undefined,
      voiceSessionId: voiceSessionIdRef.current ?? undefined,
      provider: "livekit",
      endState: "explicit",
    });
    voiceSessionIdRef.current = null;
    updateProblem(null);
    if (mountedRef.current) setState("ended");
  }, [cleanupRoom, updateProblem]);

  const retryVoice = useCallback(async () => {
    const currentProblem = problemRef.current;
    const room = roomRef.current;
    if (
      String(room?.state) === "connected" &&
      currentProblem &&
      ![
        "VOICE_WORKER_UNAVAILABLE",
        "VOICE_LIVEKIT_DISCONNECTED",
        "VOICE_EVENT_UNREADABLE",
      ].includes(currentProblem.code)
    ) {
      updateProblem(null);
      if (agentStateRef.current === "error") {
        agentStateRef.current = "listening";
        setState("listening");
      } else {
        setStateFromAgent(agentStateRef.current);
      }
      return;
    }
    if (currentProblem?.sessionExpired || !voiceSessionIdRef.current) {
      await startVoice();
      return;
    }
    await connectVoice("reconnect");
  }, [connectVoice, setStateFromAgent, startVoice, updateProblem]);

  const enableAudioPlayback = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      await Promise.all(
        [...audioElementsRef.current].map((element) => element.play()),
      );
      updateProblem(null);
      setStateFromAgent(agentStateRef.current);
    } catch {
      updateProblem(audioPlaybackProblem(true));
    }
  }, [setStateFromAgent, updateProblem]);

  const prepareVoice = useCallback(() => {
    void loadLiveKitClient();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      userEndingRef.current = true;
      generationRef.current += 1;
      void cleanupRoom();
    };
  }, [cleanupRoom]);

  return {
    state,
    caption,
    problem,
    microphoneActive,
    prepareVoice,
    startVoice,
    stopSpeaking,
    endVoice,
    retryVoice,
    enableAudioPlayback,
  };
}

function browserErrorCategory(error: unknown): BrowserVoiceErrorCategory {
  if (error instanceof ApiClientError) {
    if (
      error.code === "ASSISTANT_VOICE_SESSION_EXPIRED" ||
      error.code === "ASSISTANT_VOICE_SESSION_ENDED"
    ) {
      return "session_expired";
    }
    return "livekit_token_failure";
  }
  if (isNamedError(error, "NotAllowedError", "PermissionDeniedError")) {
    return "microphone_permission_denied";
  }
  if (
    isNamedError(
      error,
      "NotFoundError",
      "DevicesNotFoundError",
      "NotReadableError",
      "TrackStartError",
    ) ||
    error instanceof BrowserMediaError
  ) {
    return "microphone_unavailable";
  }
  return "livekit_connection_failure";
}

function microphoneProblem(error: unknown): EdwardVoiceProblem {
  if (isNamedError(error, "NotAllowedError", "PermissionDeniedError")) {
    return {
      code: "VOICE_MICROPHONE_PERMISSION_DENIED",
      message: "Microphone access was denied.",
      recovery:
        "Allow microphone access in your browser's site settings, then choose Try again. You can keep typing meanwhile.",
      canRetry: true,
    };
  }
  if (isNamedError(error, "NotFoundError", "DevicesNotFoundError")) {
    return {
      code: "VOICE_MICROPHONE_NOT_FOUND",
      message: "No microphone device was found.",
      recovery: "Connect or enable a microphone, then choose Try again.",
      canRetry: true,
    };
  }
  if (isNamedError(error, "NotReadableError", "TrackStartError")) {
    return {
      code: "VOICE_MICROPHONE_UNAVAILABLE",
      message: "The microphone is unavailable or already in use.",
      recovery: "Close other apps using the microphone, then choose Try again.",
      canRetry: true,
    };
  }
  return {
    code: "VOICE_BROWSER_MEDIA_FAILURE",
    message: "The browser could not start the microphone.",
    recovery: "Check the microphone and browser permissions, then choose Try again.",
    canRetry: true,
  };
}

function connectionProblem(error: unknown): EdwardVoiceProblem {
  if (error instanceof ApiClientError) {
    if (
      error.code === "ASSISTANT_VOICE_SESSION_EXPIRED" ||
      error.code === "ASSISTANT_VOICE_SESSION_ENDED"
    ) {
      return {
        code: error.code,
        message: "This voice session has ended or expired.",
        recovery: "Begin another voice session in this same Edward conversation.",
        canRetry: true,
        sessionExpired: true,
      };
    }
    return {
      code: error.code || "VOICE_SESSION_TOKEN_FAILED",
      message: error.message || "Edward could not start a voice session.",
      recovery: "Choose Try again, or continue typing in Edward.",
      canRetry: true,
    };
  }
  if (isNamedError(error, "NotAllowedError", "PermissionDeniedError")) {
    return microphoneProblem(error);
  }
  if (isNamedError(error, "NotFoundError", "DevicesNotFoundError")) {
    return microphoneProblem(error);
  }
  if (isNamedError(error, "NotReadableError", "TrackStartError")) {
    return microphoneProblem(error);
  }
  if (error instanceof BrowserMediaError) return error.problem;
  return {
    code: "VOICE_LIVEKIT_CONNECTION_FAILED",
    message: "Edward could not connect to the voice room.",
    recovery: "Check your connection and choose Reconnect voice, or continue typing.",
    canRetry: true,
  };
}

class BrowserMediaError extends Error {
  constructor(readonly problem: EdwardVoiceProblem) {
    super(problem.message);
  }
}

function browserMediaError(): BrowserMediaError {
  return new BrowserMediaError({
    code: "VOICE_BROWSER_MEDIA_UNSUPPORTED",
    message: "This browser cannot access a microphone.",
    recovery: "Use a browser with microphone support, or continue typing in Edward.",
    canRetry: false,
  });
}

function noMicrophoneError(): BrowserMediaError {
  return new BrowserMediaError({
    code: "VOICE_MICROPHONE_NOT_FOUND",
    message: "No microphone device was found.",
    recovery: "Connect or enable a microphone, then choose Try again.",
    canRetry: true,
  });
}

function isNamedError(error: unknown, ...names: string[]): boolean {
  if (!error || typeof error !== "object" || !("name" in error)) return false;
  return names.includes(String(error.name));
}

function namedError(error: unknown): string {
  return error && typeof error === "object" && "name" in error
    ? String(error.name)
    : "Error";
}

function audioPlaybackProblem(stillBlocked = false): EdwardVoiceProblem {
  return {
    code: "VOICE_AUDIO_PLAYBACK_BLOCKED",
    message: stillBlocked
      ? "Your browser is still blocking Edward's audio playback."
      : "Your browser blocked Edward's audio playback.",
    recovery: stillBlocked
      ? "Allow sound for this site, then choose Enable audio again."
      : "Choose Enable audio, then continue the voice session.",
    canRetry: true,
  };
}
