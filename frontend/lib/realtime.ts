"use client";

export type RealtimeTopicPayload = {
  topics: string[];
  source?: "local" | "websocket";
  raw?: unknown;
};

type RealtimeListener = (payload: RealtimeTopicPayload) => void;

const LOCAL_EVENT_NAME = "cmms:realtime";

let socket: WebSocket | null = null;
let socketUrl: string | null | undefined;
const listeners = new Set<RealtimeListener>();

const normalizeTopics = (topics: Array<string | null | undefined>): string[] =>
  Array.from(new Set(topics.map((topic) => (topic ?? "").trim()).filter(Boolean)));

const resolveSocketUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  if (socketUrl !== undefined) return socketUrl;

  const explicitUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (explicitUrl) {
    socketUrl = explicitUrl;
    return socketUrl;
  }

  socketUrl = null;
  return socketUrl;
};

const buildTopicsFromMessage = (message: unknown): string[] => {
  if (!message || typeof message !== "object") return [];

  const source = message as Record<string, unknown>;
  const topics = Array.isArray(source.topics) ? source.topics.filter((item): item is string => typeof item === "string") : [];
  const topic = typeof source.topic === "string" ? source.topic : null;
  const scope = typeof source.scope === "string" ? source.scope : null;
  const resource = typeof source.resource === "string" ? source.resource : null;
  const requestId =
    typeof source.requestId === "string" || typeof source.requestId === "number"
      ? `request:${source.requestId}`
      : null;
  const workOrderId =
    typeof source.workOrderId === "string" || typeof source.workOrderId === "number"
      ? `work-order:${source.workOrderId}`
      : null;

  return normalizeTopics([...topics, topic, scope, resource, requestId, workOrderId]);
};

const notifyListeners = (payload: RealtimeTopicPayload) => {
  listeners.forEach((listener) => {
    listener(payload);
  });
};

const ensureSocket = () => {
  if (typeof window === "undefined" || socket) return;

  const url = resolveSocketUrl();
  if (!url) return;

  try {
    socket = new WebSocket(url);

    socket.addEventListener("message", (event) => {
      try {
        const raw = JSON.parse(event.data) as unknown;
        const topics = buildTopicsFromMessage(raw);
        if (topics.length > 0) {
          notifyListeners({ topics, source: "websocket", raw });
        }
      } catch {
        // Ignore malformed realtime frames so the UI keeps working.
      }
    });

    socket.addEventListener("close", () => {
      socket = null;
      window.setTimeout(() => {
        if (listeners.size > 0) {
          ensureSocket();
        }
      }, 3000);
    });

    socket.addEventListener("error", () => {
      socket?.close();
    });
  } catch {
    socket = null;
  }
};

export function emitRealtimeTopics(topics: Array<string | null | undefined>, raw?: unknown) {
  if (typeof window === "undefined") return;

  const normalizedTopics = normalizeTopics(topics);
  if (normalizedTopics.length === 0) return;

  const detail: RealtimeTopicPayload = {
    topics: normalizedTopics,
    source: "local",
    raw,
  };

  window.dispatchEvent(new CustomEvent<RealtimeTopicPayload>(LOCAL_EVENT_NAME, { detail }));
}

export function subscribeRealtime(listener: RealtimeListener): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  ensureSocket();
  listeners.add(listener);

  const handleLocalEvent = (event: Event) => {
    const customEvent = event as CustomEvent<RealtimeTopicPayload>;
    if (customEvent.detail?.topics?.length) {
      listener(customEvent.detail);
    }
  };

  window.addEventListener(LOCAL_EVENT_NAME, handleLocalEvent as EventListener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener(LOCAL_EVENT_NAME, handleLocalEvent as EventListener);
  };
}

export function buildRequestRealtimeTopics(requestId?: string | number | null): string[] {
  return normalizeTopics([
    "requests",
    "requester.requests",
    "supervisor.requests",
    "requester.dashboard",
    "supervisor.dashboard",
    requestId !== undefined && requestId !== null ? `request:${requestId}` : null,
    requestId !== undefined && requestId !== null ? `chat:${requestId}` : null,
  ]);
}

export function buildWorkOrderRealtimeTopics(workOrderId?: string | number | null, requestId?: string | number | null): string[] {
  return normalizeTopics([
    "work-orders",
    "supervisor.work-orders",
    "supervisor.dashboard",
    "requester.dashboard",
    workOrderId !== undefined && workOrderId !== null ? `work-order:${workOrderId}` : null,
    requestId !== undefined && requestId !== null ? `request:${requestId}` : null,
    requestId !== undefined && requestId !== null ? `chat:${requestId}` : null,
  ]);
}
