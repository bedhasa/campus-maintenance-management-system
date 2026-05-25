"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "../../lib/router-dom-shim";
import { Send, CircleCheckBig, ArrowRight, Camera, X, AlertCircle } from "lucide-react";
import { Priority } from "../../types";
import { apiRequest } from "../../lib/api";

type Category = { id: number; name: string; description?: string | null };
type Building = { id: number; name: string };
type Room = { id: number; building_id: number; name: string };
type Asset = {
  id: number;
  name: string;
  building_id?: number | null;
  room_id?: number | null;
  category_id?: number | null;
};

type EditRequest = {
  id: number;
  title: string;
  description: string;
  category_id: number | null;
  category_name?: string | null;
  building_id: number | null;
  building_name?: string | null;
  room_id: number | null;
  room_name?: string | null;
  asset_id: number | null;
  asset_name?: string | null;
  custom_location: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status?: "submitted" | "approved" | "assigned" | "in_progress" | "completed" | "rejected" | "closed" | "cancelled";
};

type RequestDetailForEditResponse = {
  success: boolean;
  request: {
    id: number;
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "urgent";
    category_id?: number | null;
    building_id?: number | null;
    room_id?: number | null;
    asset_id?: number | null;
    custom_location?: string | null;
    status: "submitted" | "approved" | "assigned" | "in_progress" | "completed" | "rejected" | "closed" | "cancelled";
    category?: { id?: number; name?: string | null } | null;
    building?: { id?: number; name?: string | null } | null;
    room?: { id?: number; name?: string | null } | null;
    asset?: { id?: number; name?: string | null } | null;
  };
};

type SettingsResponse = {
  success: boolean;
  settings: {
    default_location: {
      building_id: number | null;
      room_id: number | null;
    };
  };
};

type RequestListItem = {
  id: number;
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "submitted" | "approved" | "assigned" | "in_progress" | "completed" | "rejected" | "closed" | "cancelled";
  created_at: string;
};

type RequestListResponse = {
  success: boolean;
  requests: {
    data: RequestListItem[];
  };
};

type RequestPayload = {
  title: string;
  description: string;
  category_id: number;
  building_id: number | null;
  room_id: number | null;
  asset_id: number | null;
  custom_location: string | null;
  priority: "low" | "medium" | "high" | "urgent";
};

