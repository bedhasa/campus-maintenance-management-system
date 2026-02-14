"use client";

import { useMemo, useState, useEffect } from "react";
import { Bell, CheckCheck, ChevronRight, MessageSquare, ShieldAlert, ClipboardCheck, Clock3 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import RequestDetailModal from "@/components/RequestDetailModal";
import { MaintenanceRequest, Priority, TicketStatus } from "@/types";

type NotificationItem = {
  id: number;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  request_id?: number | null;
  request?: { id?: number | null } | null;
  data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  rejected_by?: string | null;
  rejected_by_name?: string | null;
  rejection_reason?: string | null;
};

type NotificationResponse = {
  success: boolean;
  notifications: {
    data: NotificationItem[];
  };
};

type SettingsResponse = {
  success: boolean;
  settings: {
    notifications: {
      status: boolean;
      chat: boolean;
      feedback: boolean;
    };
  };
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(parsed);
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const recordValue = (obj: Record<string, unknown> | null | undefined, key: string): unknown =>
  obj && key in obj ? obj[key] : undefined;

const getRequestId = (item: NotificationItem): number | null => {
  const direct =
    item.request_id ??
    item.request?.id ??
    toNumber(recordValue(item.data, "request_id")) ??
    toNumber(recordValue(item.metadata, "request_id")) ??
    toNumber(recordValue(item.meta, "request_id"));
  if (direct) return direct;

  const match = item.message.match(/(?:MR[-#\s]?|request\s*#?\s*)(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const detectKind = (item: NotificationItem): "chat" | "rejection" | "status" | "feedback" | "other" => {
  const text = `${item.type} ${item.message}`.toLowerCase();
  if (text.includes("chat") || text.includes("message")) return "chat";
  if (text.includes("rejected") || text.includes("rejection")) return "rejection";
  if (text.includes("feedback") || text.includes("survey") || text.includes("rate")) return "feedback";
  if (
    text.includes("submitted") ||
    text.includes("approved") ||
    text.includes("assigned") ||
    text.includes("in_progress") ||
    text.includes("in progress") ||
    text.includes("completed") ||
    text.includes("closed")
  ) {
    return "status";
  }
  return "other";
};

const getRejectionInfo = (item: NotificationItem) => {
  const by =
    item.rejected_by_name ??
    item.rejected_by ??
    (recordValue(item.data, "rejected_by_name") as string | undefined) ??
    (recordValue(item.data, "rejected_by") as string | undefined) ??
    (recordValue(item.metadata, "rejected_by_name") as string | undefined) ??
    (recordValue(item.metadata, "rejected_by") as string | undefined) ??
    (recordValue(item.meta, "rejected_by_name") as string | undefined) ??
    (recordValue(item.meta, "rejected_by") as string | undefined);
  const reason =
    item.rejection_reason ??
    (recordValue(item.data, "rejection_reason") as string | undefined) ??
    (recordValue(item.metadata, "rejection_reason") as string | undefined) ??
    (recordValue(item.meta, "rejection_reason") as string | undefined);
  const at =
    (recordValue(item.data, "rejected_at") as string | undefined) ??
    (recordValue(item.metadata, "rejected_at") as string | undefined) ??
    (recordValue(item.meta, "rejected_at") as string | undefined) ??
    item.created_at;

  return {
    rejectedBy: by || "Supervisor",
    reason: reason || "No rejection reason was provided.",
    rejectedAt: at,
  };
};

export default function RoutePage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"info" | "chat">("info");
  const [expandedRejectionId, setExpandedRejectionId] = useState<number | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState({
    status: true,
    chat: true,
    feedback: true,
  });

  const unreadCount = useMemo(() => items.filter((i) => !i.is_read).length, [items]);
  const modalRequest = useMemo<MaintenanceRequest | null>(() => {
    if (!activeRequestId) return null;
    return {
      id: String(activeRequestId),
      title: `MR-${activeRequestId}`,
      requesterId: "",
      requesterName: "Requester",
      department: "",
      location: "",
      problemType: "",
      urgency: Priority.MEDIUM,
      description: "",
      status: TicketStatus.PENDING,
      createdAt: "",
      updatedAt: "",
    };
  }, [activeRequestId]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<NotificationResponse>("/api/requester/notifications", { method: "GET" }, true);
      setItems(data.notifications?.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load notifications.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const data = await apiRequest<SettingsResponse>("/api/requester/settings", { method: "GET" }, true);
        setNotificationPrefs(data.settings?.notifications ?? { status: true, chat: true, feedback: true });
      } catch {
        // ignore settings fetch errors and keep defaults
      }
    };
    void loadPrefs();
  }, []);

  const markRead = async (id: number) => {
    try {
      await apiRequest(`/api/requester/notifications/${id}/read`, { method: "PATCH" }, true);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest("/api/requester/notifications/read-all", { method: "POST" }, true);
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch {
      // ignore
    }
  };

  const onNotificationClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      await markRead(item.id);
    }

    const kind = detectKind(item);
    const requestId = getRequestId(item);

    if (kind === "rejection") {
      setExpandedRejectionId((prev) => (prev === item.id ? null : item.id));
      return;
    }

    if (!requestId) return;

    setActiveRequestId(requestId);
    setActiveView(kind === "chat" ? "chat" : "info");
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-black text-slate-900 leading-none">Notifications</h1>
            <p className="text-sm text-slate-500 mt-2 font-medium">Status alerts, chat updates, and review outcomes</p>
          </div>
          <button
            onClick={markAllRead}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors flex items-center gap-2"
          >
            <CheckCheck size={14} />
            Mark All Read
          </button>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest">
          <Bell size={12} />
          {unreadCount} unread
        </div>
      </div>

      {loading && <p className="text-sm font-medium text-gray-500">Loading notifications...</p>}
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="space-y-3">
          {items.filter((item) => {
            const kind = detectKind(item);
            if (kind === "chat") return notificationPrefs.chat;
            if (kind === "feedback") return notificationPrefs.feedback;
            if (kind === "status" || kind === "rejection") return notificationPrefs.status;
            return true;
          }).map((item) => {
            const kind = detectKind(item);
            const requestId = getRequestId(item);
            const rejection = getRejectionInfo(item);
            const isExpanded = expandedRejectionId === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNotificationClick(item)}
                className={`w-full text-left p-4 md:p-5 rounded-2xl border transition-all ${
                  item.is_read
                    ? "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow-sm"
                    : "bg-blue-50/70 border-blue-200 text-slate-900 shadow-[0_8px_24px_rgba(59,130,246,0.08)]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      {kind === "chat" && <MessageSquare size={14} className="text-blue-600" />}
                      {kind === "status" && <ClipboardCheck size={14} className="text-emerald-600" />}
                      {kind === "rejection" && <ShieldAlert size={14} className="text-rose-600" />}
                      {kind === "other" && <Bell size={14} className="text-slate-500" />}
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{item.type}</span>
                      {requestId && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">MR-{requestId}</span>
                      )}
                      {!item.is_read && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                    </div>
                    <p className="text-sm font-bold leading-relaxed">{item.message}</p>
                    <div className="mt-2 text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                      <Clock3 size={12} />
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 shrink-0 mt-1" />
                </div>

                {kind === "rejection" && isExpanded && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">Rejection Details</p>
                    <p className="text-sm font-semibold text-rose-900">
                      Rejected by: <span className="font-black">{rejection.rejectedBy}</span>
                    </p>
                    <p className="text-sm font-semibold text-rose-900">
                      Reason: <span className="font-bold">{rejection.reason}</span>
                    </p>
                    <p className="text-xs font-semibold text-rose-700">At: {formatDate(rejection.rejectedAt)}</p>
                  </div>
                )}
              </button>
            );
          })}
          {items.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
              <Bell size={28} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No notifications yet.</p>
            </div>
          )}
        </div>
      )}

      {modalRequest && (
        <RequestDetailModal
          request={modalRequest}
          onClose={() => setActiveRequestId(null)}
          initialView={activeView}
        />
      )}
    </div>
  );
}
