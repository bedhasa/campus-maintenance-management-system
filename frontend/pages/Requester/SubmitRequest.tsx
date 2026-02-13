"use client";

import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "../../lib/router-dom-shim";
import { Send, CircleCheckBig, ArrowRight, Camera, X, AlertCircle } from "lucide-react";
import { Priority } from "../../types";
import { apiRequest } from "../../lib/api";

type Category = { id: number; name: string; description?: string | null };
type Building = { id: number; name: string };
type Room = { id: number; building_id: number; name: string };

type EditRequest = {
  id: number;
  title: string;
  description: string;
  category_id: number;
  building_id: number | null;
  room_id: number | null;
  custom_location: string | null;
  priority: "low" | "medium" | "high" | "urgent";
};

type CreateRequestResponse = {
  success: boolean;
  message: string;
  request: {
    id: number;
  };
};

interface RequestFormInputs {
  title: string;
  building: string;
  room: string;
  locationType: "structured" | "custom";
  customLocation: string;
  problemType: string;
  urgency: Priority;
  description: string;
}

const toApiPriority = (value: Priority): "low" | "medium" | "high" | "urgent" => {
  if (value === Priority.LOW) return "low";
  if (value === Priority.MEDIUM) return "medium";
  if (value === Priority.HIGH) return "high";
  return "urgent";
};

const fromApiPriority = (value: "low" | "medium" | "high" | "urgent"): Priority => {
  if (value === "low") return Priority.LOW;
  if (value === "medium") return Priority.MEDIUM;
  if (value === "high") return Priority.HIGH;
  return Priority.CRITICAL;
};

