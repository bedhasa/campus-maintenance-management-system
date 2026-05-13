"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { 
  X, ChevronLeft, ChevronRight, MapPin, Tag, Box, 
  Calendar, Clock, User, MessageSquare, Send, 
  Trash2, Edit3, ShieldCheck, CheckCircle2, AlertCircle,
  HardHat, Phone, Mail, Hash, Layers, Building2, DoorOpen
} from "lucide-react";

interface Props { id: string; initialTab?: "details" | "chat"; }

// Types (Restricted to your provided structure)
type RequestDetail = {
  id: number; title: string; description: string; status: string; priority: string; created_at: string;
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
  const [scheduledTime, setScheduledTime] = useState("");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

  // Logic Endpoints (Untouched as per instructions)
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
      return {
        label: "Free",
        badgeClass: "bg-emerald-100 text-emerald-700",
      };
    }

    if (tech.availability === false) {
      return {
        label: "Busy",
        badgeClass: "bg-amber-100 text-amber-700",
      };
    }

    return {
      label: `${workload} active`,
      badgeClass: "bg-blue-100 text-blue-700",
    };
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
    if (!path) return "";
    return path.startsWith("http") ? path : `${baseUrl}/storage/${path.replace(/^\/+/, "")}`;
  };

  // Logic Actions
  const sendMessage = async () => {
    if (!newMessage.trim() || chatLocked) return;
    await apiRequest(`/api/supervisor/requests/${id}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: newMessage }),
    }, true);
    setNewMessage("");
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
    await load();
  };

  const deleteMessage = async (messageId: number) => {
    if (chatLocked) return;
    const confirmed = window.confirm("Delete this message?");
    if (!confirmed) return;
    await apiRequest(`/api/supervisor/requests/${id}/messages/${messageId}`, { method: "DELETE" }, true);
    await load();
  };

  const review = async (action: "approve" | "reject") => {
    const comment = action === "reject"
      ? window.prompt("Enter the rejection reason for the requester:")
      : undefined;

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
      await load();
    } finally {
      setReviewing(false);
    }
  };

  const undoReview = async () => {
    try {
      setReviewing(true);
      setAssignError(null);
      await apiRequest(`/api/supervisor/requests/${id}/review/undo`, { method: "PATCH" }, true);
      await load();
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Failed to undo review.");
    } finally {
      setReviewing(false);
    }
  };

  const openAssign = async () => {
    const resolvedCategoryId = detail?.category_id ?? detail?.category?.id ?? null;
    if (!resolvedCategoryId) {
      setAssignError("This request has no category. Set category first.");
      setAssignOpen(true);
      return;
    }
    try {
      setAssignLoading(true);
      setAssignError(null);
      const all = await apiRequest<{ success: boolean; technicians: TechnicianOption[] }>(
        `/api/supervisor/technicians/by-category?category_id=${resolvedCategoryId}`,
        { method: "GET" },
        true
      );
      const techs = all.technicians ?? [];

      setTechnicians(techs);
      setSelectedTechId(techs[0]?.id ? String(techs[0].id) : "");
      setTechSearch("");
      if (techs.length === 0) setAssignError("No technicians found for this category.");
      setAssignOpen(true);
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Failed to load technicians.");
      setAssignOpen(true);
    } finally {
      setAssignLoading(false);
    }
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
          scheduled_time: scheduledTime || null,
        }),
      }, true);
      setAssignOpen(false);
      await load();
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Failed to assign technician.");
    } finally {
      setAssigning(false);
    }
  };

  const updateLifecycle = async (action: "close" | "reopen") => {
    try {
      setLifecycleBusy(true);
      setAssignError(null);
      await apiRequest(`/api/supervisor/requests/${id}/${action}`, { method: "PATCH" }, true);
      await load();
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : `Failed to ${action} request.`);
    } finally {
      setLifecycleBusy(false);
    }
  };

  if (!detail) return <div className="h-screen flex items-center justify-center font-black text-slate-400 animate-pulse">LOADING...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-4 animate-in fade-in duration-300">
      
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

          {/* Navigation & Action Mix */}
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
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingText("");
                                }}
                                className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-black uppercase text-slate-600"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => void updateMessage(m.id)}
                                className="rounded-lg bg-[#003366] px-2.5 py-1.5 text-[10px] font-black uppercase text-white"
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
                              onClick={() => {
                                setEditingId(m.id);
                                setEditingText(m.message);
                              }}
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
                      <p className="text-xs text-slate-500 mt-1">Start the conversation with the requester here.</p>
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
                      This request was completed by the technician and approved by the requester. Final close or reopen action is taken here by the supervisor.
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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee</p>
              </div>
            </div>
            <div className="space-y-2">
              <a href={`tel:${detail.requester?.phone}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 text-xs font-bold hover:bg-blue-50 transition-all">
                <Phone size={14} className="text-blue-500" /> {detail.requester?.phone || "-"}
              </a>
              <a href={`mailto:${detail.requester?.email}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 text-xs font-bold hover:bg-blue-50 transition-all truncate">
                <Mail size={14} className="text-blue-500" /> {detail.requester?.email || "-"}
              </a>
            </div>
          </div>

          {isAssigned && (
            <div className="bg-white rounded-[2rem] border border-slate-100 p-5 md:p-6 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                <HardHat size={16}/> Assigned Technician
              </h3>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-lg font-black text-[#003366] overflow-hidden">
                  {assignee?.profile_picture_url ? (
                    <img src={assignee.profile_picture_url} alt="Technician" className="w-full h-full object-cover rounded-2xl" />
                  ) : assignee?.fname?.[0] || "T"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">{assignee?.fname} {assignee?.lname}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Technician</p>
                </div>
              </div>
              <div className="space-y-2">
                <a href={`tel:${assignee?.phone ?? ""}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 text-xs font-bold hover:bg-blue-50 transition-all">
                  <Phone size={14} className="text-blue-500" /> {assignee?.phone || "-"}
                </a>
                <a href={`mailto:${assignee?.email ?? ""}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 text-xs font-bold hover:bg-blue-50 transition-all truncate">
                  <Mail size={14} className="text-blue-500" /> {assignee?.email || "-"}
                </a>
              </div>
            </div>
          )}

          {/* Mini Logs */}
          <div className="bg-white rounded-[2rem] border border-slate-100 p-5 md:p-6 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <Clock size={16}/> Timeline
            </h3>
            <div className="space-y-6 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100">
              {timelineEvents.map((log) => (
                <div key={log.id} className="relative pl-8">
                  <div className={`absolute left-0 top-1.5 w-5 h-5 rounded-full border-4 border-white shadow-sm ring-1 ring-slate-100 ${statusColors[log.new_status] || 'bg-slate-300'}`} />
                  <p className="text-[10px] font-black text-slate-900 uppercase">{log.new_status}</p>
                  <p className="text-[9px] font-bold text-slate-400">{formatLocalDateTime(log.created_at)}</p>
                  <p className="text-[9px] font-bold text-slate-500">By: {log.actor}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* LIGHTBOX (Untouched logic) */}
      {previewIndex !== null && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-8">
          <button onClick={() => setPreviewIndex(null)} className="absolute top-8 right-8 text-white hover:scale-110 transition-transform"><X size={32} /></button>
          <img src={resolveImage(detail.images?.[previewIndex]?.image_path)} className="max-w-full max-h-[85vh] rounded-3xl animate-in zoom-in-95 duration-300" alt="Preview" />
        </div>
      )}

      {assignOpen && (
        <div className="fixed inset-0 z-[1300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white border border-slate-100 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Assign Technician</h3>
              <button onClick={() => setAssignOpen(false)} className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X size={16} />
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Category Match</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{detail.category?.name ?? "General"}</p>
              <p className="mt-1 text-xs text-slate-500">Choose the technician who best fits this request. Matching staff are listed below.</p>
            </div>

            {assignLoading ? (
              <p className="text-sm text-slate-500">Loading technicians...</p>
            ) : (
              <>
                <div className="space-y-3">
                  <input
                    value={techSearch}
                    onChange={(e) => setTechSearch(e.target.value)}
                    placeholder="Search technician by name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#003366]/30 focus:ring-2 focus:ring-[#003366]/10 outline-none"
                  />
                  <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                    {filteredTechnicians.map((t) => {
                      const isSelected = selectedTechId === String(t.id);
                      const fullName = `${t.fname ?? ""} ${t.lname ?? ""}`.trim() || "Unnamed technician";
                      const techState = getTechnicianState(t);
                      const workload = Number(t.open_workload ?? 0);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTechId(String(t.id))}
                          className={`w-full rounded-2xl border p-4 text-left transition-all ${
                            isSelected
                              ? "border-[#003366] bg-blue-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/60"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-900">{fullName}</p>
                              <p className="mt-1 text-xs text-slate-500">{t.phone || t.email || "No contact info"}</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${techState.badgeClass}`}>
                                {techState.label}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500">
                                {workload} jobs
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {filteredTechnicians.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
                        <p className="text-sm font-black text-slate-700">No technician found</p>
                        <p className="mt-1 text-xs text-slate-500">Try a different search term or review technician specialties.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-slate-200 rounded-xl p-3 text-sm text-slate-900" />
                  <input type="date" value={finishDate} onChange={(e) => setFinishDate(e.target.value)} className="border border-slate-200 rounded-xl p-3 text-sm text-slate-900" />
                </div>
                <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-900" />
              </>
            )}

            {assignError && <p className="text-xs font-bold text-rose-600">{assignError}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setAssignOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black uppercase">Cancel</button>
              <button onClick={assignTechnician} disabled={assignLoading || assigning || !selectedTechId} className="px-4 py-2 rounded-xl bg-[#003366] text-white text-xs font-black uppercase disabled:opacity-40">
                {assigning ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
