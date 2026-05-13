"use client";

import { useMemo, useState, useEffect } from "react";
import { 
  Bell, CheckCheck, ChevronRight, MessageSquare, 
  ShieldAlert, ClipboardCheck, Clock3, Inbox
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import RequestDetailModal from "@/components/RequestDetailModal";
import { ListSkeleton } from "@/components/PageSkeleton";
import { MaintenanceRequest, Priority, TicketStatus } from "@/types";

// --- TYPES ---
type NotificationItem = {
  id: number;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  related_id?: number | null;
  request_id?: number | null;
  request?: { id?: number | null } | null;
  data?: any;
  metadata?: any;
  meta?: any;
  rejected_by_name?: string | null;
  rejection_reason?: string | null;
};

type NotificationResponse = {
  success: boolean;
  notifications: { data: NotificationItem[] };
};

// --- HELPER LOGIC ---

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(parsed);
};

const getRequestId = (item: NotificationItem): number | null => {
  const direct = item.related_id ?? item.request_id ?? item.request?.id;
  if (direct) return Number(direct);
  const nested = item.data?.request_id ?? item.metadata?.request_id ?? item.meta?.request_id;
  if (nested) return Number(nested);
  const match = item.message.match(/(?:MR[-#\s]?|request\s*#?\s*)(\d+)/i);
  return match ? Number(match[1]) : null;
};

const detectKind = (item: NotificationItem): "chat" | "rejection" | "status" | "feedback" | "other" => {
  const text = `${item.type} ${item.message}`.toLowerCase();
  if (text.includes("chat") || text.includes("message")) return "chat";
  if (text.includes("rejected") || text.includes("rejection")) return "rejection";
  if (text.includes("feedback") || text.includes("survey") || text.includes("rate")) return "feedback";
  if (/submitted|approved|assigned|in_progress|completed|closed/.test(text)) return "status";
  return "other";
};

const getRejectionInfo = (item: NotificationItem) => ({
  rejectedBy: item.rejected_by_name ?? item.data?.rejected_by_name ?? "Supervisor",
  reason: item.rejection_reason ?? item.data?.rejection_reason ?? "No reason provided.",
  rejectedAt: item.data?.rejected_at ?? item.created_at,
});

// --- MAIN COMPONENT ---

export default function RoutePage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"info" | "chat">("info");
  const [expandedRejectionId, setExpandedRejectionId] = useState<number | null>(null);

  const unreadCount = useMemo(() => items.filter((i) => !i.is_read).length, [items]);

  const modalRequest = useMemo<MaintenanceRequest | null>(() => {
    if (!activeRequestId) return null;
    return {
      id: String(activeRequestId), title: `Maintenance Request #${activeRequestId}`,
      requesterId: "", requesterName: "", department: "", location: "", problemType: "",
      urgency: Priority.MEDIUM, description: "", status: TicketStatus.PENDING,
      createdAt: "", updatedAt: "",
    };
  }, [activeRequestId]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<NotificationResponse>("/api/requester/notifications", { method: "GET" }, true);
      setItems(data.notifications?.data ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onNotificationClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_read: true } : i));
      await apiRequest(`/api/requester/notifications/${item.id}/read`, { method: "PATCH" }, true).catch(() => {});
    }
    const kind = detectKind(item);
    const requestId = getRequestId(item);
    if (kind === "rejection") setExpandedRejectionId(prev => (prev === item.id ? null : item.id));
    if (requestId) { setActiveRequestId(requestId); setActiveView(kind === "chat" ? "chat" : "info"); }
  };

  const markAllRead = async () => {
    setItems(prev => prev.map(i => ({ ...i, is_read: true })));
    await apiRequest("/api/requester/notifications/read-all", { method: "POST" }, true).catch(() => {});
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <Bell className="text-blue-600" size={24} /> Inbox
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
            {unreadCount} Unread Alerts
          </p>
        </div>
        <button
          onClick={markAllRead}
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-200"
        >
          <CheckCheck size={14} /> Clear All
        </button>
      </div>

      {loading && <ListSkeleton rows={5} />}

      {/* List */}
      {!loading && !error && (
        <div className="space-y-4">
          {items.map((item) => {
            const kind = detectKind(item);
            const requestId = getRequestId(item);
            const isExpanded = expandedRejectionId === item.id;
            const rejection = getRejectionInfo(item);

            const config = {
              chat: { icon: <MessageSquare size={16} />, color: "text-blue-600", bg: "bg-blue-50/80", border: "border-blue-200" },
              status: { icon: <ClipboardCheck size={16} />, color: "text-emerald-600", bg: "bg-emerald-50/80", border: "border-emerald-200" },
              rejection: { icon: <ShieldAlert size={16} />, color: "text-rose-600", bg: "bg-rose-50/80", border: "border-rose-200" },
              other: { icon: <Bell size={16} />, color: "text-slate-600", bg: "bg-slate-50/80", border: "border-slate-200" },
              feedback: { icon: <Bell size={16} />, color: "text-amber-600", bg: "bg-amber-50/80", border: "border-amber-200" },
            }[kind];

            return (
              <button
                key={item.id}
                onClick={() => onNotificationClick(item)}
                className={`w-full group text-left p-6 rounded-[2rem] border transition-all duration-300 ${
                  item.is_read 
                    ? "bg-white border-slate-100 shadow-none" 
                    : `${config.bg} ${config.border} shadow-lg shadow-slate-100`
                } hover:border-slate-300`}
              >
                <div className="flex items-start gap-5">
                  <div className={`p-3 rounded-2xl bg-white shadow-sm border border-slate-50 ${config.color}`}>
                    {config.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${config.color}`}>
                        {item.type}
                      </span>
                      {requestId && (
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          REF: {requestId}
                        </span>
                      )}
                      {!item.is_read && (
                        <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                      )}
                    </div>

                    {/* MAIN MESSAGE TEXT - HIGH VISIBILITY */}
                    <p className={`text-base leading-tight text-slate-900 ${item.is_read ? 'font-semibold opacity-90' : 'font-black'}`}>
                      {item.message}
                    </p>

                    <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                      <Clock3 size={12} /> {formatDate(item.created_at)}
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-400 mt-2 group-hover:translate-x-1 transition-all" />
                </div>

                {kind === "rejection" && isExpanded && (
                  <div className="mt-5 p-5 rounded-2xl bg-white border border-rose-200 animate-in slide-in-from-top-2 shadow-inner">
                    <p className="text-[10px] font-black text-rose-600 uppercase mb-2">Detailed Reason</p>
                    <p className="text-sm text-slate-800 font-bold italic leading-relaxed">"{rejection.reason}"</p>
                    <p className="mt-3 text-[10px] font-black text-slate-400 border-t border-slate-50 pt-2">— Reviewer: {rejection.rejectedBy}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {modalRequest && (
        <RequestDetailModal
          request={modalRequest}
          initialView={activeView}
          onClose={() => {
            setActiveRequestId(null);
            setActiveView("info");
          }}
        />
      )}
    </div>
  );
}
