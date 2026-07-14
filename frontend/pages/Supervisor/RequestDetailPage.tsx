"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { buildStorageUrl } from "@/lib/runtime-config";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { buildRequestRealtimeTopics, buildWorkOrderRealtimeTopics, emitRealtimeTopics } from "@/lib/realtime";
import { 
  X, ChevronLeft, ChevronRight, MapPin, Tag, Box, 
  Calendar, Clock, User, MessageSquare, Send, 
  Trash2, Edit3, ShieldCheck, CheckCircle2, AlertCircle,
  HardHat, Phone, Mail, Hash, Layers, Search
} from "lucide-react";

interface Props { id: string; initialTab?: "details" | "chat"; }

type RequestDetail = {
  id: number; title: string; description: string; status: string; priority: string; created_at: string;
  due_date?: string | null;
  category_id?: number | null; custom_location?: string | null;
  requester?: { id?: number; fname?: string; lname?: string; phone?: string; email?: string; profile_picture_url?: string | null };
  category?: { id?: number; name?: string }; building?: { name?: string }; room?: { name?: string }; asset?: { name?: string };
  status_logs?: Array<{
    id: number;
    old_status?: string | null;
    new_status: string;
    comment?: string | null;
    created_at: string;
    changedBy?: { fname?: string; lname?: string } | null;
    changed_by?: { fname?: string; lname?: string } | number | null;
  }>;
  messages?: Array<{ id: number; message: string; created_at: string; edited_at?: string | null; sender?: { id?: number; fname?: string; lname?: string }; }>;
  images?: Array<{ id: number; image_path: string }>;
  work_orders?: Array<{
    id: number;
    work_status: string;
    assignee?: { fname?: string; lname?: string; phone?: string; email?: string; profile_picture_url?: string | null } | null;
  }>;
};

type TechnicianOption = {
  id: number;
  fname?: string;
  lname?: string;
  phone?: string;
  email?: string;
  profile_picture_url?: string | null;
  open_workload?: number;
  availability?: boolean;
  specialties?: Array<{ id: number; name?: string; category_id?: number }>;
};

const statusColors: Record<string, string> = {
  submitted: "bg-amber-500", approved: "bg-cyan-600", assigned: "bg-blue-600",
  in_progress: "bg-orange-500",
  completed: "bg-emerald-600", closed: "bg-slate-900", rejected: "bg-rose-600",
};

