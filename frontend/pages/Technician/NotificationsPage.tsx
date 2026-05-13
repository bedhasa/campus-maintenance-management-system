"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, ChevronRight, MessageSquare, ShieldAlert, ClipboardCheck, Clock3 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ListSkeleton } from "@/components/PageSkeleton";
import { useRouter } from "next/navigation";

type NotificationItem = {
  id: number;
  message: string;
  type: string;
  module?: string | null;
  related_id?: number | null;
  is_read: boolean;
  created_at: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parsed);
};

const detectKind = (item: NotificationItem): "chat" | "status" | "warning" | "other" => {
  const text = `${item.type} ${item.message}`.toLowerCase();
  if (text.includes("chat") || text.includes("message")) return "chat";
  if (text.includes("assigned") || text.includes("started") || text.includes("paused") || text.includes("completed")) return "status";
  if (text.includes("delay") || text.includes("overdue") || text.includes("alert")) return "warning";
  return "other";
};

export default function TechnicianNotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ success: boolean; notifications: { data: NotificationItem[] } }>(
        "/api/me/notifications",
        { method: "GET" },
        true
      );
      setItems(data.notifications?.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const unreadCount = useMemo(() => items.filter((item) => !item.is_read).length, [items]);

  const markRead = async (id: number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    await apiRequest(`/api/me/notifications/${id}/read`, { method: "PATCH" }, true).catch(() => {});
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    await apiRequest("/api/me/notifications/read-all", { method: "POST" }, true).catch(() => {});
  };

  const resolveRelatedId = (item: NotificationItem): number | null => {
    if (item.related_id) return Number(item.related_id);
    const match = item.message.match(/(?:#|WO-|REQ-)(\d+)/i);
    return match ? Number(match[1]) : null;
  };

  const openRelatedAction = async (item: NotificationItem) => {
    if (!item.is_read) {
      await markRead(item.id);
    }

    const relatedId = resolveRelatedId(item);
    if (!relatedId) {
      router.push("/technician/tasks");
      return;
    }

    const text = `${item.type} ${item.message} ${item.module ?? ""}`.toLowerCase();
    const isWorkOrderLike =
      text.includes("work_order") ||
      text.includes("work order") ||
      text.includes("assigned") ||
      text.includes("reassigned") ||
      text.includes("paused") ||
      text.includes("started") ||
      text.includes("delay") ||
      text.includes("completed");

    if (isWorkOrderLike) {
      router.push(`/technician/work-orders/${relatedId}`);
      return;
    }

    router.push("/technician/tasks");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
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
          onClick={() => void markAllRead()}
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-200"
        >
          <CheckCheck size={14} /> Clear All
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : items.length === 0 ? (
        <div className="rounded-[2rem] border-2 border-dashed border-slate-200 bg-white px-6 py-20 text-center">
          <p className="text-sm font-black uppercase tracking-widest text-slate-700">No notifications yet</p>
          <p className="mt-2 text-sm font-medium text-slate-500">Assignments and supervisor updates will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const kind = detectKind(item);
            const config = {
              chat: { icon: <MessageSquare size={16} />, color: "text-blue-600", bg: "bg-blue-50/80", border: "border-blue-200" },
              status: { icon: <ClipboardCheck size={16} />, color: "text-emerald-600", bg: "bg-emerald-50/80", border: "border-emerald-200" },
              warning: { icon: <ShieldAlert size={16} />, color: "text-rose-600", bg: "bg-rose-50/80", border: "border-rose-200" },
              other: { icon: <Bell size={16} />, color: "text-slate-600", bg: "bg-slate-50/80", border: "border-slate-200" },
            }[kind];

            return (
              <button
                key={item.id}
                onClick={() => void openRelatedAction(item)}
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
                      {!item.is_read && <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />}
                    </div>

                    <p className={`text-base leading-tight text-slate-900 ${item.is_read ? "font-semibold opacity-90" : "font-black"}`}>
                      {item.message}
                    </p>

                    <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                      <Clock3 size={12} /> {formatDate(item.created_at)}
                    </div>
                  </div>

                  <ChevronRight size={20} className="text-slate-400 mt-2 group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
