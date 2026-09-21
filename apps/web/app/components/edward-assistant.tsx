"use client";

import type {
  AskEdwardResponse,
  AssistantConversationMessage,
} from "@vv/contracts";
import { usePathname } from "next/navigation";
import { TenantLink as Link } from "./tenant-link";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Icon from "../design-system/Icon.jsx";
import { IconButton } from "../design-system/primitives/Button.jsx";
import { onEdwardOpen, type EdwardDoorContext } from "../design-lib/door.js";
import { DESTINATIONS, GROUPS } from "../design-lib/navigation.js";
import {
  TWO_PANE_QUERY,
  useIsSheet,
  useMedia,
  useOverlay,
} from "../design-lib/overlay.js";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import { useEdwardVoice } from "../hooks/use-edward-voice";
import {
  type EdwardLabRequestOptions,
  ApiClientError,
  askEdward,
  createAssistantConversation,
  getAssistantConversationMessages,
} from "../lib/api-client";
import {
  EDWARD_VOICE_STATE_LABELS,
  type EdwardCanonicalVoiceResponse,
} from "../lib/edward-voice";
import { AssistantBlocks } from "./assistant-blocks";
import { EdwardActionCard } from "./edward-action-card";
import { ActionWidget } from "./edward-action-widget";
import { EdwardComposer } from "./edward-composer";
import { EdwardHistory } from "./edward-history";
import { EdwardResponseFeedback } from "./edward-response-feedback";
import {
  EDWARD,
  EdwardThread,
  contextSourceLabels,
  type EdwardDisplayMessage,
} from "./edward-thread";
import { useTenant } from "./tenant-provider";
import styles from "./edward-assistant.module.css";
import experience from "./edward-experience.module.css";
import { useEdwardSuggestions } from "../hooks/use-edward-suggestions";

type DisplayMessage = EdwardDisplayMessage;

/**
 * `My Financials · Payments` — the composer's chip names the page the student
 * is on, read from the design model's destinations so it can never name a
 * page the navigation does not have. A tenant-prefixed path is tried without
 * its first segment as well.
 */
function pageContextLabel(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const candidates = [clean, clean.replace(/^\/[^/]+/, "") || "/"];
  let best: (typeof DESTINATIONS)[number] | null = null;
  for (const candidate of candidates) {
    for (const destination of DESTINATIONS) {
      if (
        candidate === destination.route ||
        candidate.startsWith(`${destination.route}/`)
      ) {
        if (!best || destination.route.length > best.route.length) {
          best = destination;
        }
      }
    }
  }
  if (!best) return null;
  return best.group
    ? `${GROUPS[best.group] ?? best.group} · ${best.label}`
    : best.label;
}

type Conversation = {
  id: string;
  title: string;
  messages: DisplayMessage[];
  /** Platform conversation backing this thread, once one exists. */
  serverId?: string;
};

/**
 * Whether the platform persists assistant conversations. "unknown" until the
 * first round-trip settles it; an endpoint that answers 404 marks it
 * "unavailable" and the panel keeps today's in-memory behaviour.
 */
type ConversationPersistence = "unknown" | "active" | "unavailable";

function conversationStorageKey(tenantSlug: string, studentName: string) {
  return `audentra.edward.active-conversation.v1:${tenantSlug}:${studentName}`;
}

function readStoredConversationId(key: string): string | null {
  try {
    const value = window.sessionStorage.getItem(key);
    return value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
      ? value
      : null;
  } catch {
    // Private browsing may deny storage while the API remains usable.
    return null;
  }
}

function writeStoredConversationId(key: string, conversationId: string | null) {
  try {
    if (conversationId === null) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, conversationId);
    }
  } catch {
    // The server still owns the conversation for this mounted session.
  }
}

function persistedMessageToDisplay(
  message: AssistantConversationMessage,
): DisplayMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    inputMode: message.inputMode,
    ...(message.suggestedActions.length
      ? { actions: message.suggestedActions }
      : {}),
    ...(message.provider ? { provider: message.provider } : {}),
    ...(message.contextReceipts.length
      ? { contextReceipts: message.contextReceipts }
      : {}),
    ...(message.widgets.length ? { widgets: message.widgets } : {}),
    ...(message.actionIntents?.length
      ? { actionIntents: message.actionIntents }
      : {}),
    ...(message.actionReceipts?.length
      ? { actionReceipts: message.actionReceipts }
      : {}),
    ...(message.blocks?.length ? { blocks: message.blocks } : {}),
    ...(message.requestId ? { traceId: message.requestId } : {}),
  };
}

function welcomeMessage(studentName: string): DisplayMessage {
  return {
    id: "welcome",
    role: "assistant",
    content: `Hi ${studentName} — I’m Edward, your private student guide. I can check your record and help you find the next step.`,
    provider: "guided",
    actions: [
      { label: "View enrollment", href: "/enrollment" },
      { label: "Explore classes", href: "/classrooms" },
    ],
  };
}

function conversationTitle(message: string) {
  const singleLine = message.replace(/\s+/g, " ").trim();
  return singleLine.length > 42 ? `${singleLine.slice(0, 39)}…` : singleLine;
}