interface RequestFormInputs {
  title: string;
  building: string;
  room: string;
  asset: string;
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

const normalizeName = (value?: string | null) => (value ?? "").trim().toLowerCase();
const normalizeText = (value?: string | null) => (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const isRecoverableSubmissionError = (error: unknown) =>
  error instanceof Error &&
  (
    error.message === "Request timed out. Please try again." ||
    error.message === "Unable to reach the server. Please check your connection and try again."
  );
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SubmitRequest: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isEditabilityLoading, setIsEditabilityLoading] = useState(false);
  const [isEditLocked, setIsEditLocked] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false); // New state for resubmission
  const [queryEditData, setQueryEditData] = useState<EditRequest | null>(null);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);

  const REQUEST_SUBMIT_TIMEOUT_MS = 120000;

  const requestIdToResubmit = useMemo(() => location.state?.requestIdToResubmit ?? null, [location.state]);


  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const isMobileDevice = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }, []);
  const [formData, setFormData] = useState<RequestFormInputs>({
    title: "",
    building: "",
    room: "",
    asset: "",
    locationType: "structured",
    customLocation: "",
    problemType: "",
    urgency: Priority.MEDIUM,
    description: "",
  });

  const editDataFromState = location.state?.editRequest as EditRequest | undefined;
  const editIdFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    const raw = params.get("edit");
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [location.search]);
  const editData = editDataFromState ?? queryEditData ?? undefined; // This is the data used to pre-fill the form
  const editLockedMessage = "This request is under review and can no longer be modified.";
  const isEditMode = Boolean(editData?.id);
  const isExpectingEditData = Boolean(editDataFromState || editIdFromQuery || requestIdToResubmit);
  const isInitialEditDataLoading = isExpectingEditData && !editData;
  const isFormDisabled = isEditMode && (isEditabilityLoading || isEditLocked);

  useEffect(() => {
    if (isEditMode || defaultsApplied) return;
    let cancelled = false;

    const applyDefaults = async () => {
      try {
        const data = await apiRequest<SettingsResponse>("/api/requester/settings", { method: "GET" }, true);
        if (cancelled) return;
        const buildingId = data.settings?.default_location?.building_id;
        const roomId = data.settings?.default_location?.room_id;
        if (!buildingId && !roomId) {
          setDefaultsApplied(true);
          return;
        }
        setFormData((prev) => ({
          ...prev,
          locationType: "structured",
          building: buildingId ? String(buildingId) : prev.building,
          room: roomId ? String(roomId) : prev.room,
          asset: "",
        }));
        setDefaultsApplied(true);
      } catch {
        if (!cancelled) setDefaultsApplied(true);
      }
    };

    applyDefaults();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, defaultsApplied]);

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
    // If we have editDataFromState, or neither editIdFromQuery nor requestIdToResubmit, then return
    if (editDataFromState || (!editIdFromQuery && !requestIdToResubmit)) {
      return;
    }

    let cancelled = false;

    const loadEditDataFromQuery = async (requestId?: number | null) => {
      try {
        const idToLoad = requestId ?? editIdFromQuery;
        if (idToLoad == null) {
          return;
        }
        const data = await apiRequest<RequestDetailForEditResponse>(
          `/api/requester/requests/${idToLoad}`,
          { method: "GET" },
          true
        );
        if (cancelled) return;
        const req = data.request;
        const mapped: EditRequest = {
          id: req.id,
          title: req.title,
          description: req.description,
          category_id: req.category_id ?? req.category?.id ?? null,
          category_name: req.category?.name ?? null,
          building_id: req.building_id ?? req.building?.id ?? null,
          building_name: req.building?.name ?? null,
          room_id: req.room_id ?? req.room?.id ?? null,
          room_name: req.room?.name ?? null,
          asset_id: req.asset_id ?? req.asset?.id ?? null,
          asset_name: req.asset?.name ?? null,
          custom_location: req.custom_location ?? null,
          priority: req.priority,
          status: req.status,
        };
        setQueryEditData(mapped);
      } catch {
        if (!cancelled) {
          setError("Failed to load request data.");
        }
      }
    };

    if (editIdFromQuery) {
      loadEditDataFromQuery();
    } else if (requestIdToResubmit) {
      loadEditDataFromQuery(requestIdToResubmit);
      setIsResubmitting(true); // Set resubmitting flag
    }
    return () => {
      cancelled = true;
    };
  }, [editDataFromState, editIdFromQuery, requestIdToResubmit]);

  useEffect(() => {
    if (!editData?.status) return;
    setIsResubmitting(editData.status === "rejected" || editData.status === "cancelled");
  }, [editData]);

  useEffect(() => {
    if (!editData) return;
    const resolvedCategory =
      (editData.category_id ? String(editData.category_id) : "") ||
      String(categories.find((c) => normalizeName(c.name) === normalizeName(editData.category_name))?.id ?? "");
    const resolvedBuilding =
      (editData.building_id ? String(editData.building_id) : "") ||
      String(buildings.find((b) => normalizeName(b.name) === normalizeName(editData.building_name))?.id ?? "");
    const resolvedRoom =
      (editData.room_id ? String(editData.room_id) : "") ||
      String(rooms.find((r) => normalizeName(r.name) === normalizeName(editData.room_name))?.id ?? "");
    const resolvedAsset =
      (editData.asset_id ? String(editData.asset_id) : "") ||
      String(assets.find((asset) => normalizeName(asset.name) === normalizeName(editData.asset_name))?.id ?? "");
    const hasStructuredLocation = Boolean(resolvedBuilding || resolvedRoom || editData.building_name || editData.room_name);

    setFormData({
      title: editData.title,
      building: resolvedBuilding,
      room: resolvedRoom,
      asset: resolvedAsset,
      locationType: hasStructuredLocation ? "structured" : "custom",
      customLocation: editData.custom_location ?? "",
      problemType: resolvedCategory,
      urgency: fromApiPriority(editData.priority),
      description: editData.description,
    });
  }, [editData, categories, buildings, rooms, assets]);

  useEffect(() => {
    if (!editData || isResubmitting) return; // Don't apply room logic if resubmitting
    if (!formData.building || formData.room || !editData.room_name) return;

    const resolvedRoom = rooms.find((r) => normalizeName(r.name) === normalizeName(editData.room_name));
    if (resolvedRoom) {
      setFormData((prev) => ({ ...prev, room: String(resolvedRoom.id) }));
    }
  }, [editData, formData.building, formData.room, rooms]);

  useEffect(() => {
    if (!editData?.id) {
      setIsEditLocked(false);
      setIsEditabilityLoading(false);
      return;
    }

    setIsEditabilityLoading(false);

    if (isResubmitting) {
      setIsEditLocked(false);
      return;
    }

    setIsEditLocked(editData.status !== "submitted");
  }, [editData?.id, editData?.status, isResubmitting]);

  useEffect(() => {
    const loadRooms = async () => {
      if (!formData.building) {
        setRooms([]);
        setAssets([]);
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

  useEffect(() => {
    if (formData.locationType !== "structured" || !formData.building) {
      setAssets([]);
      return;
    }

    let cancelled = false;

    const loadAssets = async () => {
      const params = new URLSearchParams();
      params.set("building_id", formData.building);
      if (formData.room) {
        params.set("room_id", formData.room);
      }
      if (formData.problemType) {
        params.set("category_id", formData.problemType);
      }

      try {
        const data = await apiRequest<{ assets: Asset[] }>(
          `/api/requester/meta/assets?${params.toString()}`,
          { method: "GET" },
          true
        );
        if (!cancelled) {
          setAssets(data.assets ?? []);
        }
      } catch {
        if (!cancelled) {
          setAssets([]);
        }
      }
    };

    loadAssets();
    return () => {
      cancelled = true;
    };
  }, [formData.locationType, formData.building, formData.room, formData.problemType]);

  useEffect(() => {
    if (!isSubmitted) return;

    const timer = window.setTimeout(() => {
      navigate("/requester/dashboard");
    }, 10000);

    return () => window.clearTimeout(timer);
  }, [isSubmitted, navigate]);

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
    setSubmissionNotice(null);
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

  const requestMatchesPayload = (request: RequestDetailForEditResponse["request"], payload: RequestPayload) => {
    const requestCategoryId = request.category_id ?? request.category?.id ?? null;
    const requestBuildingId = request.building_id ?? request.building?.id ?? null;
    const requestRoomId = request.room_id ?? request.room?.id ?? null;
    const requestAssetId = request.asset_id ?? request.asset?.id ?? null;

    return (
      normalizeText(request.title) === normalizeText(payload.title) &&
      normalizeText(request.description) === normalizeText(payload.description) &&
      request.priority === payload.priority &&
      Number(requestCategoryId ?? 0) === Number(payload.category_id ?? 0) &&
      Number(requestBuildingId ?? 0) === Number(payload.building_id ?? 0) &&
      Number(requestRoomId ?? 0) === Number(payload.room_id ?? 0) &&
      Number(requestAssetId ?? 0) === Number(payload.asset_id ?? 0) &&
      normalizeText(request.custom_location) === normalizeText(payload.custom_location)
    );
  };

  const uploadImagesForRequest = async (requestId: number) => {
    if (images.length === 0) return null;

    try {
      for (const file of images) {
        const body = new FormData();
        body.append("image", file);
        await apiRequest(`/api/requester/requests/${requestId}/images`, {
          method: "POST",
          body,
        }, true, REQUEST_SUBMIT_TIMEOUT_MS);
      }
      return null;
    } catch {
      return "Your request was submitted, but one or more photos are still missing. You can open the request and add them again.";
    }
  };

  const resolveTimedOutSubmission = async (payload: RequestPayload, submittedAt: number, existingRequestId?: number) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        if (existingRequestId) {
          const detail = await apiRequest<RequestDetailForEditResponse>(
            `/api/requester/requests/${existingRequestId}`,
            { method: "GET" },
            true,
            20000
          );
          if (requestMatchesPayload(detail.request, payload)) {
            return existingRequestId;
          }
        } else {
          const params = new URLSearchParams();
          params.set("search", payload.title);
          const list = await apiRequest<RequestListResponse>(
            `/api/requester/requests?${params.toString()}`,
            { method: "GET" },
            true,
            20000
          );

          const candidates = (list.requests?.data ?? [])
            .filter((item) => normalizeText(item.title) === normalizeText(payload.title))
            .filter((item) => {
              const createdAt = new Date(item.created_at).getTime();
              return Number.isFinite(createdAt) && createdAt >= submittedAt - 5 * 60 * 1000;
            })
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 3);

          for (const candidate of candidates) {
            const detail = await apiRequest<RequestDetailForEditResponse>(
              `/api/requester/requests/${candidate.id}`,
              { method: "GET" },
              true,
              20000
            );
            if (requestMatchesPayload(detail.request, payload)) {
              return candidate.id;
            }
          }
        }
      } catch {
        // Keep polling briefly before we give up on timeout recovery.
      }

      if (attempt < 2) {
        await wait(2500);
      }
    }

    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditLocked && !isResubmitting) { // Allow resubmitting locked requests
      setError(editLockedMessage);
      return;
    }
    if (!formData.description.trim()) {
      setError("Please provide issue details.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSubmissionNotice(null);
    const submittedAt = Date.now();
    const payload: RequestPayload = {
      title: formData.title,
      description: formData.description,
      category_id: Number(formData.problemType),
      building_id: formData.locationType === "structured" ? Number(formData.building) : null,
      room_id: formData.locationType === "structured" ? Number(formData.room) : null,
      asset_id: formData.locationType === "structured" && formData.asset ? Number(formData.asset) : null,
      custom_location: formData.locationType === "custom" ? formData.customLocation : null,
      priority: toApiPriority(formData.urgency),
    };
    try {
      let requestId: number;
      if (editData?.id) {
        await apiRequest(`/api/requester/requests/${editData.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, true, REQUEST_SUBMIT_TIMEOUT_MS);
        requestId = editData.id;
      } else {
        const created = await apiRequest<{ success: boolean; request: { id: number } }>("/api/requester/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, true, REQUEST_SUBMIT_TIMEOUT_MS);
        requestId = created.request.id;
      }

      const imageUploadNotice = await uploadImagesForRequest(requestId);
      if (imageUploadNotice) {
        setSubmissionNotice(imageUploadNotice);
      }

      setSubmittedId(requestId);
      setIsSubmitted(true);
    } catch (err) {
      if (isRecoverableSubmissionError(err)) {
        const recoveredRequestId = await resolveTimedOutSubmission(payload, submittedAt, editData?.id);
        if (recoveredRequestId) {
          let recoveryNotice = editData?.id
            ? "Your update took longer than expected, but it was saved successfully."
            : "Your request took longer than expected, but it was submitted successfully.";

          const imageUploadNotice = await uploadImagesForRequest(recoveredRequestId);
          if (imageUploadNotice) {
            recoveryNotice = `${recoveryNotice} ${imageUploadNotice}`;
          }

          setSubmissionNotice(recoveryNotice);
          setSubmittedId(recoveredRequestId);
          setIsSubmitted(true);
          setIsSubmitting(false);
          return;
        }

        setSubmissionNotice(
          editData?.id
            ? "Your update is being finalized. Redirecting you back to the dashboard."
            : "Your request is being finalized. Redirecting you back to the dashboard."
        );
        setSubmittedId(editData?.id ?? null);
        setIsSubmitted(true);
        setIsSubmitting(false);
        return;
      }

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
        {submissionNotice && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            {submissionNotice}
          </div>
        )}
        <div className="space-y-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            Redirecting to dashboard in 10 seconds...
          </p>
          <button
            onClick={() => navigate("/requester/dashboard")}
            className="w-full py-5 bg-[#003366] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
          >
            Go To Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (isInitialEditDataLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-20 px-4 pt-6">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 text-center">
          <div className="w-10 h-10 mx-auto border-4 border-slate-100 border-t-[#003366] rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-black text-slate-900">
            Loading your request...
          </h2>
          <p className="text-sm text-slate-500 mt-2 font-semibold">
            We are preparing your form details so you can edit without confusion.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 px-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-tight">
            {isEditMode ? (isResubmitting ? "Update & Resubmit Request" : "Update Request") : "Report Facility Issue"}
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

      {isEditMode && isEditLocked && !isResubmitting && ( // Only show lock message for actual edits
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 flex items-center gap-3 animate-in slide-in-from-top-2">
          <AlertCircle size={20} /> {editLockedMessage}
        </div>
      )}

      {isEditMode && isEditabilityLoading && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700 animate-in slide-in-from-top-2">
          Checking request edit status...
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <fieldset disabled={isFormDisabled} className={isFormDisabled ? "opacity-70" : undefined}>
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
                      updateField("asset", "");
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
                    onChange={(e) => {
                      updateField("room", e.target.value);
                      updateField("asset", "");
                    }}
                    disabled={!formData.building}
                    className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-800 focus:border-blue-500 outline-none shadow-sm disabled:opacity-50"
                  >
                    <option value="">{formData.building ? "Choose Room..." : "Select building first"}</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Linked Asset (Optional)</label>
                  <select
                    value={formData.asset}
                    onChange={(e) => updateField("asset", e.target.value)}
                    disabled={!formData.building}
                    className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-800 focus:border-blue-500 outline-none shadow-sm disabled:opacity-50"
                  >
                    <option value="">{formData.building ? "Select Asset..." : "Select building first"}</option>
                    {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
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
                  <button
                    type="button"
                    onClick={() => {
                      if (isMobileDevice) {
                        cameraInputRef.current?.click();
                        return;
                      }
                      fileInputRef.current?.click();
                    }}
                    className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-600 hover:bg-blue-50 transition-all gap-2"
                  >
                    <Camera size={24} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Add Photo</span>
                  </button>
                )}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" multiple />
              <input type="file" ref={cameraInputRef} onChange={handleImageChange} className="hidden" accept="image/*" capture="environment" />
            </div>

            <div className="pt-4 flex gap-4">
              <button type="button" onClick={() => setStep(2)} className="flex-1 py-5 bg-slate-50 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200">Back</button>
              <button type="submit" disabled={isSubmitting} className="flex-2 py-5 bg-[#003366] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl flex items-center justify-center space-x-3 active:scale-95 transition-all">
                {isSubmitting ? <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>{isEditMode ? (isResubmitting ? "Update & Resubmit" : "Update Request") : "Submit Report"}</span><Send size={16} /></>}
              </button>
            </div>
          </div>
        )}
        </fieldset>
      </form>
    </div>
  );
};

export default SubmitRequest;
