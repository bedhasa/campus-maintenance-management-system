"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Clock, Edit2, MessageSquare, Phone, Send, Trash2, X } from "lucide-react";
import { apiRequest, readAuthUser } from "../lib/api";
import StatusBadge from "./StatusBadge";
import { MaintenanceRequest, Priority, TicketStatus } from "../types";

type ApiUser = {
  id: number;
  fname: string;
  lname: string;
  phone?: string | null;
};

type ApiStatusLog = {
  id: number;
  new_status: string;
  comment: string | null;
  created_at: string;
  changed_by?: ApiUser | number | null;
  changedBy?: ApiUser | null;
};

type ApiMessage = {
  id: number;
  sender_id: number;
  message: string;
  created_at: string;
  sender?: ApiUser | null;
};

type ApiRequestDetail = {
  id: number;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "submitted" | "approved" | "assigned" | "in_progress" | "completed" | "rejected" | "closed";
  created_at: string;
  custom_location: string | null;
  category?: { name: string } | null;
  building?: { name: string } | null;
  room?: { name: string } | null;
  asset?: { name: string } | null;
  status_logs?: ApiStatusLog[];
  statusLogs?: ApiStatusLog[];
  messages?: ApiMessage[];
};

type RequestDetailResponse = {
  success: boolean;
  request: ApiRequestDetail;
};

interface RequestDetailModalProps {
  request?: MaintenanceRequest | null;
  requestId?: number | null;
  onClose: () => void;
}

const statusToBadge = (status: ApiRequestDetail["status"]): TicketStatus => {
  switch (status) {
    case "submitted":
      return TicketStatus.PENDING;
    case "approved":
      return TicketStatus.APPROVED;
    case "assigned":
      return TicketStatus.ASSIGNED;
    case "in_progress":
      return TicketStatus.IN_PROGRESS;
    case "completed":
    case "closed":
      return TicketStatus.COMPLETED;
    case "rejected":
      return TicketStatus.REJECTED;
    default:
      return TicketStatus.PENDING;
  }
};

const priorityToBadge = (priority: ApiRequestDetail["priority"]): Priority => {
  switch (priority) {
    case "low":
      return Priority.LOW;
    case "medium":
      return Priority.MEDIUM;
    case "high":
      return Priority.HIGH;
    case "urgent":
      return Priority.CRITICAL;
    default:
      return Priority.MEDIUM;
  }
};

const formatDateTime = (raw?: string | null): string => {
  if (!raw) return "-";
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
};

const fullName = (user?: ApiUser | null): string => {
  if (!user) return "System";
  return `${user.fname ?? ""} ${user.lname ?? ""}`.trim() || "System";
};

const parseRequestId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  const match = value.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const actorFromLog = (log?: ApiStatusLog | null): ApiUser | null => {
  if (!log) return null;
  if (log.changedBy && typeof log.changedBy === "object") return log.changedBy;
  if (log.changed_by && typeof log.changed_by === "object") return log.changed_by;
  return null;
};