export default function RequestDetailPage({ id, initialTab = "details" }: Props) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "chat">(initialTab);
  const [newMessage, setNewMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [techSearch, setTechSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [finishDate, setFinishDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [scheduledEndTime, setScheduledEndTime] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("medium");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const res = await apiRequest<{ success: boolean; request: RequestDetail }>(`/api/supervisor/requests/${id}`, { method: "GET" }, true);
    setDetail(res.request);
  }, [id]);

  useEffect(() => {
    load();
    const loadUser = async () => {
      try {
        const data = await apiRequest<{ success: boolean; user: { id: number } }>("/api/user", { method: "GET" }, true);
        setCurrentUserId(data.user?.id ?? null);
      } catch { setCurrentUserId(null); }
    };
    void loadUser();
  }, [id, load]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, id]);

  useEffect(() => {
    if (chatRef.current && activeTab === "chat") {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [detail?.messages, activeTab]);

  const realtimeTopics = useMemo(() => {
    const requestId = detail?.id ?? id;
    const latestWorkOrderId = detail?.work_orders?.[0]?.id;
    return [
      ...buildRequestRealtimeTopics(requestId),
      ...buildWorkOrderRealtimeTopics(latestWorkOrderId, requestId),
    ];
  }, [detail?.id, detail?.work_orders, id]);

  useLiveRefresh(load, {
    enabled: true,
    topics: realtimeTopics,
    refreshOnFocus: false,
  });

  const chatLocked = useMemo(() => detail?.status === "closed", [detail?.status]);
  const latestWorkOrder = useMemo(() => (detail?.work_orders ?? [])[0], [detail?.work_orders]);
  const assignee = latestWorkOrder?.assignee ?? null;
  const isAssigned = Boolean(assignee);
  const filteredTechnicians = useMemo(() => {
    const query = techSearch.trim().toLowerCase();
    const matched = !query ? technicians : technicians.filter((tech) => {
      const fullName = `${tech.fname ?? ""} ${tech.lname ?? ""}`.trim().toLowerCase();
      const phone = (tech.phone ?? "").toLowerCase();
      const email = (tech.email ?? "").toLowerCase();
      const specialties = (tech.specialties ?? []).map((s) => s.name ?? "").join(" ").toLowerCase();
      return fullName.includes(query) || phone.includes(query) || email.includes(query) || specialties.includes(query);
    });
    return [...matched].sort((a, b) => Number(a.open_workload ?? 0) - Number(b.open_workload ?? 0));
  }, [techSearch, technicians]);

  const getTechnicianState = (tech: TechnicianOption) => {
    const workload = Number(tech.open_workload ?? 0);
    if (workload === 0) {
      return { label: "Free", badgeClass: "bg-emerald-100 text-emerald-700" };
    }
    if (tech.availability === false) {
      return { label: "Busy", badgeClass: "bg-amber-100 text-amber-700" };
    }
    return { label: `${workload} active`, badgeClass: "bg-blue-100 text-blue-700" };
  };

  const timelineEvents = useMemo(() => {
    if (!detail) return [];
    const logs = [...(detail.status_logs ?? [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const submittedBy = `${detail.requester?.fname ?? ""} ${detail.requester?.lname ?? ""}`.trim() || "Requester";
    const hasSubmittedLog = logs.some((l) => l.new_status === "submitted");
    const submittedEvent = hasSubmittedLog ? [] : [{
      id: -1,
      new_status: "submitted",
      created_at: detail.created_at,
      actor: submittedBy,
      comment: "Request submitted.",
    }];
    const mapped = logs.map((log) => {
      const fallbackActorObj = typeof log.changed_by === "object" ? log.changed_by : null;
      const actor = `${log.changedBy?.fname ?? fallbackActorObj?.fname ?? ""} ${log.changedBy?.lname ?? fallbackActorObj?.lname ?? ""}`.trim() || "System";
      return {
        id: log.id,
        new_status: log.new_status,
        created_at: log.created_at,
        actor,
        comment: log.comment ?? "",
      };
    });
    return [...submittedEvent, ...mapped];
  }, [detail]);

  const formatLocalDateTime = (value?: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };

  const resolveImage = (path?: string | null) => {
    return buildStorageUrl(path);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || chatLocked) return;
    await apiRequest(`/api/supervisor/requests/${id}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: newMessage }),
    }, true);
    setNewMessage("");
    emitRealtimeTopics(buildRequestRealtimeTopics(id), { requestId: id, action: "message.created" });
    await load();
  };

  const updateMessage = async (messageId: number) => {
    if (!editingText.trim() || chatLocked) return;
    await apiRequest(`/api/supervisor/requests/${id}/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: editingText.trim() }),
    }, true);
    setEditingId(null);
    setEditingText("");
    emitRealtimeTopics(buildRequestRealtimeTopics(id), { requestId: id, action: "message.updated" });
    await load();
  };

  const deleteMessage = async (messageId: number) => {
    if (chatLocked) return;
    const confirmed = window.confirm("Delete this message?");
    if (!confirmed) return;
    await apiRequest(`/api/supervisor/requests/${id}/messages/${messageId}`, { method: "DELETE" }, true);
    emitRealtimeTopics(buildRequestRealtimeTopics(id), { requestId: id, action: "message.deleted" });
    await load();
  };

  const review = async (action: "approve" | "reject") => {
    const comment = action === "reject" ? window.prompt("Enter the rejection reason for the requester:") : undefined;
    if (action === "reject" && !comment?.trim()) {
      setAssignError("A rejection reason is required.");
      return;
    }
    try {
      setReviewing(true);
      setAssignError(null);
      await apiRequest(`/api/supervisor/requests/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment?.trim() || undefined }),
      }, true);
      emitRealtimeTopics(buildRequestRealtimeTopics(id), { requestId: id, action: `review.${action}` });
      await load();
    } finally { setReviewing(false); }
  };

  const undoReview = async () => {
    try {
      setReviewing(true);
      setAssignError(null);
      await apiRequest(`/api/supervisor/requests/${id}/review/undo`, { method: "PATCH" }, true);
      emitRealtimeTopics(buildRequestRealtimeTopics(id), { requestId: id, action: "review.undo" });
      await load();
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Failed to undo review.");
    } finally { setReviewing(false); }
  };

  const openAssign = async () => {
    const resolvedCategoryId = detail?.category_id ?? detail?.category?.id ?? null;
    const isOtherCategory = !resolvedCategoryId;
    try {
      setAssignLoading(true);
      setAssignError(null);
      const all = await apiRequest<{ success: boolean; technicians: TechnicianOption[] }>(
        isOtherCategory
          ? `/api/supervisor/technicians/by-category?all=1`
          : `/api/supervisor/technicians/by-category?category_id=${resolvedCategoryId}`,
        { method: "GET" },
        true
      );
      const techs = all.technicians ?? [];
      setTechnicians(techs);
      setSelectedTechId(techs[0]?.id ? String(techs[0].id) : "");
      setTechSearch("");
      setStartDate("");
      setFinishDate("");
      setScheduledStartTime("");
      setScheduledEndTime("");
      setScheduleNote("");
      setDueDate(detail?.due_date ? detail.due_date.slice(0, 10) : "");
      setSelectedPriority(detail?.priority ?? "medium");
      if (techs.length === 0) setAssignError(isOtherCategory ? "No technicians found." : "No technicians found for this category.");
      setAssignOpen(true);
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Failed to load technicians.");
      setAssignOpen(true);
    } finally { setAssignLoading(false); }
  };

  const assignTechnician = async () => {
    if (!selectedTechId) {
      setAssignError("Select technician.");
      return;
    }
    try {
      setAssigning(true);
      setAssignError(null);
      await apiRequest(`/api/supervisor/requests/${id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_to: Number(selectedTechId),
          start_date: startDate || null,
          finish_date: finishDate || null,
          due_date: dueDate || null,
          scheduled_start_date: startDate || null,
          scheduled_end_date: finishDate || null,
          scheduled_start_time: scheduledStartTime || null,
          scheduled_end_time: scheduledEndTime || null,
          schedule_note: scheduleNote || null,
          priority: selectedPriority || null,
        }),
      }, true);
      emitRealtimeTopics([
        ...buildRequestRealtimeTopics(id),
        ...buildWorkOrderRealtimeTopics(undefined, id),
      ], { requestId: id, action: "assign" });
      setAssignOpen(false);
      await load();
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Failed to assign technician.");
    } finally { setAssigning(false); }
  };

  const updateLifecycle = async (action: "close" | "reopen") => {
    try {
      setLifecycleBusy(true);
      setAssignError(null);
      await apiRequest(`/api/supervisor/requests/${id}/${action}`, { method: "PATCH" }, true);
      emitRealtimeTopics(buildRequestRealtimeTopics(id), { requestId: id, action });
      await load();
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : `Failed to ${action} request.`);
    } finally { setLifecycleBusy(false); }
  };

  if (!detail) return <div className="h-screen flex items-center justify-center font-black text-slate-400 animate-pulse">LOADING...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4 animate-in fade-in duration-300 overflow-y-auto max-h-[100vh] scrollbar-hide">
      
      {/* SECTION 1: TOP HEADER & CONTROLS */}
      <div className="bg-white rounded-[1.75rem] border border-slate-100 p-5 md:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-4 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-[0.2em] ${statusColors[detail.status]}`}>
                {detail.status}
              </span>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1">
                <Hash size={12}/> {detail.id}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">{detail.title}</h1>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            <button 
              onClick={() => setActiveTab("details")}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "details" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Details
            </button>
            <button 
              onClick={() => setActiveTab("chat")}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "chat" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Chat Loop
            </button>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-12 gap-4">
        
        {/* SECTION 2: CONTENT AREA (Dynamic based on Tab) */}
        <div className="xl:col-span-8">
          {activeTab === "details" ? (
            <div className="space-y-4 animate-in slide-in-from-left-4 duration-300">
              
              {/* PRIMARY DETAILS */}
              <div className="bg-white rounded-[2rem] border border-slate-100 p-5 md:p-6 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                  <Layers size={16} /> Technical Specs
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-3xl bg-slate-50/50 border border-slate-100 sm:col-span-2">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <MapPin size={12}/> Location
                    </p>
                    {detail.building?.name || detail.room?.name ? (
                      <p className="text-sm font-black text-slate-800">
                        Building: {detail.building?.name || "-"} | Room: {detail.room?.name || "-"}
                      </p>
                    ) : (
                      <p className="text-sm font-black text-slate-800">
                        Custom Location: {detail.custom_location || "-"}
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-3xl bg-slate-50/50 border border-slate-100">
                    <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Tag size={12}/> Category
                    </p>
                    <p className="text-sm font-black text-slate-800">{detail.category?.name || "General"}</p>
                  </div>
                  <div className="p-4 rounded-3xl bg-slate-50/50 border border-slate-100">
                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Box size={12}/> Linked Asset
                    </p>
                    <p className="text-sm font-black text-slate-800">{detail.asset?.name || "No Asset"}</p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Problem Description</p>
                  <p className="text-sm text-slate-700 leading-relaxed bg-white border border-slate-100 p-4 rounded-3xl whitespace-pre-wrap">{detail.description}</p>
                </div>
              </div>

              {/* IMAGES */}
              <div className="bg-white rounded-[2rem] border border-slate-100 p-5 md:p-6 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                  <MessageSquare size={16} /> Visual Attachments
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {detail.images?.map((img, idx) => (
                    <button key={img.id} onClick={() => setPreviewIndex(idx)} className="relative group shrink-0">
                      <img src={resolveImage(img.image_path)} className="w-32 h-32 object-cover rounded-[1.5rem] border border-slate-100 group-hover:scale-105 transition-transform" alt="request evidence" />
                    </button>
                  ))}
                  {(!detail.images || detail.images.length === 0) && <p className="text-xs text-slate-400 italic py-8">No images provided for this request.</p>}
                </div>
              </div>

              {/* TIMELINE / LIFE LOGS */}
              <div className="bg-white rounded-[2rem] border border-slate-100 p-5 md:p-6 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                  <Clock size={16} /> Status Timeline
                </h3>
                <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-6">
                  {timelineEvents.map((event, index) => (
                    <div key={index} className="relative group">
                      <div className={`absolute -left-[22px] top-0.5 w-3 h-3 rounded-full border-2 border-white ${statusColors[event.new_status] || "bg-slate-400"}`} />
                      <div className="text-xs">
                        <span className="font-black text-slate-800 uppercase tracking-wide">{event.new_status}</span>
                        <span className="text-slate-400 font-medium ml-2">{formatLocalDateTime(event.created_at)}</span>
                      </div>
                      <p className="text-xs text-slate-500 font-bold mt-0.5">By: {event.actor}</p>
                      {event.comment && <p className="text-xs text-slate-600 italic bg-slate-50/50 border border-slate-100 rounded-xl p-2.5 mt-2 max-w-md">{event.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* CHAT SECTION */
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col min-h-[520px] max-h-[72vh] overflow-hidden animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Request Conversation</h3>
                  <p className="text-xs text-slate-500">Keep updates on this request in one place.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {(detail.messages ?? []).length} messages
                </span>
              </div>
              <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 md:px-5 space-y-4 bg-slate-50/30">
                {detail.messages?.map((m) => {
                  const isMe = m.sender?.id === currentUserId;
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[88%] ${isMe ? "items-end text-right" : "items-start text-left"}`}>
                        <div className="flex items-center gap-2 mb-1 px-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{m.sender?.fname}</span>
                          <span className="text-[8px] font-bold text-slate-300">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {editingId === m.id ? (
                          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="w-full min-h-[72px] rounded-xl border border-slate-200 p-2 text-sm text-slate-800 outline-none"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => { setEditingId(null); setEditingText(""); }}
                                className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-black uppercase text-slate-600"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => void updateMessage(m.id)}
                                className="rounded-lg bg-white border border-slate-200 text-[#003366] px-2.5 py-1.5 text-[10px] font-black uppercase"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${isMe ? "bg-[#003366] text-white rounded-tr-none" : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"}`}>
                            {m.message}
                          </div>
                        )}
                        {isMe && editingId !== m.id && !chatLocked && (
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <button
                              onClick={() => { setEditingId(m.id); setEditingText(m.message); }}
                              className="rounded-lg bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={() => void deleteMessage(m.id)}
                              className="rounded-lg bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!detail.messages || detail.messages.length === 0) && (
                  <div className="flex h-full min-h-[240px] items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-white/70 p-6 text-center">
                    <div>
                      <p className="text-sm font-black text-slate-700">No messages yet</p>
                      <p className="text-xs text-slate-500 mt-1">Start the conversation here.</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 bg-white border-t border-slate-100">
                <div className="relative group">
                  <textarea 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={chatLocked}
                    placeholder={chatLocked ? "Thread Locked" : "Type your message..."} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-[1.25rem] p-4 pr-14 text-sm min-h-[68px] max-h-36 focus:ring-2 focus:ring-[#003366]/10 focus:border-[#003366]/30 outline-none resize-none text-slate-900 placeholder:text-slate-400"
                  />
                  <button onClick={sendMessage} disabled={chatLocked || !newMessage.trim()} className="absolute bottom-3 right-3 p-3 bg-[#003366] text-white rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-30">
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: SIDEBAR (Persistent Info) */}
        <div className="xl:col-span-4 space-y-4">
          
          {/* Action Hub */}
          <div className="bg-[#003366] rounded-[2rem] p-5 md:p-6 text-white shadow-xl shadow-blue-900/20">
            <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 opacity-60 flex items-center gap-2">
              <ShieldCheck size={16}/> Management Hub
            </h3>
            <div className="space-y-3">
              {detail.status === "submitted" && (
                <div className="grid grid-cols-2 gap-3">
                  <button disabled={reviewing} onClick={() => review("approve")} className="bg-emerald-500 hover:bg-emerald-600 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg shadow-emerald-900/40 disabled:opacity-50">Approve</button>
                  <button disabled={reviewing} onClick={() => review("reject")} className="bg-rose-500 hover:bg-rose-600 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg shadow-rose-900/40 disabled:opacity-50">Reject</button>
                </div>
              )}
              {!isAssigned && detail.status === "approved" && (
                <button onClick={openAssign} className="w-full bg-white text-[#003366] py-3 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 hover:bg-blue-50">
                  <HardHat size={14}/> Assign Technician
                </button>
              )}
              {isAssigned && ["assigned", "in_progress"].includes(detail.status) && (
                <button onClick={openAssign} className="w-full bg-white text-[#003366] py-3 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 hover:bg-blue-50">
                  <HardHat size={14}/> Reassign Technician
                </button>
              )}
              {(detail.status === "approved" || detail.status === "rejected") && (
                <button
                  disabled={reviewing}
                  onClick={undoReview}
                  className="w-full bg-amber-500 hover:bg-amber-600 py-3 rounded-2xl text-[10px] font-black uppercase transition-all disabled:opacity-50"
                >
                  Undo Review
                </button>
              )}
              {detail.status === "completed" && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-200">Final Closure</p>
                    <p className="mt-2 text-xs font-bold text-white/90">
                      This request was completed by the technician. Final close or reopen action can be performed here.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button disabled={lifecycleBusy} onClick={() => updateLifecycle("close")} className="bg-emerald-500 hover:bg-emerald-600 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg shadow-emerald-900/40 disabled:opacity-50">
                      Close Request
                    </button>
                    <button disabled={lifecycleBusy} onClick={() => updateLifecycle("reopen")} className="bg-amber-500 hover:bg-amber-600 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg shadow-amber-900/30 disabled:opacity-50">
                      Reopen Task
                    </button>
                  </div>
                </div>
              )}
              {isAssigned && (
                <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-200 mb-1">Assigned To</p>
                  <p className="text-xs font-black text-white">{assignee?.fname} {assignee?.lname}</p>
                  <p className="text-[11px] text-blue-100">{assignee?.phone || "-"}</p>
                  <p className="text-[11px] text-blue-100 break-all">{assignee?.email || "-"}</p>
                </div>
              )}
              {assignError && (
                <p className="text-xs font-bold text-rose-200">{assignError}</p>
              )}
              <div className="pt-4 border-t border-white/10 mt-4">
                <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60">
                  <span>Priority Level</span>
                  <span className={detail.priority === "urgent" ? "text-rose-400" : "text-blue-300"}>{detail.priority}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Requester Contact */}
          <div className="bg-white rounded-[2rem] border border-slate-100 p-5 md:p-6 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <User size={16}/> Requester
            </h3>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-lg font-black text-[#003366]">
                {detail.requester?.profile_picture_url ? (
                  <img src={detail.requester.profile_picture_url} alt="Requester" className="w-full h-full object-cover rounded-2xl" />
                ) : detail.requester?.fname?.[0] || "?"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 truncate">{detail.requester?.fname} {detail.requester?.lname}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requester Info</p>
              </div>
            </div>
            <div className="space-y-2">
              <a href={`tel:${detail.requester?.phone}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 text-xs font-bold hover:bg-blue-50 transition-all">
                <Phone size={14} className="text-blue-500" /> {detail.requester?.phone || "No Phone"}
              </a>
              <a href={`mailto:${detail.requester?.email}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 text-xs font-bold hover:bg-blue-50 transition-all break-all">
                <Mail size={14} className="text-purple-500" /> {detail.requester?.email || "No Email"}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* POPUP MODAL FIX: Added overflow scroll safeguards and capped operational heights */}
      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.25rem] border border-slate-100 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-lg font-black text-slate-900">Work Order Dispatch</h2>
                <p className="text-xs text-slate-400">Deploy technical personnel to task assignments.</p>
              </div>
              <button onClick={() => setAssignOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-xl transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 scrollbar-hide">
              {assignLoading ? (
                <div className="py-12 text-center text-xs font-black text-slate-400 tracking-widest animate-pulse">
                  FETCHING COMPATIBLE TECHNICIANS...
                </div>
              ) : (
                <>
                  {/* Technician Selection Block */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Technical Expert</label>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="Search technicians or specialties..." 
                        value={techSearch} 
                        onChange={(e) => setTechSearch(e.target.value)} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-[#003366]/10"
                      />
                    </div>

                    <div className="border border-slate-100 rounded-2xl max-h-44 overflow-y-auto bg-slate-50/50 p-1 space-y-1">
                      {filteredTechnicians.map((tech) => {
                        const state = getTechnicianState(tech);
                        const isSelected = selectedTechId === String(tech.id);
                        return (
                          <button
                            key={tech.id}
                            type="button"
                            onClick={() => setSelectedTechId(String(tech.id))}
                            className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${isSelected ? "bg-white border border-slate-200 shadow-sm" : "hover:bg-white/60"}`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-800">{tech.fname} {tech.lname}</p>
                              <p className="text-[10px] font-medium text-slate-400 truncate">
                                {(tech.specialties ?? []).map((s) => s.name).join(", ") || "General Repairs"}
                              </p>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${state.badgeClass}`}>
                              {state.label}
                            </span>
                          </button>
                        );
                      })}
                      {filteredTechnicians.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-6 italic">No technicians match search criteria.</p>
                      )}
                    </div>
                  </div>

                  {/* Operational Settings Fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Due Date</label>
                      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Task Priority</label>
                      <select value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none">
                        <option value="low">Low Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="high">High Priority</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</label>
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Finish Date</label>
                      <input type="date" value={finishDate} onChange={(e) => setFinishDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Time</label>
                      <input type="time" value={scheduledStartTime} onChange={(e) => setScheduledStartTime(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Time</label>
                      <input type="time" value={scheduledEndTime} onChange={(e) => setScheduledEndTime(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none" />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Schedule Note</label>
                      <textarea value={scheduleNote} onChange={(e) => setScheduleNote(e.target.value)} className="w-full min-h-[72px] bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none" placeholder="Optional instructions for visit or access" />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 shrink-0 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setAssignOpen(false)} className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-xs font-black uppercase text-slate-600 transition-all">
                Cancel
              </button>
              <button type="button" disabled={assigning || assignLoading || !selectedTechId} onClick={assignTechnician} className="px-6 py-3 rounded-xl bg-[#003366] text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-900/20 transition-all disabled:opacity-40">
                {assigning ? "Assigning..." : "Confirm Assignment"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Image Preview Overlay Section */}
      {previewIndex !== null && detail.images?.[previewIndex] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <button onClick={() => setPreviewIndex(null)} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all">
            <X size={20} />
          </button>
          <img src={resolveImage(detail.images[previewIndex].image_path)} className="max-w-full max-h-[85vh] object-contain rounded-lg" alt="Attachment High Resolution Preview" />
        </div>
      )}

    </div>
  );
}