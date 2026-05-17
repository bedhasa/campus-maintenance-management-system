"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { buildStorageUrl } from "@/lib/runtime-config";
import {
  Boxes,
  Building2,
  CirclePlus,
  Hash,
  MapPin,
  PencilLine,
  Search,
  ShieldCheck,
  Tag,
  Warehouse,
} from "lucide-react";

type FormState = {
  name: string;
  category_id: string;
  building_id: string;
  room_id: string;
  serial_number: string;
  status: "active" | "inactive";
};

const emptyForm: FormState = {
  name: "",
  category_id: "",
  building_id: "",
  room_id: "",
  serial_number: "",
  status: "active",
};

interface Category {
  id: string;
  name: string;
}

interface Building {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
  building_id: string;
}

interface AssetRecord {
  id: number;
  name: string;
  category_id: string;
  category?: Category | null;
  building_id?: string;
  building?: Building | null;
  room_id?: string;
  room?: Room | null;
  serial_number?: string | null;
  image_path?: string | null;
  status: "active" | "inactive";
}

interface AssetManagementPageProps {
  embedded?: boolean;
}

export default function AssetManagementPage({ embedded = false }: AssetManagementPageProps) {
  const [sectionTab, setSectionTab] = useState<"registry" | "form">("registry");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [formRooms, setFormRooms] = useState<Room[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [search, setSearch] = useState("");
  const [buildingFilter, setBuildingFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const inputStyle =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-50";
  const labelStyle = "mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500";

  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setEditingId(null);
    setImageFile(null);
    setError(null);
    setSuccess(null);
  }, []);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  );

  const visibleAssets = useMemo(() => {
    const term = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesSearch =
        !term ||
        asset.name.toLowerCase().includes(term) ||
        (asset.serial_number ?? "").toLowerCase().includes(term) ||
        (asset.building?.name ?? "").toLowerCase().includes(term) ||
        (asset.room?.name ?? "").toLowerCase().includes(term);
      const matchesBuilding = buildingFilter === "all" || asset.building_id === buildingFilter;
      const matchesCategory = categoryFilter === "all" || asset.category_id === categoryFilter;

      return matchesSearch && matchesBuilding && matchesCategory;
    });
  }, [assets, buildingFilter, categoryFilter, search]);

  const loadMeta = useCallback(async () => {
    const [categoryRes, buildingRes] = await Promise.all([
      apiRequest<{ categories: Category[] }>("/api/requester/meta/categories", { method: "GET" }, true),
      apiRequest<{ buildings: Building[] }>("/api/requester/meta/buildings", { method: "GET" }, true),
    ]);

    setCategories(categoryRes.categories ?? []);
    setBuildings(buildingRes.buildings ?? []);
  }, []);

  const loadAssets = useCallback(async () => {
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    if (buildingFilter !== "all") query.set("building_id", buildingFilter);
    if (categoryFilter !== "all") query.set("category_id", categoryFilter);

    const response = await apiRequest<{ assets: AssetRecord[] }>(
      query.toString() ? `/api/supervisor/assets?${query.toString()}` : "/api/supervisor/assets",
      { method: "GET" },
      true
    );

    setAssets(response.assets ?? []);
  }, [buildingFilter, categoryFilter, search]);

  const loadRooms = useCallback(async (buildingId: string) => {
    if (!buildingId) {
      setFormRooms([]);
      return;
    }

    const response = await apiRequest<{ rooms: Room[] }>(
      `/api/requester/meta/rooms?building_id=${buildingId}`,
      { method: "GET" },
      true
    );
    setFormRooms(response.rooms ?? []);
  }, []);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await Promise.all([loadMeta(), loadAssets()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load asset data.");
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [loadAssets, loadMeta]);

  useEffect(() => {
    if (!form.building_id) {
      setFormRooms([]);
      return;
    }

    void loadRooms(form.building_id).catch(() => {
      setFormRooms([]);
    });
  }, [form.building_id, loadRooms]);

  useEffect(() => {
    if (!selectedAssetId && assets.length > 0) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  const startEdit = (asset: AssetRecord) => {
    setEditingId(asset.id);
    setSectionTab("form");
    setSelectedAssetId(asset.id);
    setForm({
      name: asset.name,
      category_id: asset.category_id,
      building_id: asset.building_id ?? "",
      room_id: asset.room_id ?? "",
      serial_number: asset.serial_number ?? "",
      status: asset.status,
    });
    setImageFile(null);
    setError(null);
    setSuccess(null);
  };

  const saveAsset = async () => {
    if (!form.name.trim() || !form.category_id || !form.building_id || !form.room_id) {
      setError("Name, category, building, and room are required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("name", form.name.trim());
      formData.append("category_id", form.category_id);
      formData.append("building_id", form.building_id);
      formData.append("room_id", form.room_id);
      if (form.serial_number.trim()) formData.append("serial_number", form.serial_number.trim());
      formData.append("status", form.status);
      if (imageFile) formData.append("image", imageFile);

      if (editingId) {
        // use POST with _method=PUT for FormData
        formData.append("_method", "PUT");
        await apiRequest(`/api/supervisor/assets/${editingId}`, {
          method: "POST",
          body: formData,
        }, true);
        setSuccess("Asset updated successfully.");
      } else {
        await apiRequest("/api/supervisor/assets", {
          method: "POST",
          body: formData,
        }, true);
        setSuccess("Asset added successfully.");
      }

      await loadAssets();
      resetForm();
      setSectionTab("registry");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save asset.");
    } finally {
      setIsSaving(false);
    }
  };

  const summary = useMemo(
    () => ({
      total: assets.length,
      active: assets.filter((asset) => asset.status === "active").length,
      inactive: assets.filter((asset) => asset.status === "inactive").length,
      categoriesCovered: new Set(assets.map((asset) => asset.category_id)).size,
    }),
    [assets]
  );

  return (
    <div className={embedded ? "space-y-6" : "mx-auto max-w-7xl space-y-6 p-4"}>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total", value: summary.total, icon: Boxes, color: "text-blue-600 bg-blue-50" },
          { label: "Active", value: summary.active, icon: ShieldCheck, color: "text-emerald-600 bg-emerald-50" },
          { label: "Inactive", value: summary.inactive, icon: Warehouse, color: "text-amber-600 bg-amber-50" },
          { label: "Types", value: summary.categoriesCovered, icon: Building2, color: "text-slate-600 bg-slate-100" },
        ].map((card) => (
          <div key={card.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`rounded-xl p-2 ${card.color}`}>
              <card.icon size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">{card.label}</p>
              <p className="text-xl font-black text-slate-900">{card.value}</p>
            </div>
          </div>
        ))}
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{success}</div>}

      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {(["registry", "form"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSectionTab(tab)}
              className={`rounded-lg px-6 py-1.5 text-xs font-bold transition-all ${
                sectionTab === tab ? "bg-white text-sky-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "registry" ? "Asset List" : editingId ? "Edit Details" : "Add New Asset"}
            </button>
          ))}
        </div>

        {sectionTab === "registry" && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setSectionTab("form");
            }}
            className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700"
          >
            <CirclePlus size={14} /> New Asset
          </button>
        )}
      </div>

      <main>
        {sectionTab === "form" ? (
          <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-xl font-black text-slate-900">{editingId ? "Update Asset" : "Register Asset"}</h2>
            <div className="space-y-4">
              <div>
                <label className={labelStyle}>Asset Name</label>
                <input
                  className={inputStyle}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. AC Unit - Block A"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelStyle}>Category</label>
                  <select
                    className={inputStyle}
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelStyle}>Status</label>
                  <select
                    className={inputStyle}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as FormState["status"] })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelStyle}>Building</label>
                  <select
                    className={inputStyle}
                    value={form.building_id}
                    onChange={(e) => setForm({ ...form, building_id: e.target.value, room_id: "" })}
                  >
                    <option value="">Select...</option>
                    {buildings.map((building) => (
                      <option key={building.id} value={building.id}>
                        {building.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelStyle}>Room</label>
                  <select
                    className={inputStyle}
                    value={form.room_id}
                    onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                    disabled={!form.building_id}
                  >
                    <option value="">Select...</option>
                    {formRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelStyle}>Serial Number</label>
                  <input
                    className={inputStyle}
                    value={form.serial_number}
                    onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                    placeholder="Optional serial number"
                  />
                </div>
                <div>
                  <label className={labelStyle}>Asset Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    className={`${inputStyle} p-1.5`}
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveAsset()}
                className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {isSaving ? "Processing..." : editingId ? "Update Asset" : "Save Asset"}
              </button>
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="relative min-w-[200px] flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-xl bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none"
                  placeholder="Search by name or serial..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
              >
                <option value="all">All Buildings</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>

              <select
                className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
              <div className="custom-scrollbar max-h-[600px] space-y-2 overflow-y-auto pr-2">
                {isLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-400">
                    Loading assets...
                  </div>
                ) : visibleAssets.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-400">
                    No assets found.
                  </div>
                ) : (
                  visibleAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setSelectedAssetId(asset.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition-all ${
                        selectedAssetId === asset.id
                          ? "border-sky-200 bg-sky-50 ring-1 ring-sky-200"
                          : "border-slate-100 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900">{asset.name}</h4>
                          <div className="mt-1 flex gap-3 text-[11px] font-medium text-slate-500">
                            <span className="flex items-center gap-1">
                              <Tag size={12} /> {asset.category?.name ?? "No category"}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin size={12} /> {asset.building?.name ?? "No building"}
                            </span>
                          </div>
                        </div>
                        <div
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            asset.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {asset.status}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="sticky top-0 h-fit rounded-3xl border border-slate-200 bg-slate-50/50 p-6">
                {selectedAsset ? (
                  <div className="space-y-6">
                    <div className="flex gap-6">
                      {selectedAsset.image_path && (
                        <div className="w-32 h-32 shrink-0">
                          <img src={buildStorageUrl(selectedAsset.image_path)} alt={selectedAsset.name} className="w-full h-full object-cover rounded-2xl border border-slate-200 shadow-sm" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-black text-slate-900">{selectedAsset.name}</h3>
                        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-sky-600">Asset Profile</p>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                        <p className={labelStyle}>Location</p>
                        <p className="text-sm font-bold text-slate-700">
                          {selectedAsset.building?.name ?? "No building"} - {selectedAsset.room?.name ?? "No room"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                        <p className={labelStyle}>Identification</p>
                        <p className="flex items-center gap-2 text-sm font-bold text-slate-700">
                          <Hash size={14} className="text-slate-400" /> {selectedAsset.serial_number || "No Serial"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => startEdit(selectedAsset)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      <PencilLine size={16} /> Edit Asset Data
                    </button>
                  </div>
                ) : (
                  <div className="py-20 text-center">
                    <Boxes size={40} className="mx-auto mb-4 text-slate-200" />
                    <p className="text-sm font-bold text-slate-400">Select an asset to view details</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
