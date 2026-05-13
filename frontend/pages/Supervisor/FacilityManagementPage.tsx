"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest } from "@/lib/api";
import { Building2, Save, PlusCircle, PencilLine, Layers3, DoorOpen, X } from "lucide-react";
import AssetManagementPage from "./AssetManagementPage";

type Building = { id: number; name: string; created_at?: string };
type Department = { id: number; name: string; faculty: string; created_at?: string };
type Room = { id: number; building_id: number; name: string; created_at?: string; building?: { id: number; name: string } };
type ActiveTab = "buildings" | "departments" | "assets";

export default function FacilityManagementPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("buildings");
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [buildingName, setBuildingName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentFaculty, setDepartmentFaculty] = useState("");
  const [roomName, setRoomName] = useState("");
  const [pendingRooms, setPendingRooms] = useState<string[]>([]);
  const [editingBuildingId, setEditingBuildingId] = useState<number | null>(null);
  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/15";

  const loadFacilityData = useCallback(async () => {
    const [buildingRes, departmentRes, roomRes] = await Promise.all([
      apiRequest<{ success: boolean; buildings: Building[] }>("/api/supervisor/facilities/buildings", { method: "GET" }, true),
      apiRequest<{ success: boolean; departments: Department[] }>("/api/supervisor/facilities/departments", { method: "GET" }, true),
      apiRequest<{ success: boolean; rooms: Room[] }>("/api/supervisor/facilities/rooms", { method: "GET" }, true),
    ]);
    setBuildings(buildingRes.buildings ?? []);
    setDepartments(departmentRes.departments ?? []);
    setRooms(roomRes.rooms ?? []);
  }, []);

  useEffect(() => {
    void loadFacilityData().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load facility records.");
    });
  }, [loadFacilityData]);

  const summary = useMemo(
    () => ({
      buildings: buildings.length,
      departments: departments.length,
      rooms: rooms.length,
    }),
    [buildings.length, departments.length, rooms.length]
  );

  const saveBuilding = async () => {
    if (!buildingName.trim()) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      let buildingId = editingBuildingId;
      if (editingBuildingId) {
        await apiRequest(`/api/supervisor/facilities/buildings/${editingBuildingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: buildingName.trim() }),
        }, true);
        setMessage("Building updated.");
      } else {
        const response = await apiRequest<{ success: boolean; building: Building }>("/api/supervisor/facilities/buildings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: buildingName.trim() }),
        }, true);
        buildingId = response.building?.id ?? null;
        setMessage("Building registered.");
      }

      if (buildingId && pendingRooms.length > 0) {
        await Promise.all(
          pendingRooms.map((name) =>
            apiRequest("/api/supervisor/facilities/rooms", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, building_id: buildingId }),
            }, true)
          )
        );
        setMessage("Building and rooms saved.");
      }

      setBuildingName("");
      setEditingBuildingId(null);
      setPendingRooms([]);
      setRoomName("");
      await loadFacilityData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save building.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveDepartment = async () => {
    if (!departmentName.trim() || !departmentFaculty.trim()) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        name: departmentName.trim(),
        faculty: departmentFaculty.trim(),
      };
      if (editingDepartmentId) {
        await apiRequest(`/api/supervisor/facilities/departments/${editingDepartmentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, true);
        setMessage("Department updated.");
      } else {
        await apiRequest("/api/supervisor/facilities/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, true);
        setMessage("Department registered.");
      }
      setDepartmentName("");
      setDepartmentFaculty("");
      setEditingDepartmentId(null);
      await loadFacilityData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save department.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveRoom = async () => {
    if (!roomName.trim() || !editingBuildingId) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = { name: roomName.trim(), building_id: Number(editingBuildingId) };
      if (editingRoomId) {
        await apiRequest(`/api/supervisor/facilities/rooms/${editingRoomId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, true);
        setMessage("Room updated.");
      } else {
        await apiRequest("/api/supervisor/facilities/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, true);
        setMessage("Room registered.");
      }
      setRoomName("");
      setEditingRoomId(null);
      await loadFacilityData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save room.");
    } finally {
      setIsSaving(false);
    }
  };

  const buildingRooms = useMemo(() => {
    if (!editingBuildingId) return [];
    return rooms.filter((room) => room.building_id === editingBuildingId);
  }, [editingBuildingId, rooms]);

  const addPendingRoom = () => {
    const trimmed = roomName.trim();
    if (!trimmed) return;
    setPendingRooms((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setRoomName("");
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Supervisor</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Facility Management</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">Register and maintain buildings, departments, and assets.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Buildings</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{summary.buildings}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Departments</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{summary.departments}</p>
        </div>
      </section>
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-1">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Rooms</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{summary.rooms}</p>
        </div>
      </section>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</div> : null}

      <div className="inline-flex rounded-xl bg-slate-100 p-1">
        <TabButton active={activeTab === "buildings"} onClick={() => setActiveTab("buildings")} label="Buildings" />
        <TabButton active={activeTab === "departments"} onClick={() => setActiveTab("departments")} label="Departments" />
        <TabButton active={activeTab === "assets"} onClick={() => setActiveTab("assets")} label="Assets" />
      </div>

      {activeTab === "buildings" ? (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-black uppercase tracking-[0.14em] text-slate-700">Building Registration</h2>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Building Name</label>
            <input className={inputClass} value={buildingName} onChange={(e) => setBuildingName(e.target.value)} placeholder="e.g. Main Engineering Block" />

            <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Rooms</h3>
                <span className="text-[11px] font-bold text-slate-500">
                  {editingBuildingId ? "Manage existing rooms" : "Add rooms (optional)"}
                </span>
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  className={inputClass}
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder={editingBuildingId ? "Add or update a room name..." : "Type a room then click Add"}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (editingBuildingId) {
                      void saveRoom();
                      return;
                    }
                    addPendingRoom();
                  }}
                  disabled={isSaving}
                  className="shrink-0 rounded-xl bg-white px-4 text-xs font-black uppercase tracking-wider text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-60"
                >
                  {editingBuildingId ? (editingRoomId ? "Update" : "Save") : "Add"}
                </button>
              </div>

              {!editingBuildingId ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {pendingRooms.map((name) => (
                    <span key={name} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                      {name}
                      <button
                        type="button"
                        onClick={() => setPendingRooms((prev) => prev.filter((value) => value !== name))}
                        className="rounded-full p-0.5 text-slate-400 hover:text-slate-700"
                        aria-label={`Remove ${name}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {pendingRooms.length === 0 ? (
                    <p className="text-xs font-semibold text-slate-400">No rooms added yet.</p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3">
                  <SimpleTable
                    title="Rooms for this Building"
                    icon={<DoorOpen size={16} />}
                    columns={["Room", "Created", "Action"]}
                    rows={buildingRooms.map((item) => [
                      item.name,
                      item.created_at ? new Date(item.created_at).toLocaleDateString() : "-",
                      <button
                        key={`edit-r-${item.id}`}
                        type="button"
                        className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700"
                        onClick={() => {
                          setEditingRoomId(item.id);
                          setRoomName(item.name);
                        }}
                      >
                        Edit
                      </button>,
                    ])}
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void saveBuilding()}
              disabled={isSaving}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {editingBuildingId ? <PencilLine size={14} /> : <PlusCircle size={14} />}
              {editingBuildingId ? "Update Building" : "Save Building"}
            </button>
          </div>
          <SimpleTable
            title="Registered Buildings"
            icon={<Building2 size={16} />}
            columns={["Name", "Created", "Action"]}
            rows={buildings.map((item) => [
              item.name,
              item.created_at ? new Date(item.created_at).toLocaleDateString() : "-",
              <button
                key={`edit-b-${item.id}`}
                type="button"
                className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700"
                onClick={() => {
                  setEditingBuildingId(item.id);
                  setBuildingName(item.name);
                  setEditingRoomId(null);
                  setRoomName("");
                  setPendingRooms([]);
                  setActiveTab("buildings");
                }}
              >
                Edit
              </button>,
            ])}
          />
        </div>
      ) : null}

      {activeTab === "departments" ? (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-black uppercase tracking-[0.14em] text-slate-700">Department Registration</h2>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Department Name</label>
            <input className={inputClass} value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} placeholder="e.g. Electrical Engineering" />
            <label className="mb-1.5 mt-4 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Faculty</label>
            <input className={inputClass} value={departmentFaculty} onChange={(e) => setDepartmentFaculty(e.target.value)} placeholder="e.g. Institute of Technology" />
            <button
              type="button"
              onClick={() => void saveDepartment()}
              disabled={isSaving}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {editingDepartmentId ? <Save size={14} /> : <PlusCircle size={14} />}
              {editingDepartmentId ? "Update Department" : "Save Department"}
            </button>
          </div>
          <SimpleTable
            title="Registered Departments"
            icon={<Layers3 size={16} />}
            columns={["Name", "Faculty", "Action"]}
            rows={departments.map((item) => [
              item.name,
              item.faculty,
              <button
                key={`edit-d-${item.id}`}
                type="button"
                className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700"
                onClick={() => {
                  setEditingDepartmentId(item.id);
                  setDepartmentName(item.name);
                  setDepartmentFaculty(item.faculty);
                  setActiveTab("departments");
                }}
              >
                Edit
              </button>,
            ])}
          />
        </div>
      ) : null}

      {activeTab === "assets" ? <AssetManagementPage embedded /> : null}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-6 py-1.5 text-xs font-bold transition-all ${active ? "bg-white text-sky-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
    >
      {label}
    </button>
  );
}

function SimpleTable({
  title,
  icon,
  columns,
  rows,
}: {
  title: string;
  icon: ReactNode;
  columns: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 p-4">
        <span className="text-slate-700">{icon}</span>
        <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-140 text-left">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              {columns.map((column) => (
                <th key={column} className="px-4 py-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="text-sm text-slate-700 hover:bg-slate-50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 font-semibold">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-slate-400" colSpan={columns.length}>
                  No records yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