const RequestDetailModal: React.FC<RequestDetailModalProps> = ({ request, requestId, onClose }) => {
  const resolvedRequestId = useMemo(() => {
    if (typeof requestId === "number" && Number.isFinite(requestId)) return requestId;
    if (!request) return null;
    return parseRequestId(request.id);
  }, [request, requestId]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApiRequestDetail | null>(null);
  const [tab, setTab] = useState<"details" | "chat">("details");
  const [messageInput, setMessageInput] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [sending, setSending] = useState(false);

  const authUser = readAuthUser<{ id: number }>();

  const statusLogs = useMemo(() => detail?.status_logs ?? detail?.statusLogs ?? [], [detail]);

  const loadDetail = async () => {
    if (!resolvedRequestId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<RequestDetailResponse>(`/api/requester/requests/${resolvedRequestId}`, { method: "GET" }, true);
      setDetail(data.request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load request details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!resolvedRequestId) return;
    loadDetail();
  }, [resolvedRequestId]);

  const assignmentLog = useMemo(
    () => statusLogs.find((log) => log.new_status === "assigned") ?? null,
    [statusLogs]
  );

  const canModifyMessage = (msg: ApiMessage): boolean => {
    if (!authUser || authUser.id !== msg.sender_id) return false;
    const created = new Date(msg.created_at).getTime();
    if (Number.isNaN(created)) return false;
    return Date.now() - created <= 5 * 60 * 1000;
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resolvedRequestId || !messageInput.trim()) return;
    setSending(true);
    try {
      await apiRequest(
        `/api/requester/requests/${resolvedRequestId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: messageInput.trim() }),
        },
        true
      );
      setMessageInput("");
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const startEdit = (msg: ApiMessage) => {
    setEditingId(msg.id);
    setEditText(msg.message);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleSaveEdit = async (messageId: number) => {
    if (!resolvedRequestId || !editText.trim()) return;
    try {
      await apiRequest(
        `/api/requester/requests/${resolvedRequestId}/messages/${messageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: editText.trim() }),
        },
        true
      );
      cancelEdit();
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to edit message.");
    }
  };

  const handleDelete = async (messageId: number) => {
    if (!resolvedRequestId) return;
    try {
      await apiRequest(`/api/requester/requests/${resolvedRequestId}/messages/${messageId}`, { method: "DELETE" }, true);
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete message.");
    }
  };

  if (!resolvedRequestId) return null;

  return (
    <div className="fixed inset-0 z-120 bg-slate-950/60 backdrop-blur-sm p-3 md:p-6 flex items-end md:items-center justify-center">
      <div className="w-full max-w-4xl h-[92vh] md:h-[85vh] bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Request Detail</p>
            <h2 className="text-base font-black text-slate-900 truncate">{detail?.title ?? `MR-${resolvedRequestId}`}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:text-slate-900">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-3 flex items-center gap-2 border-b border-slate-100">
          <button onClick={() => setTab("details")} className={`px-3 py-2 text-xs font-black uppercase tracking-widest ${tab === "details" ? "text-blue-700 border-b-2 border-blue-700" : "text-slate-400"}`}>Details</button>
          <button onClick={() => setTab("chat")} className={`px-3 py-2 text-xs font-black uppercase tracking-widest ${tab === "chat" ? "text-blue-700 border-b-2 border-blue-700" : "text-slate-400"}`}>Chat</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="text-sm text-slate-500">Loading details...</p>}
          {error && <p className="text-sm text-rose-600 font-bold">{error}</p>}

          {!loading && !error && detail && tab === "details" && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/60">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</p>
                  <StatusBadge status={statusToBadge(detail.status)} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 pt-3">Priority</p>
                  <StatusBadge priority={priorityToBadge(detail.priority)} />
                  <p className="text-xs text-slate-700 pt-3">Submitted: {formatDateTime(detail.created_at)}</p>
                </div>
                <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/60">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Assignment</p>
                  <p className="text-sm font-bold text-slate-900">{assignmentLog ? fullName(actorFromLog(assignmentLog)) : "Not assigned yet"}</p>
                  <div className="text-xs text-slate-700 flex items-center gap-2 mt-2">
                    <Phone size={14} />
                    <span>{actorFromLog(assignmentLog)?.phone || "No phone provided"}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-100">
                <p className="text-sm text-slate-900"><span className="font-bold">Title:</span> {detail.title}</p>
                <p className="text-sm text-slate-900 mt-2"><span className="font-bold">Category:</span> {detail.category?.name ?? "-"}</p>
                <p className="text-sm text-slate-900 mt-2"><span className="font-bold">Location:</span> {detail.custom_location || [detail.building?.name, detail.room?.name].filter(Boolean).join(" / ") || "-"}</p>
                <p className="text-sm text-slate-900 mt-2"><span className="font-bold">Asset:</span> {detail.asset?.name ?? "-"}</p>
                <p className="text-sm text-slate-900 mt-2"><span className="font-bold">Description:</span> {detail.description}</p>
              </div>

              <div className="p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Lifecycle Timeline</p>
                <div className="space-y-3">
                  {statusLogs.length === 0 && (
                    <p className="text-xs text-slate-500">No status history yet.</p>
                  )}
                  {statusLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-black text-slate-900 uppercase">{log.new_status.replace("_", " ")}</p>
                      <p className="text-xs text-slate-600 mt-1">By {fullName(actorFromLog(log))} on {formatDateTime(log.created_at)}</p>
                      {log.comment && <p className="text-xs text-slate-600 mt-1">{log.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && !error && detail && tab === "chat" && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-xs font-semibold">
                You can edit or delete only your own chat messages, and only within 5 minutes after sending.
              </div>
              {(detail.messages ?? []).length === 0 && (
                <p className="text-xs text-slate-500">No messages yet.</p>
              )}
              {(detail.messages ?? []).map((msg) => {
                const mine = authUser?.id === msg.sender_id;
                const canEdit = canModifyMessage(msg);
                return (
                  <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${mine ? "bg-[#003366] text-white" : "bg-slate-100 text-slate-900 border border-slate-200"}`}>
                      <p className="text-xs font-black mb-1">{fullName(msg.sender)}</p>
                      {editingId === msg.id ? (
                        <div className="space-y-2">
                          <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full rounded-lg p-2 text-sm text-slate-900" />
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={cancelEdit} className="px-2 py-1 rounded bg-slate-200 text-slate-900"><X size={14} /></button>
                            <button type="button" onClick={() => handleSaveEdit(msg.id)} className="px-2 py-1 rounded bg-emerald-600 text-white"><Check size={14} /></button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      )}
                      <p className={`text-[10px] mt-2 flex items-center gap-1 ${mine ? "text-blue-100" : "text-slate-500"}`}>
                        <Clock size={10} />
                        {formatDateTime(msg.created_at)}
                      </p>
                      {canEdit && editingId !== msg.id && (
                        <div className="mt-2 flex justify-end gap-2">
                          <button type="button" onClick={() => startEdit(msg)} className="p-1.5 rounded bg-white/20 hover:bg-white/30"><Edit2 size={12} /></button>
                          <button type="button" onClick={() => handleDelete(msg.id)} className="p-1.5 rounded bg-white/20 hover:bg-white/30"><Trash2 size={12} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {tab === "chat" && (
          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 flex items-center gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button type="submit" disabled={sending || !messageInput.trim()} className="px-4 py-3 rounded-xl bg-[#003366] text-white disabled:opacity-40">
              <Send size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default RequestDetailModal;