const SubmitRequest: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [formData, setFormData] = useState<RequestFormInputs>({
    title: "",
    building: "",
    room: "",
    locationType: "structured",
    customLocation: "",
    problemType: "",
    urgency: Priority.MEDIUM,
    description: "",
  });

  const editData = location.state?.editRequest as EditRequest | undefined;

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [catRes, buildRes] = await Promise.all([
          apiRequest<{ categories: Category[] }>("/api/requester/meta/categories", { method: "GET" }, true),
          apiRequest<{ buildings: Building[] }>("/api/requester/meta/buildings", { method: "GET" }, true),
        ]);
        setCategories(catRes.categories ?? []);
        setBuildings(buildRes.buildings ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not load university data.";
        setError(message);
      }
    };
    loadMeta();
  }, []);

  useEffect(() => {
    if (!editData) return;
    setFormData({
      title: editData.title,
      building: editData.building_id ? String(editData.building_id) : "",
      room: editData.room_id ? String(editData.room_id) : "",
      locationType: editData.building_id ? "structured" : "custom",
      customLocation: editData.custom_location ?? "",
      problemType: String(editData.category_id),
      urgency: fromApiPriority(editData.priority),
      description: editData.description,
    });
  }, [editData]);

  useEffect(() => {
    const loadRooms = async () => {
      if (!formData.building) {
        setRooms([]);
        return;
      }
      try {
        const data = await apiRequest<{ rooms: Room[] }>(
          `/api/requester/meta/rooms?building_id=${formData.building}`,
          { method: "GET" },
          true
        );
        setRooms(data.rooms ?? []);
      } catch {
        setRooms([]);
      }
    };
    loadRooms();
  }, [formData.building]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    if (images.length + newFiles.length > 3) {
      setError("You can only upload up to 3 photos.");
      return;
    }

    setImages((prev) => [...prev, ...newFiles]);
    const previews = newFiles.map((file) => URL.createObjectURL(file));
    setImagePreviews((prev) => [...prev, ...previews]);
    setError(null);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const updateField = <K extends keyof RequestFormInputs>(key: K, value: RequestFormInputs[K]) => {
    setError(null);
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const nextStep = () => {
    if (step === 1 && (!formData.title.trim() || !formData.problemType)) {
      setError("Please provide a title and select a problem category.");
      return;
    }
    if (step === 2 && formData.locationType === "structured" && (!formData.building || !formData.room)) {
      setError("Please select both building and room.");
      return;
    }
    if (step === 2 && formData.locationType === "custom" && !formData.customLocation.trim()) {
      setError("Please describe the location.");
      return;
    }
    setStep((prev) => prev + 1);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      setError("Please provide issue details.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        category_id: Number(formData.problemType),
        building_id: formData.locationType === "structured" ? Number(formData.building) : null,
        room_id: formData.locationType === "structured" ? Number(formData.room) : null,
        custom_location: formData.locationType === "custom" ? formData.customLocation : null,
        priority: toApiPriority(formData.urgency),
      };

      let requestId: number;
      if (editData?.id) {
        await apiRequest(`/api/requester/requests/${editData.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, true);
        requestId = editData.id;
      } else {
        const created = await apiRequest<CreateRequestResponse>("/api/requester/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, true);
        requestId = created.request.id;
      }

      if (images.length > 0 && requestId) {
        for (const file of images) {
          const body = new FormData();
          body.append("image", file);
          await apiRequest(`/api/requester/requests/${requestId}/images`, {
            method: "POST",
            body,
          }, true);
        }
      }

      setSubmittedId(requestId);
      setIsSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit request.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center text-emerald-600 mx-auto mb-8 shadow-md border border-emerald-100">
          <CircleCheckBig size={48} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Request Logged!</h1>
        <p className="text-slate-600 font-bold mb-10 max-w-sm mx-auto leading-relaxed">
          {submittedId ? `Request #${submittedId} has been sent to maintenance.` : "Your request has been sent to maintenance."}
        </p>
        <button onClick={() => navigate("/requester/dashboard")} className="w-full py-5 bg-[#003366] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">
          View My Requests
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 px-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-tight">
            {editData ? "Update Request" : "Report Facility Issue"}
          </h1>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Section {step} of 3</p>
        </div>
        <div className="flex items-center space-x-1.5">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-2 w-8 rounded-full transition-all duration-500 ${step >= s ? "bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]" : "bg-slate-200"}`} />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border-2 border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700 flex items-center gap-3 animate-in slide-in-from-top-2">
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        {step === 1 && (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-8 animate-in slide-in-from-right-4">
            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Issue Headline</label>
              <input
                placeholder="Ex: Water leakage in ceiling..."
                value={formData.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-800 placeholder:text-slate-400 shadow-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Issue Category</label>
                <select
                  value={formData.problemType}
                  onChange={(e) => updateField("problemType", e.target.value)}
                  className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-800 focus:border-blue-500 outline-none shadow-sm appearance-none"
                >
                  <option value="" className="text-slate-400">Select Type...</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Urgency Level</label>
                <select
                  value={formData.urgency}
                  onChange={(e) => updateField("urgency", e.target.value as Priority)}
                  className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-800 focus:border-blue-500 outline-none shadow-sm"
                >
                  {Object.values(Priority).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <button type="button" onClick={nextStep} className="w-full py-5 bg-[#003366] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-900 transition-all flex items-center justify-center space-x-3 shadow-xl active:scale-95">
              <span>Next: Location</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-8 animate-in slide-in-from-right-4">
            <div className="flex bg-slate-100 p-2 rounded-2xl">
              <button type="button" onClick={() => updateField("locationType", "structured")} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.locationType === "structured" ? "bg-[#003366] text-white shadow-lg" : "text-slate-400"}`}>On-Campus</button>
              <button type="button" onClick={() => updateField("locationType", "custom")} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.locationType === "custom" ? "bg-[#003366] text-white shadow-lg" : "text-slate-400"}`}>External Area</button>
            </div>

            {formData.locationType === "structured" ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Building</label>
                  <select
                    value={formData.building}
                    onChange={(e) => {
                      updateField("building", e.target.value);
                      updateField("room", "");
                    }}
                    className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-800 focus:border-blue-500 outline-none shadow-sm"
                  >
                    <option value="">Select Building...</option>
                    {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Room</label>
                  <select
                    value={formData.room}
                    onChange={(e) => updateField("room", e.target.value)}
                    disabled={!formData.building}
                    className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-800 focus:border-blue-500 outline-none shadow-sm disabled:opacity-50"
                  >
                    <option value="">{formData.building ? "Choose Room..." : "Select building first"}</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Specify Area</label>
                <textarea
                  value={formData.customLocation}
                  onChange={(e) => updateField("customLocation", e.target.value)}
                  placeholder="Ex: Main gate walkway, near the library entrance..."
                  className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500 font-bold text-slate-800 placeholder:text-slate-400 shadow-sm"
                  rows={4}
                />
              </div>
            )}

            <div className="pt-4 flex gap-4">
              <button type="button" onClick={() => setStep(1)} className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200">Go Back</button>
              <button type="button" onClick={nextStep} className="flex-2 py-4 bg-[#003366] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Continue to Final Step</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-8 animate-in slide-in-from-right-4">
            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Detailed Explanation</label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={5}
                placeholder="Tell us exactly what's wrong so technicians can prepare..."
                className="w-full p-6 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-blue-500 font-bold text-slate-800 placeholder:text-slate-400 shadow-inner leading-relaxed"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end ml-1">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Photos (Optional)</label>
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">{images.length}/3 Images</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {imagePreviews.map((src, idx) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 group shadow-sm">
                    <img src={src} alt="Upload preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeImage(idx)} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {images.length < 3 && (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-600 hover:bg-blue-50 transition-all gap-2">
                    <Camera size={24} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Add Photo</span>
                  </button>
                )}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" multiple />
            </div>

            <div className="pt-4 flex gap-4">
              <button type="button" onClick={() => setStep(2)} className="flex-1 py-5 bg-slate-50 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200">Back</button>
              <button type="submit" disabled={isSubmitting} className="flex-2 py-5 bg-[#003366] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl flex items-center justify-center space-x-3 active:scale-95 transition-all">
                {isSubmitting ? <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>{editData ? "Update Request" : "Submit Report"}</span><Send size={16} /></>}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default SubmitRequest;

