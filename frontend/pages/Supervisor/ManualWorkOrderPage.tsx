"use client";

import { useState, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/api";
import { 
  ClipboardList, MapPin, HardHat, 
  AlertCircle,
  ChevronLeft, Send, Save,
  CheckCircle2
} from "lucide-react";

// --- TYPES ---
interface Category { id: number; name: string; }
interface Building { id: number; name: string; }
interface Room { id: number; name: string; building_id: number; }
interface Technician {
  id: number;
  fname: string;
  lname: string;
  open_workload: number;
  specialties?: Array<{ id: number; name: string; category_id?: number }>;
}

interface MetaState {
  categories: Category[];
  buildings: Building[];
  rooms: Room[];
  technicians: Technician[];
}

interface ManualWorkOrderPageProps {
  embedded?: boolean;
}

export default function ManualWorkOrderPage({ embedded = false }: ManualWorkOrderPageProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isLoadingTechs, setIsLoadingTechs] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  
  const stepRef = useRef<HTMLDivElement>(null);

  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    categoryId: "",
    priority: "medium",
    locationMode: "standard" as "standard" | "custom",
    buildingId: "",
    roomId: "",
    assetId: "",
    customLocation: "",
    assignedTo: "",
    scheduledDate: "",
    scheduledTime: "",
    estimatedHours: "2",
    internalNotes: ""
  });

  const [meta, setMeta] = useState<MetaState>({
    categories: [],
    buildings: [],
    rooms: [],
    technicians: []
  });

  const canRelease = Boolean(formData.assignedTo && formData.scheduledDate && formData.title && formData.categoryId);

  // --- STYLES ---
  const labelStyle = "text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block ml-1";
  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400 disabled:opacity-50";
  const cardStyle = `bg-white border border-slate-200 ${embedded ? "rounded-3xl p-6" : "rounded-[2.5rem] p-8 md:p-12"} shadow-sm relative transition-all`;

  // --- API FETCH EFFECTS (Buildings/Categories) ---
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const catRes = await apiRequest<{ categories: Category[] }>("/api/requester/meta/categories", { method: "GET" }, true);
        const buildRes = await apiRequest<{ buildings: Building[] }>("/api/requester/meta/buildings", { method: "GET" }, true);
        setMeta(prev => ({ ...prev, categories: catRes.categories || [], buildings: buildRes.buildings || [] }));
      } catch (err) { console.error(err); }
    };
    void fetchInitial();
  }, []);

  // --- LOAD ROOMS ---
  useEffect(() => {
    if (!formData.buildingId) return setMeta(prev => ({ ...prev, rooms: [] }));
    const loadRooms = async () => {
      setIsLoadingRooms(true);
      try {
        const res = await apiRequest<{ rooms: Room[] }>(`/api/requester/meta/rooms?building_id=${formData.buildingId}`, { method: "GET" }, true);
        setMeta(prev => ({ ...prev, rooms: res.rooms || [] }));
      } finally { setIsLoadingRooms(false); }
    };
    void loadRooms();
  }, [formData.buildingId]);

  // --- LOAD TECHS ---
  useEffect(() => {
    if (!formData.categoryId) return setMeta(prev => ({ ...prev, technicians: [] }));
    const loadTechnicians = async () => {
      setIsLoadingTechs(true);
      try {
        const res = await apiRequest<{ technicians: Technician[] }>("/api/pm/technicians", { method: "GET" }, true);
        const filtered = (res.technicians || []).filter((t) => (t.specialties ?? []).some((s) => Number(s.category_id) === Number(formData.categoryId)));
        setMeta(prev => ({ ...prev, technicians: filtered }));
      } finally { setIsLoadingTechs(false); }
    };
    void loadTechnicians();
  }, [formData.categoryId]);

  const validateAndSubmit = async (release: boolean) => {
    setSubmitError(null);
    const errors: string[] = [];
    if (!formData.title || !formData.categoryId) errors.push("basis");
    if (formData.locationMode === "standard" && (!formData.buildingId || !formData.roomId)) errors.push("location");
    if (release && (!formData.assignedTo || !formData.scheduledDate)) errors.push("assignment");

    if (errors.length > 0) {
      setSubmitError("Please complete the required fields before continuing.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        category_id: Number(formData.categoryId),
        building_id: formData.buildingId ? Number(formData.buildingId) : null,
        room_id: formData.roomId ? Number(formData.roomId) : null,
        assigned_to: formData.assignedTo ? Number(formData.assignedTo) : null,
        release
      };

      await apiRequest("/api/supervisor/work-orders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, true);
      
      setSubmitSuccess(release ? "Order Released!" : "Draft Saved!");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`max-w-3xl mx-auto ${embedded ? "" : "py-12 px-6"}`}>
      {/* Header */}
      {!embedded && (
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Manual Work Order</h1>
          <p className="text-slate-500 font-medium">Create a task manually without a formal request.</p>
        </div>
      )}

      {/* Modern Stepper */}
      <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        {[1, 2, 3].map((num) => (
          <button 
            key={num}
            onClick={() => setStep(num)}
            className={`flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              step === num ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === num ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>{num}</span>
            <span className="hidden sm:inline">{num === 1 ? 'Task' : num === 2 ? 'Location' : 'Assignment'}</span>
          </button>
        ))}
      </div>

      <div className={cardStyle} ref={stepRef}>
        {/* Step 1: Task */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <header className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><ClipboardList size={20} /></div>
              <h2 className="font-black text-xl text-slate-900">General Information</h2>
            </header>
            
            <div>
              <label className={labelStyle}>Work Order Title *</label>
              <input 
                className={inputStyle} 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                placeholder="Briefly describe the issue..."
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelStyle}>Category *</label>
                <select className={inputStyle} value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})}>
                  <option value="">Select Category</option>
                  {meta.categories.map(c => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelStyle}>Priority</label>
                <select className={inputStyle} value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                  <option value="low">Standard</option>
                  <option value="medium">Medium (24h)</option>
                  <option value="high">Urgent (4h)</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelStyle}>Full Description</label>
              <textarea rows={3} className={inputStyle} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Detailed instructions for the technician..." />
            </div>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <header className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><MapPin size={20} /></div>
              <h2 className="font-black text-xl text-slate-900">Location</h2>
            </header>

            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button 
                onClick={() => setFormData({...formData, locationMode: 'standard'})}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${formData.locationMode === 'standard' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400'}`}
              >Campus Asset</button>
              <button 
                onClick={() => setFormData({...formData, locationMode: 'custom'})}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${formData.locationMode === 'custom' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400'}`}
              >Manual Entry</button>
            </div>

            {formData.locationMode === 'standard' ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelStyle}>Building</label>
                  <select className={inputStyle} value={formData.buildingId} onChange={e => setFormData({...formData, buildingId: e.target.value})}>
                    <option value="">Select Building</option>
                    {meta.buildings.map(b => <option key={b.id} value={b.id.toString()}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Room</label>
                  <select className={inputStyle} value={formData.roomId} onChange={e => setFormData({...formData, roomId: e.target.value})} disabled={!formData.buildingId}>
                    <option value="">{isLoadingRooms ? "..." : "Select Room"}</option>
                    {meta.rooms.map(r => <option key={r.id} value={r.id.toString()}>{r.name}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <input className={inputStyle} value={formData.customLocation} onChange={e => setFormData({...formData, customLocation: e.target.value})} placeholder="e.g. Garden behind Library" />
            )}
          </div>
        )}

        {/* Step 3: Assignment */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <header className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-slate-100 text-slate-900 rounded-2xl"><HardHat size={20} /></div>
              <h2 className="font-black text-xl text-slate-900">Execution</h2>
            </header>

            <div>
              <label className={labelStyle}>Technician</label>
              <select className={inputStyle} value={formData.assignedTo} onChange={e => setFormData({...formData, assignedTo: e.target.value})}>
                <option value="">{isLoadingTechs ? "Searching specialists..." : "Choose Specialist"}</option>
                {meta.technicians.map(t => (
                  <option key={t.id} value={t.id.toString()}>{t.fname} {t.lname} ({t.open_workload} active jobs)</option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelStyle}>Date</label>
                <input type="date" className={inputStyle} value={formData.scheduledDate} onChange={e => setFormData({...formData, scheduledDate: e.target.value})} />
              </div>
              <div>
                <label className={labelStyle}>Est. Time (Hours)</label>
                <input type="number" step="0.5" className={inputStyle} value={formData.estimatedHours} onChange={e => setFormData({...formData, estimatedHours: e.target.value})} />
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="mt-12 flex items-center justify-between border-t border-slate-100 pt-8">
          <button 
            type="button"
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            className="text-slate-400 font-bold text-xs flex items-center gap-2 hover:text-slate-900 disabled:opacity-0 transition-all"
          >
            <ChevronLeft size={16} /> Back
          </button>

          <div className="flex gap-3">
            {step < 3 ? (
              <button 
                onClick={() => setStep(step + 1)}
                className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
              >
                Next Step
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => validateAndSubmit(false)}
                  className="px-6 py-4 rounded-2xl text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Save size={16} /> Save Draft
                </button>
                <button
                  type="button"
                  disabled={!canRelease || isSubmitting}
                  onClick={() => validateAndSubmit(true)}
                  className="bg-blue-600 text-white px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                >
                  <Send size={16} /> {isSubmitting ? "Sending..." : "Release"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Messages */}
      {submitSuccess && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 size={20} />
          <span className="text-sm font-bold">{submitSuccess}</span>
        </div>
      )}
      
      {submitError && (
        <div className="mt-4 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl flex items-center gap-3 animate-bounce">
          <AlertCircle size={20} />
          <span className="text-sm font-bold">{submitError}</span>
        </div>
      )}
    </div>
  );
}