type SpeechRecognitionResultEvent = Event & {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionErrorEvent = Event & {
  error?: string;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type VoiceWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

const subscribeToVoiceCapability = () => () => undefined;

function voiceCapabilitySnapshot() {
  if (typeof window === "undefined") return false;
  const voiceWindow = window as VoiceWindow;
  return Boolean(
    voiceWindow.SpeechRecognition ||
      voiceWindow.webkitSpeechRecognition,
  );
}

/** Developer observability hook: one call per completed text turn. */
export interface EdwardTurnEvent {
  question: string;
  response: AskEdwardResponse | null;
  error: string | null;
  latencyMs: number;
}

export function EdwardAssistant({
  studentName,
  variant = "floating",
  allowLiveVoice = true,
  onTurn,
  labOptions,
}: {
  studentName: string;
  variant?: "floating" | "embedded";
  /** Delegates may use browser-local dictation, but never platform live voice. */
  allowLiveVoice?: boolean;
  /**
   * Development-only observer (Edward Lab). Called after every send with the
   * raw response (including requestId) or the error. Never used on student
   * surfaces; adds no behavior when absent.
   */
  onTurn?: (turn: EdwardTurnEvent) => void;
  /**
   * Development-only request controls (Edward Lab): per-turn read planner
   * and execution mode headers. Absent on every student surface, in which
   * case the request is sent exactly as before.
   */
  labOptions?: EdwardLabRequestOptions;
}) {
  const { tenant } = useTenant();
  const [open, setOpen] = useState(variant === "embedded");
  const suggestionGroups = useEdwardSuggestions(open);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const pendingRequest = useRef<AbortController | null>(null);
  const retryRequest = useRef<{ message: string; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const voiceSupported = useSyncExternalStore(
    subscribeToVoiceCapability,
    voiceCapabilitySnapshot,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: "initial",
      title: "New conversation",
      messages: [welcomeMessage(studentName)],
    },
  ]);
  const [activeConversationId, setActiveConversationId] = useState("initial");
  const activeConversation =
    conversations.find(({ id }) => id === activeConversationId) ??
    conversations[0];
  const messages = useMemo(
    () => activeConversation?.messages ?? [],
    [activeConversation],
  );
  const [persistence, setPersistence] =
    useState<ConversationPersistence>("unknown");
  const floatingInput = useRef<HTMLTextAreaElement>(null);
  const workspaceInput = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // The floating window's forms: the conversation, or the history pane.
  const [view, setView] = useState<"conversation" | "history">("conversation");
  // What a door brought in — the chip's label and the hint. See `door.js`.
  const [doorContext, setDoorContext] = useState<EdwardDoorContext | null>(null);
  const [contextOn, setContextOn] = useState(true);
  const [focusPending, setFocusPending] = useState(false);
  // The last question that failed to send, so "Try again" can resend it.
  const [failedAsk, setFailedAsk] = useState<string | null>(null);
  const isSheet = useIsSheet();
  const twoPane = useMedia(TWO_PANE_QUERY);
  // "Play answer" — the browser reads an answer aloud. Real speech synthesis,
  // offered only where the browser has it.
  const [playing, setPlaying] = useState<string | null>(null);
  const canSpeak = useSyncExternalStore(
    subscribeToVoiceCapability,
    () => "speechSynthesis" in window,
    () => false,
  );
  const play = (id: string, text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (playing === id) {
      setPlaying(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = navigator.language || "en-US";
    utterance.onend = () => setPlaying((current) => (current === id ? null : current));
    utterance.onerror = () => setPlaying((current) => (current === id ? null : current));
    window.speechSynthesis.speak(utterance);
    setPlaying(id);
  };
  const recognition = useRef<SpeechRecognitionInstance | null>(null);
  const voiceRecovery = useRef<HTMLButtonElement>(null);
  const conversationCreation = useRef<Promise<string | null> | null>(null);
  const storageKey = conversationStorageKey(tenant.slug, studentName);
  const { track } = useActivityTracking();
  const pathname = usePathname() || "/";
  const pageContext = useMemo(
    () => ({ path: pathname, label: `${tenant.shortName} student portal` }),
    [pathname, tenant.shortName],
  );
  const pageLabel = useMemo(() => pageContextLabel(pathname), [pathname]);
  const contextLabel = contextOn
    ? (doorContext?.label ?? pageLabel ?? `${tenant.shortName} student portal`)
    : null;
  /**
   * Whether the platform offers LiveKit voice sessions. Like conversation
   * persistence, a 404 settles it; browser speech remains the fallback.
   */
  const [liveVoiceUnavailable, setLiveVoiceUnavailable] = useState(
    () => !allowLiveVoice,
  );
  const activeServerConversationId = activeConversation?.serverId ?? null;

  /** Re-read the persisted thread and merge it under the local welcome. */
  const refreshPersistedConversation = useCallback(
    async (serverId: string) => {
      const result = await getAssistantConversationMessages(serverId);
      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.serverId !== serverId) return conversation;
          const hydrated = result.messages.map(persistedMessageToDisplay);
          const hydratedIds = new Set(hydrated.map(({ id }) => id));
          const welcome = conversation.messages.filter(
            ({ id }) => id === "welcome",
          );
          const localOnly = conversation.messages.filter(
            ({ id }) => id !== "welcome" && !hydratedIds.has(id),
          );
          return {
            ...conversation,
            messages: [...welcome, ...hydrated, ...localOnly],
          };
        }),
      );
    },
    [],
  );

  const onVoiceCanonicalResponse = useCallback(
    (response: EdwardCanonicalVoiceResponse) => {
      const contextReceipts = response.contextReceipts ?? [];
      if (contextReceipts.length > 0) {
        track("ui.edward_context_receipts_received.v1", {
          source_count: contextReceipts.length,
          page_context: window.location.pathname,
        });
      }
      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.serverId !== response.conversationId) {
            return conversation;
          }
          if (
            conversation.messages.some(
              ({ id }) => id === response.assistantMessageId,
            )
          ) {
            return conversation;
          }
          return {
            ...conversation,
            messages: [
              ...conversation.messages,
              {
                id: response.assistantMessageId,
                role: "assistant" as const,
                content: response.message,
                inputMode: "voice" as const,
                actions: response.suggestedActions,
                provider: response.provider,
                contextReceipts,
                widgets: response.widgets ?? [],
                actionIntents: response.actionIntents ?? [],
                actionReceipts: response.actionReceipts ?? [],
                ...(response.blocks?.length ? { blocks: response.blocks } : {}),
                ...(response.requestId ? { traceId: response.requestId } : {}),
              },
            ],
          };
        }),
      );
      // The room event carries only the assistant turn; hydration recovers
      // the student's own voice turn from the persisted conversation.
      void refreshPersistedConversation(response.conversationId).catch(() => {
        // The canonical event already contains the complete assistant answer.
      });
    },
    [refreshPersistedConversation, track],
  );

  const voice = useEdwardVoice({
    conversationId: activeServerConversationId,
    pageContext,
    onCanonicalResponse: onVoiceCanonicalResponse,
    onUnavailable: () => setLiveVoiceUnavailable(true),
  });
  const prepareVoice = voice.prepareVoice;
  const voiceSessionOpen = !["idle", "ended"].includes(voice.state);

  // Restore the platform-persisted conversation for this tab, when one exists.
  // A backend without conversation persistence simply 404s here and the panel
  // continues with its in-memory behaviour.
  useEffect(() => {
    const storedId = readStoredConversationId(storageKey);
    if (!storedId) return;
    const abort = new AbortController();
    void getAssistantConversationMessages(storedId, abort.signal)
      .then((result) => {
        setPersistence("active");
        setConversations((current) =>
          current.map((conversation, index) =>
            index === 0 && conversation.serverId === undefined
              ? {
                  ...conversation,
                  serverId: result.conversationId,
                  title:
                    result.messages.find(({ role }) => role === "user")
                      ?.content.slice(0, 42) ?? conversation.title,
                  messages: [
                    welcomeMessage(studentName),
                    ...result.messages.map(persistedMessageToDisplay),
                  ],
                }
              : conversation,
          ),
        );
      })
      .catch((caught) => {
        if (abort.signal.aborted) return;
        if (caught instanceof ApiClientError && caught.status === 404) {
          // Gone on the server, or a backend without the endpoint; the next
          // send finds out which by trying to create a conversation.
          writeStoredConversationId(storageKey, null);
        }
      });
    return () => abort.abort();
  }, [storageKey, studentName]);

  useEffect(() => {
    return () => {
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  // The floating window's first focus is `useOverlay`'s (its first control),
  // as in the reference; the door is the one path that lands in the field.
  useEffect(() => {
    if (!open || variant !== "embedded") return;
    workspaceInput.current?.focus();
  }, [open, variant]);

  // The door wrote the question; the caret goes to its end so she can fix it.
  useEffect(() => {
    if (!open || !focusPending) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const field = floatingInput.current;
      if (field) {
        field.focus();
        const end = field.value.length;
        field.setSelectionRange(end, end);
      }
      setFocusPending(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, focusPending]);

  // The pill is not in the DOM while the window is open, so the focus
  // hand-back is ours rather than `useOverlay`'s.
  useEffect(() => {
    if (variant !== "floating") return;
    if (wasOpen.current && !open) launcher.current?.focus();
    wasOpen.current = open;
  }, [open, variant]);

  // Warm the LiveKit client bundle while the student is looking at the panel
  // so the first voice start does not pay the module download.
  useEffect(() => {
    if (
      allowLiveVoice &&
      open &&
      !liveVoiceUnavailable &&
      persistence !== "unavailable"
    ) {
      prepareVoice();
    }
  }, [allowLiveVoice, liveVoiceUnavailable, open, persistence, prepareVoice]);

  useEffect(() => {
    if (voice.state === "recoverable_error") {
      voiceRecovery.current?.focus();
    }
  }, [voice.state]);

  useEffect(() => {
    const embedded = transcript.current;
    const embeddedAnswer = embedded?.querySelector<HTMLElement>(".edward-message--assistant:last-of-type");
    if (embedded) embedded.scrollTo({ top: !sending && embeddedAnswer
      ? Math.max(0, embeddedAnswer.offsetTop - embedded.offsetTop - 20) : embedded.scrollHeight });
    // An empty conversation is read from the top: the greeting and the
    // suggestions are the content. Only a conversation follows its own tail.
    const thread = bottom.current?.parentElement;
    if (thread && messages.length > 1) {
      const latest = thread.querySelector<HTMLElement>(".edward-turn.edward:last-of-type");
      thread.scrollTo({ top: !sending && latest
        ? Math.max(0, latest.offsetTop - thread.offsetTop - 20) : thread.scrollHeight });
    }
  }, [activeConversationId, messages, sending, voice.caption, voice.state, open, view]);

  const updateConversation = (
    conversationId: string,
    update: (conversation: Conversation) => Conversation,
  ) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? update(conversation)
          : conversation,
      ),
    );
  };

  const addSystemMessage = (content: string) => {
    updateConversation(activeConversationId, (conversation) => ({
      ...conversation,
      messages: [
        ...conversation.messages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content,
          provider: "guided",
        },
      ],
    }));
  };

  /**
   * The platform conversation backing a local thread, created lazily on the
   * first send. Returns null when persistence is unavailable — the exchange
   * then stays in memory exactly as before.
   */
  const ensureServerConversation = async (
    localConversationId: string,
  ): Promise<string | null> => {
    if (persistence === "unavailable") return null;
    const existing = conversations.find(
      ({ id }) => id === localConversationId,
    )?.serverId;
    if (existing) return existing;
    if (conversationCreation.current) return conversationCreation.current;
    const creation = (async () => {
      try {
        const conversation = await createAssistantConversation({
          pageContext: {
            path: window.location.pathname,
            label: `${tenant.shortName} student portal`,
          },
        });
        setPersistence("active");
        updateConversation(localConversationId, (current) => ({
          ...current,
          serverId: conversation.id,
        }));
        writeStoredConversationId(storageKey, conversation.id);
        return conversation.id;
      } catch (caught) {
        if (caught instanceof ApiClientError && caught.status === 404) {
          setPersistence("unavailable");
          return null;
        }
        // A transient failure: keep this turn in memory and let a later
        // send try to open a conversation again.
        return null;
      } finally {
        conversationCreation.current = null;
      }
    })();
    conversationCreation.current = creation;
    return creation;
  };

  const send = async (message: string, speakResponse = voiceReplies) => {
    const normalized = message.trim();
    if (!normalized || sending) return;
    const retrying = retryRequest.current?.message === normalized;
    const clientMessageId = retrying ? retryRequest.current!.id : crypto.randomUUID();
    retryRequest.current = { message: normalized, id: clientMessageId };
    const controller = new AbortController();
    pendingRequest.current = controller;
    const userMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: normalized,
      ...(variant === "floating" && contextLabel ? { context: contextLabel } : {}),
    };
    const history = messages
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));
    const conversationId = activeConversationId;
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      title:
        conversation.messages.length === 1
          ? conversationTitle(normalized)
          : conversation.title,
      messages: retrying ? conversation.messages : [...conversation.messages, userMessage],
    }));
    setDraft("");
    setError(null);
    setFailedAsk(null);
    setSending(true);
    const sendStartedAt = performance.now();
    try {
      const serverConversationId =
        await ensureServerConversation(conversationId);
      const response = await askEdward(
        {
          ...(serverConversationId
            ? { conversationId: serverConversationId, clientMessageId }
            : {}),
          message: normalized,
          inputMode: "text",
          pageContext: window.location.pathname,
          history,
        },
        controller.signal,
        labOptions ?? {},
      );
      if (serverConversationId && response.conversationId) {
        writeStoredConversationId(storageKey, response.conversationId);
      }
      retryRequest.current = null;
      const contextReceipts = response.contextReceipts ?? [];
      if (contextReceipts.length > 0) {
        track("ui.edward_context_receipts_received.v1", {
          source_count: contextReceipts.length,
          page_context: window.location.pathname,
        });
      }
      if (process.env.NODE_ENV !== "production" && response.requestId) {
        // Development-only: the request id is the AssistantTurnTrace id.
        // Inspect the full turn with
        //   GET {API}/internal/assistant/traces/{requestId}
        // (worker token; see Audentra-platform docs/25).
        console.debug("[edward] trace", response.requestId);
      }
      onTurn?.({
        question: normalized,
        response,
        error: null,
        latencyMs: performance.now() - sendStartedAt,
      });
      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: [
          ...conversation.messages,
          {
            id: response.assistantMessageId ?? crypto.randomUUID(),
            role: "assistant",
            content: response.message,
            actions: response.suggestedActions,
            provider: response.provider,
            contextReceipts,
            widgets: response.widgets ?? [],
            actionIntents: response.actionIntents ?? [],
            actionReceipts: response.actionReceipts ?? [],
            ...(response.blocks?.length ? { blocks: response.blocks } : {}),
            ...(response.requestId ? { traceId: response.requestId } : {}),
          },
        ],
      }));
      if (speakResponse && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(response.message);
        utterance.lang = navigator.language || "en-US";
        utterance.rate = 1;
        window.speechSynthesis.speak(utterance);
      }
    } catch (caught) {
      const message = controller.signal.aborted
        ? "Stopped waiting. Your request may still finish; retry checks the same request."
        : caught instanceof Error
          ? caught.message
          : "Edward could not answer just now. Please try again.";
      setError(message);
      setFailedAsk(normalized);
      // The question stays in the box below, exactly as the reference promises.
      setDraft((current) => (current.trim() ? current : normalized));
      onTurn?.({
        question: normalized,
        response: null,
        error: message,
        latencyMs: performance.now() - sendStartedAt,
      });
    } finally {
      pendingRequest.current = null;
      setSending(false);
    }
  };

  const toggleVoiceInput = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const voiceWindow = window as VoiceWindow;
    const Recognition =
      voiceWindow.SpeechRecognition ||
      voiceWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError(
        "Voice input is not available in this browser. You can still type your question.",
      );
      return;
    }
    const nextRecognition = new Recognition();
    recognition.current = nextRecognition;
    nextRecognition.lang = navigator.language || "en-US";
    nextRecognition.continuous = false;
    nextRecognition.interimResults = false;
    nextRecognition.onstart = () => {
      setError(null);
      setListening(true);
    };
    nextRecognition.onend = () => {
      setListening(false);
      recognition.current = null;
    };
    nextRecognition.onerror = (event) => {
      setListening(false);
      recognition.current = null;
      setError(
        event.error === "not-allowed"
          ? "Microphone access was blocked. Allow microphone access or type your question."
          : "Edward could not hear that clearly. Please try again or type your question.",
      );
    };
    nextRecognition.onresult = (event) => {
      const spokenMessage = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (!spokenMessage) return;
      setDraft(spokenMessage);
      setVoiceReplies(true);
      void send(spokenMessage, true);
    };
    try {
      nextRecognition.start();
    } catch {
      setListening(false);
      recognition.current = null;
      setError(
        "Edward could not start the microphone. Please try again or type your question.",
      );
    }
  };

  const startOrEndLiveVoice = async () => {
    if (!allowLiveVoice) {
      toggleVoiceInput();
      return;
    }
    if (voice.microphoneActive || voiceSessionOpen) {
      await voice.endVoice();
      (variant === "embedded"
        ? workspaceInput.current
        : floatingInput.current
      )?.focus();
      return;
    }
    try {
      const serverConversationId =
        await ensureServerConversation(activeConversationId);
      if (!serverConversationId) {
        // Persistence is unavailable, so platform voice cannot exist either;
        // fall back to the browser's own speech recognition.
        toggleVoiceInput();
        return;
      }
      await voice.startVoice(serverConversationId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Edward could not prepare the voice conversation.",
      );
    }
  };

  const handleVoiceButton = () => {
    if (
      !allowLiveVoice ||
      liveVoiceUnavailable ||
      persistence === "unavailable"
    ) {
      toggleVoiceInput();
      return;
    }
    void startOrEndLiveVoice();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(draft);
  };

  const handleComposerKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    void send(draft);
  };

  const focusInput = () =>
    (variant === "embedded"
      ? workspaceInput.current
      : floatingInput.current
    )?.focus();

  const conversationIsEmpty =
    messages.length === 1 &&
    activeConversation?.title === "New conversation" &&
    !activeConversation?.serverId;

  /** A fresh thread — or the current one, when nothing has been said in it yet. */
  const beginConversation = () => {
    retryRequest.current = null;
    if (voiceSessionOpen) void voice.endVoice();
    setDraft("");
    setError(null);
    setFailedAsk(null);
    setHistoryOpen(false);
    setView("conversation");
    setContextOn(true);
    setDoorContext(null);
    if (conversationIsEmpty) return;
    const id = crypto.randomUUID();
    setConversations((current) => [
      {
        id,
        title: "New conversation",
        messages: [welcomeMessage(studentName)],
      },
      ...current,
    ]);
    setActiveConversationId(id);
  };

  const startNewConversation = () => {
    if (sending) return;
    beginConversation();
    window.requestAnimationFrame(focusInput);
  };

  const selectConversation = (conversationId: string) => {
    if (sending || conversationId === activeConversationId) {
      setHistoryOpen(false);
      if (!twoPane) setView("conversation");
      return;
    }
    if (voiceSessionOpen) void voice.endVoice();
    retryRequest.current = null;
    setActiveConversationId(conversationId);
    setDraft("");
    setError(null);
    setFailedAsk(null);
    setHistoryOpen(false);
    setDoorContext(null);
    if (!twoPane) setView("conversation");
    window.requestAnimationFrame(focusInput);
  };

  const retry = () => {
    if (!failedAsk) return;
    void send(failedAsk);
  };

  const closeFloating = () => {
    if (voiceSessionOpen) void voice.endVoice();
    setOpen(false);
  };

  // The door — a screen opens Edward with the question written and *not*
  // sent: a fresh conversation (or the current empty one), the chip naming
  // the item, the input focused with the caret at the end.
  const openDoor = (detail: { question?: string; context?: EdwardDoorContext | null }) => {
    if (variant !== "floating") return;
    if (!sending) beginConversation();
    setDoorContext(detail.context ?? null);
    setContextOn(true);
    setDraft(detail.question ?? "");
    setError(null);
    setView("conversation");
    setOpen(true);
    setFocusPending(true);
  };
  const doorHandler = useRef(openDoor);
  useEffect(() => {
    doorHandler.current = openDoor;
  });
  useEffect(() => onEdwardOpen((detail) => doorHandler.current(detail)), []);

  const liveVoiceControls =
    allowLiveVoice && (voiceSessionOpen || voice.problem) ? (
      <section
        className="edward-live-voice"
        data-state={voice.state}
        aria-label="Edward voice controls"
      >
        <div
          className="edward-live-voice__summary"
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">
            {voice.microphoneActive ? "◉" : "○"}
          </span>
          <div>
            <strong>{EDWARD_VOICE_STATE_LABELS[voice.state]}</strong>
            <small>
              {voice.microphoneActive
                ? "Microphone active · you can keep typing"
                : "Text Edward remains available"}
            </small>
          </div>
        </div>
        {voice.problem ? (
          <div className="edward-live-voice__problem" role="alert">
            <strong>{voice.problem.message}</strong>
            <p>{voice.problem.recovery}</p>
          </div>
        ) : null}
        <div className="edward-live-voice__controls">
          {voice.problem?.code === "VOICE_AUDIO_PLAYBACK_BLOCKED" ? (
            <button
              ref={voiceRecovery}
              type="button"
              onClick={() => void voice.enableAudioPlayback()}
            >
              Enable audio
            </button>
          ) : voice.problem?.canRetry ? (
            <button
              ref={voiceRecovery}
              type="button"
              onClick={() => void voice.retryVoice()}
            >
              {voice.problem.sessionExpired
                ? "Begin another voice session"
                : [
                      "VOICE_LIVEKIT_DISCONNECTED",
                      "VOICE_WORKER_UNAVAILABLE",
                      "VOICE_EVENT_UNREADABLE",
                    ].includes(voice.problem.code)
                  ? "Reconnect voice"
                  : "Try again"}
            </button>
          ) : null}
          {voiceSessionOpen ? (
            <>
              <button
                type="button"
                disabled={voice.state !== "assistant_speaking"}
                onClick={() => void voice.stopSpeaking()}
              >
                Stop assistant speech
              </button>
              <button
                type="button"
                onClick={() => void startOrEndLiveVoice()}
              >
                End voice session
              </button>
            </>
          ) : null}
        </div>
      </section>
    ) : null;

  const browserVoiceOnly =
    !allowLiveVoice || liveVoiceUnavailable || persistence === "unavailable";
  const micDisabled = sending || (browserVoiceOnly && !voiceSupported);
  const micLabel = voiceSessionOpen
    ? "End Edward voice session"
    : listening
      ? "Stop listening"
      : browserVoiceOnly
        ? voiceSupported
          ? "Ask Edward by voice"
          : "Voice input is unavailable"
        : "Start voice with Edward";

  const panel = (
    <section
      id={variant === "floating" ? "edward-panel" : "edward-workspace"}
      className={
        variant === "floating"
          ? "edward-panel"
          : `edward-panel edward-panel--embedded ${styles.embeddedPanel} ${experience.surface} ${experience.embedded}`
      }
      role={variant === "floating" ? "dialog" : "region"}
      aria-label="Edward AI student guide"
    >
      <header
        className={`edward-panel__header${
          variant === "embedded" ? ` ${styles.workspaceHeader}` : ""
        }`}
      >
        {variant === "embedded" ? (
          <button
            className={styles.historyToggle}
            type="button"
            aria-label={
              historyOpen
                ? "Close conversation history"
                : "Open conversation history"
            }
            aria-expanded={historyOpen}
            aria-controls="edward-conversation-navigation"
            onClick={() => setHistoryOpen((current) => !current)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        ) : null}
        <span className="edward-avatar" aria-hidden="true">
          E
        </span>
        <div>
          <strong>Edward</strong>
          <span>
            <i aria-hidden="true" /> Connected to your {tenant.shortName} record
          </span>
        </div>
        {variant === "floating" ? (
          <button
            type="button"
            aria-label="Close Edward"
            onClick={() => {
              if (voiceSessionOpen) void voice.endVoice();
              setOpen(false);
            }}
          >
            ×
          </button>
        ) : (
          <span className="edward-secure">Private</span>
        )}
      </header>

      <div
        ref={transcript}
        className={`edward-transcript${
          variant === "embedded" ? ` ${styles.embeddedTranscript}` : ""
        }`}
        aria-live="polite"
      >
        {messages.map((message) => (
          <article
            className={`edward-message edward-message--${message.role}${
              variant === "embedded"
                ? ` ${styles.embeddedMessage} ${
                    message.role === "user"
                      ? styles.embeddedUserMessage
                      : styles.embeddedAssistantMessage
                  }${message.id === "welcome" ? ` ${styles.welcomeMessage}` : ""}`
                : ""
            }`}
            key={message.id}
          >
            {message.role === "assistant" && message.blocks?.length ? (
              <AssistantBlocks blocks={message.blocks} idPrefix={message.id} />
            ) : (
              <p>{message.content}</p>
            )}
            {message.inputMode === "voice" ? (
              <span className="edward-message__mode">Voice message</span>
            ) : null}
            {message.contextReceipts?.length ? (
              <div
                className="edward-context-receipts"
                aria-label="Student record context used for this response"
              >
                <span className="edward-context-receipts__label">
                  Record context
                </span>
                {message.contextReceipts.map(({ source }) => (
                  <span key={`${message.id}-${source}`}>
                    {contextSourceLabels[source]}
                  </span>
                ))}
              </div>
            ) : null}
            {message.widgets?.map((widget) => (
              <ActionWidget
                widget={widget}
                onCompleted={addSystemMessage}
                key={`${message.id}-${widget.id}`}
              />
            ))}
            {/* The confirmation card IS the write experience: without it a
                proposed change can neither be reviewed nor confirmed. This
                inline renderer predates the action plane and silently dropped
                `actionIntents` — found by the browser E2E suite, invisible to
                the component tests, which exercise EdwardThread instead. */}
            {message.actionIntents?.map((intent) => (
              <EdwardActionCard intent={intent} actor="student" key={intent.id} />
            ))}
            {message.actions?.length ? (
              <div className="edward-actions">
                {message.actions.map((action) => (
                  <Link href={action.href} key={`${message.id}-${action.href}`}>
                    {action.label} <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            ) : null}
            {message.role === "assistant" && message.provider ? (
              <small>
                {message.provider === "openrouter" || message.provider === "openai"
                  ? "AI-generated guidance · verify important decisions"
                  : "Built-in portal guidance"}
              </small>
            ) : null}
            {message.role === "assistant" && message.traceId ? (
              <EdwardResponseFeedback
                target={{
                  assistantKind: "student",
                  assistantMessageId: message.id,
                  traceId: message.traceId,
                }}
              />
            ) : null}
          </article>
        ))}
        {voice.caption ? (
          <aside
            className="edward-live-caption"
            aria-label={
              voice.caption.final
                ? "Final voice caption"
                : "Interim voice caption"
            }
          >
            <span>{voice.caption.final ? "Heard" : "Listening"}</span>
            <p>{voice.caption.text}</p>
          </aside>
        ) : null}
        {sending ? (
          <div className="edward-typing" role="status">
            <span />
            <span />
            <span />
            Edward is checking your portal
          </div>
        ) : null}
        {error ? (
          <p className="edward-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {liveVoiceControls}

      {messages.length === 1 ? (
        <div
          className={`edward-prompts${
            variant === "embedded" ? ` ${styles.embeddedPrompts}` : ""
          }`}
          aria-label="Suggested questions"
        >
          {suggestionGroups.flatMap((group) => group.items.map((item) => item.text)).map((prompt) => (
            <button type="button" onClick={() => void send(prompt)} key={prompt}>
              {prompt}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className={`edward-composer${
          variant === "embedded" ? ` ${styles.embeddedComposer}` : ""
        }`}
        onSubmit={submit}
      >
        <label htmlFor={`edward-message-${variant}`}>
          Ask about your student journey
        </label>
        <div>
          <textarea
            ref={workspaceInput}
            id={`edward-message-${variant}`}
            value={draft}
            rows={1}
            maxLength={2_000}
            autoComplete="off"
            placeholder="Message Edward"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
          />
          <button
            className={`edward-voice-button${
              listening || voice.microphoneActive ? " is-listening" : ""
            }`}
            type="button"
            disabled={
              sending ||
              ((!allowLiveVoice || liveVoiceUnavailable || persistence === "unavailable") &&
                !voiceSupported)
            }
            aria-label={
              voiceSessionOpen
                ? "End Edward voice session"
                : listening
                  ? "Stop listening"
                  : !allowLiveVoice || liveVoiceUnavailable || persistence === "unavailable"
                    ? voiceSupported
                      ? "Ask Edward by voice"
                      : "Voice input is unavailable"
                    : "Start voice with Edward"
            }
            aria-pressed={listening || voice.microphoneActive}
            title={
              !allowLiveVoice || liveVoiceUnavailable || persistence === "unavailable"
                ? voiceSupported
                  ? "Ask Edward by voice"
                  : "Voice input is not supported by this browser"
                : "Talk with Edward live"
            }
            onClick={handleVoiceButton}
          >
            <span aria-hidden="true">
              {listening || voice.microphoneActive ? "■" : "●"}
            </span>
          </button>
          <button
            className="edward-send-button"
            type="submit"
            disabled={!sending && draft.trim().length === 0}
            onClick={sending ? (event) => { event.preventDefault(); pendingRequest.current?.abort(); } : undefined}
            aria-label={sending ? "Stop waiting" : "Send message"}
          >
            {sending ? "■" : "↑"}
          </button>
        </div>
        {listening ? (
          <p className="edward-voice-status" role="status">
            <span aria-hidden="true" /> Listening — ask your question naturally.
          </p>
        ) : voiceReplies ? (
          <button
            className="edward-voice-replies"
            type="button"
            onClick={() => {
              window.speechSynthesis?.cancel();
              setVoiceReplies(false);
            }}
          >
            Voice replies are on · turn off
          </button>
        ) : null}
        <small>
          Edward can make mistakes. Verify important academic, aid, and payment
          decisions with the official record.
        </small>
      </form>
    </section>
  );

  if (variant === "embedded") {
    return (
      <div
        className={`${styles.workspace}${
          historyOpen ? ` ${styles.workspaceHistoryOpen}` : ""
        }`}
      >
        <aside
          id="edward-conversation-navigation"
          className={styles.conversationNavigation}
          aria-label="Edward conversation history"
          hidden={!historyOpen}
        >
          <header>
            <div>
              <strong>Conversations</strong>
              <small>This browser tab</small>
            </div>
            <button
              type="button"
              aria-label="Close conversation history"
              onClick={() => setHistoryOpen(false)}
            >
              ×
            </button>
          </header>
          <button
            className={styles.newConversation}
            type="button"
            disabled={sending}
            onClick={startNewConversation}
          >
            <span aria-hidden="true">+</span>
            New conversation
          </button>
          <nav aria-label="Conversation list">
            {conversations.map((conversation) => (
              <button
                type="button"
                disabled={sending}
                aria-current={
                  conversation.id === activeConversationId ? "page" : undefined
                }
                onClick={() => selectConversation(conversation.id)}
                key={conversation.id}
              >
                <span>{conversation.title}</span>
                <small>
                  {conversation.messages.length > 1
                    ? `${conversation.messages.length - 1} messages`
                    : "Ready when you are"}
                </small>
              </button>
            ))}
          </nav>
          {persistence === "active" ? (
            <p>
              <span aria-hidden="true">●</span>
              Your latest conversation is saved to your student record and
              restored when you return in this tab.
            </p>
          ) : (
            <p>
              <span aria-hidden="true">●</span>
              Conversations remain in memory for this tab and are not stored in
              browser storage.
            </p>
          )}
        </aside>
        {historyOpen ? (
          <button
            className={styles.historyBackdrop}
            type="button"
            aria-label="Close conversation history"
            onClick={() => setHistoryOpen(false)}
          />
        ) : null}
        {panel}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        className="edward-launcher"
        ref={launcher}
        type="button"
        aria-expanded="false"
        aria-controls="edward-panel"
        onClick={() => setOpen(true)}
      >
        <span className="edward-mark small" aria-hidden="true">
          {EDWARD.mark}
        </span>
        Ask {EDWARD.name}
      </button>
    );
  }

  const showHistory = view === "history";
  const showThread = !showHistory || twoPane;
  const greeting = messages.find(({ id }) => id === "welcome") ?? null;
  const greetingBody = greeting
    ? {
        ...greeting,
        content: greeting.content.replace(/^Hi [^—]+—\s*/, ""),
      }
    : null;
  const thread = messages.filter(({ id }) => id !== "welcome");
  const historyItems = conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    count: conversation.messages.filter(({ id }) => id !== "welcome").length,
    saved: Boolean(conversation.serverId) && persistence === "active",
  }));
  const micListening = listening || voice.microphoneActive;
  const composerNote: ReactNode = listening ? (
    <p className="edward-mic-note" role="status">
      <Icon name="info" size={12} /> Listening — ask your question naturally.
    </p>
  ) : voiceReplies ? (
    <p className="edward-mic-note" role="status">
      <Icon name="sound" size={12} /> Voice replies are on.
      <button
        type="button"
        className="text-button"
        onClick={() => {
          window.speechSynthesis?.cancel();
          setVoiceReplies(false);
        }}
      >
        Turn off
      </button>
    </p>
  ) : null;

  return (
    <EdwardWindow
      isSheet={isSheet}
      wide={showHistory && twoPane}
      historyOnly={showHistory && !showThread}
      onClose={closeFloating}
    >
      <header className="edward-head">
        {showHistory && !twoPane ? (
          <IconButton
            name="back"
            size={18}
            label="Back to the conversation"
            tip="Back"
            onClick={() => setView("conversation")}
          />
        ) : null}
        <span className="edward-mark small" aria-hidden="true">
          {EDWARD.mark}
        </span>
        <div className="edward-title">
          <strong>{EDWARD.name}</strong>
          <span>{tenant.shortName}’s AI assistant</span>
        </div>
        {showThread ? (
          <IconButton
            className={showHistory ? "active" : undefined}
            name="clock"
            size={18}
            label="Your conversations"
            aria-pressed={showHistory}
            onClick={() => setView(showHistory ? "conversation" : "history")}
          />
        ) : null}
        <IconButton
          name="pen"
          size={18}
          label="New conversation"
          disabled={sending}
          onClick={startNewConversation}
        />
        <IconButton
          name="close"
          size={18}
          label="Close Edward"
          tip="Close"
          onClick={closeFloating}
        />
      </header>

      <div className="edward-body">
        {showHistory ? (
          <EdwardHistory
            conversations={historyItems}
            activeId={activeConversationId}
            disabled={sending}
            onOpen={selectConversation}
            onNew={startNewConversation}
          />
        ) : null}

        {showThread ? (
          <div className="edward-main">
            <EdwardThread
              studentName={studentName}
              greeting={greetingBody}
              messages={thread}
              suggestions={suggestionGroups}
              thinking={sending}
              error={error}
              canRetry={Boolean(failedAsk) && !sending}
              caption={voice.caption ?? null}
              playing={playing}
              onPlay={canSpeak ? play : null}
              onAsk={(item) => void send(item.text)}
              onRetry={retry}
              onWidgetCompleted={addSystemMessage}
              bottomRef={bottom}
            />
            <EdwardComposer
              draft={draft}
              onDraft={setDraft}
              onSend={(value) => void send(value)}
              context={contextLabel}
              onDropContext={() => setContextOn(false)}
              listening={micListening}
              micLabel={micLabel}
              micDisabled={micDisabled}
              onMic={handleVoiceButton}
              disabled={sending}
              onStop={() => pendingRequest.current?.abort()}
              note={composerNote}
              inputRef={floatingInput}
            >
              {liveVoiceControls}
            </EdwardComposer>
          </div>
        ) : null}
      </div>
    </EdwardWindow>
  );
}

/**
 * Split out so the dialog element mounts and unmounts as one unit — the
 * overlay hook keys its focus handling to that lifetime. Non-modal on a
 * desktop (the page stays live behind it); a modal sheet with a scrim below
 * the sheet breakpoint.
 */
function EdwardWindow({
  isSheet,
  wide,
  historyOnly,
  onClose,
  children,
}: {
  isSheet: boolean;
  wide: boolean;
  historyOnly: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel: RefObject<HTMLElement | null> = useRef<HTMLElement>(null);
  useOverlay(panel, { onClose, modal: isSheet, returnFocus: false });

  return (
    <>
      {isSheet ? (
        <button
          type="button"
          className="modal-scrim edward-scrim"
          aria-label="Close Edward"
          onClick={onClose}
        />
      ) : null}
      <aside
        id="edward-panel"
        className={`edward-panel ${experience.surface} ${experience.floating}${wide ? " wide" : ""}${historyOnly ? " history-only" : ""}`}
        ref={panel}
        role="dialog"
        aria-modal={isSheet ? "true" : undefined}
        aria-label="Edward, your AI assistant"
      >
        {children}
      </aside>
    </>
  );
}
