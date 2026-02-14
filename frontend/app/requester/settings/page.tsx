"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bell, Globe, Zap, Save, CheckCircle2, Clock, Sparkles, AlertCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { apiRequest } from "@/lib/api";

type Building = { id: number; name: string };
type Room = { id: number; building_id: number; name: string };

type SettingsResponse = {
  success: boolean;
  settings: {
    language: "en" | "am";
    dark_mode: boolean;
    font_size: "small" | "medium" | "large";
    notifications: { status: boolean; chat: boolean; feedback: boolean };
    default_location: {
      building_id: number | null;
      room_id: number | null;
    };
    timezone: string;
  };
};

type BuildingsResponse = { success: boolean; buildings: Building[] };
type RoomsResponse = { success: boolean; rooms: Room[] };

type FontSize = "small" | "medium" | "large";

const applyDisplayPrefs = (darkMode: boolean, fontSize: FontSize) => {
  const root = document.documentElement;
  root.setAttribute("data-theme", darkMode ? "dark" : "light");
  root.setAttribute("data-font-size", fontSize);
};

export default function SettingsPage() {
  const { language, setLanguage, t } = useApp();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("medium");
  const [notifications, setNotifications] = useState({
    status: true,
    chat: true,
    feedback: true,
  });
  const [defaultLoc, setDefaultLoc] = useState({
    building: "",
    room: "",
  });
  const [timezone, setTimezone] = useState("Africa/Addis_Ababa");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [settingsData, buildingsData] = await Promise.all([
          apiRequest<SettingsResponse>("/api/requester/settings", { method: "GET" }, true),
          apiRequest<BuildingsResponse>("/api/requester/meta/buildings", { method: "GET" }, true),
        ]);

        setBuildings(buildingsData.buildings ?? []);
        setLanguage(settingsData.settings.language);
        setIsDarkMode(settingsData.settings.dark_mode);
        setFontSize(settingsData.settings.font_size);
        setNotifications(settingsData.settings.notifications);
        setDefaultLoc({
          building: settingsData.settings.default_location.building_id ? String(settingsData.settings.default_location.building_id) : "",
          room: settingsData.settings.default_location.room_id ? String(settingsData.settings.default_location.room_id) : "",
        });
        setTimezone(settingsData.settings.timezone || "Africa/Addis_Ababa");
        applyDisplayPrefs(settingsData.settings.dark_mode, settingsData.settings.font_size);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [setLanguage]);

  useEffect(() => {
    applyDisplayPrefs(isDarkMode, fontSize);
  }, [isDarkMode, fontSize]);

  useEffect(() => {
    const run = async () => {
      if (!defaultLoc.building) {
        setRooms([]);
        setDefaultLoc((prev) => ({ ...prev, room: "" }));
        return;
      }
      try {
        const data = await apiRequest<RoomsResponse>(
          `/api/requester/meta/rooms?building_id=${defaultLoc.building}`,
          { method: "GET" },
          true,
        );
        setRooms(data.rooms ?? []);
        if (defaultLoc.room && !data.rooms?.some((room) => String(room.id) === defaultLoc.room)) {
          setDefaultLoc((prev) => ({ ...prev, room: "" }));
        }
      } catch {
        setRooms([]);
      }
    };
    void run();
  }, [defaultLoc.building, defaultLoc.room]);

  const selectedBuildingName = useMemo(
    () => buildings.find((b) => String(b.id) === defaultLoc.building)?.name ?? "",
    [buildings, defaultLoc.building],
  );
  const selectedRoomName = useMemo(
    () => rooms.find((r) => String(r.id) === defaultLoc.room)?.name ?? "",
    [rooms, defaultLoc.room],
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(
        "/api/requester/settings",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language,
            dark_mode: isDarkMode,
            font_size: fontSize,
            notifications: notifications,
            default_location: {
              building_id: defaultLoc.building ? Number(defaultLoc.building) : null,
              room_id: defaultLoc.room ? Number(defaultLoc.room) : null,
            },
            timezone,
          }),
        },
        true,
      );
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ active, onToggle, label, sub }: { active: boolean; onToggle: () => void; label: string; sub: string }) => (
    <div className="flex items-center justify-between py-4">
      <div className="flex-1">
        <h4 className="text-sm font-bold text-slate-900">{label}</h4>
        <p className="text-[10px] text-slate-400 font-medium">{sub}</p>
      </div>
      <button onClick={onToggle} className={`w-12 h-6 rounded-full relative transition-all duration-300 ${active ? "bg-[#003366]" : "bg-slate-200"}`}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${active ? "right-1" : "left-1"}`} />
      </button>
    </div>
  );

  if (loading) {
    return <p className="text-sm font-medium text-slate-500">Loading settings...</p>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 px-4 md:px-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 leading-none tracking-tight">{t("settings") || "Settings"}</h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">Personalize your maintenance hub experience</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center justify-center space-x-2 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl active:scale-95 ${isSaved ? "bg-emerald-500 text-white" : "bg-[#003366] text-white hover:bg-blue-900"} ${saving ? "opacity-70" : ""}`}
        >
          {isSaved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          <span>{isSaved ? "Preferences Saved" : saving ? "Saving..." : t("saveSettings") || "Save Preferences"}</span>
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 font-bold flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-8">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center">
            <Globe size={16} className="mr-2 text-blue-600" /> {t("displayAccessibility") || "Display & Localization"}
          </h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("selectLanguage") || "System Language"}</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-2xl">
                <button onClick={() => setLanguage("en")} className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${language === "en" ? "bg-[#003366] text-white shadow-lg" : "text-slate-400 hover:text-slate-600"}`}>English</button>
                <button onClick={() => setLanguage("am")} className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${language === "am" ? "bg-[#003366] text-white shadow-lg" : "text-slate-400 hover:text-slate-600"}`}>አማርኛ</button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("fontSize") || "Text Scaling"}</label>
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1.5 rounded-2xl">
                {(["small", "medium", "large"] as FontSize[]).map((size) => (
                  <button key={size} onClick={() => setFontSize(size)} className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${fontSize === size ? "bg-white text-[#003366] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>{size}</button>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-slate-50">
              <Toggle active={isDarkMode} onToggle={() => setIsDarkMode((p) => !p)} label={t("darkMode") || "Dark Mode"} sub="Optimize interface for low-light environments" />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-8">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center">
            <Bell size={16} className="mr-2 text-blue-600" /> {t("notificationSettings") || "Notifications"}
          </h2>
          <div className="space-y-2 divide-y divide-slate-50">
            <Toggle active={notifications.status} onToggle={() => setNotifications((n) => ({ ...n, status: !n.status }))} label={t("statusUpdates") || "Status Updates"} sub="Alert when your request moves to 'In Progress' or 'Completed'" />
            <Toggle active={notifications.chat} onToggle={() => setNotifications((n) => ({ ...n, chat: !n.chat }))} label={t("chatMessages") || "Technician Chat"} sub="Notify when a technician sends a message regarding your fault" />
            <Toggle active={notifications.feedback} onToggle={() => setNotifications((n) => ({ ...n, feedback: !n.feedback }))} label={t("feedbackReminders") || "Completion Surveys"} sub="Remind me to rate performance after a job is closed" />
          </div>
        </section>

        <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 md:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center">
              <Zap size={16} className="mr-2 text-blue-600" /> {t("defaultSubmission") || "Request Shortcuts"}
            </h2>
            <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest italic">Fast Track Reporting</div>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">Set your primary location to auto-fill the Report Issue form.</p>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("defaultBuilding") || "Main Building"}</label>
                  <select value={defaultLoc.building} onChange={(e) => setDefaultLoc((prev) => ({ ...prev, building: e.target.value, room: "" }))} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-sm appearance-none text-slate-900">
                    <option value="">No Default</option>
                    {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("defaultRoom") || "Room / Office"}</label>
                  <select value={defaultLoc.room} onChange={(e) => setDefaultLoc((prev) => ({ ...prev, room: e.target.value }))} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-sm appearance-none text-slate-900" disabled={!defaultLoc.building}>
                    <option value="">{defaultLoc.building ? "No Default Room" : "Select building first"}</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
              <div className="flex items-center space-x-3 mb-4 relative z-10">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm"><Sparkles size={18} /></div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Automation Preview</h4>
              </div>
              <div className="space-y-3 opacity-60 relative z-10">
                <div className="h-10 w-full bg-white rounded-xl border border-slate-100 flex items-center px-4 text-[10px] font-bold text-blue-600 truncate">
                  {selectedBuildingName || "Auto-select Building..."}
                </div>
                <div className="h-10 w-full bg-white rounded-xl border border-slate-100 flex items-center px-4 text-[10px] font-bold text-blue-600">
                  {selectedRoomName || "Auto-fill Room..."}
                </div>
              </div>
              <p className="mt-6 text-[9px] text-slate-400 font-bold uppercase text-center tracking-widest italic relative z-10">Changes apply to the next request you create</p>
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors" />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 md:col-span-2">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl"><Clock size={20} /></div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{t("timezone") || "System Clock"}</h3>
                <p className="text-xs text-slate-400 font-medium">Choose timezone used for schedule displays</p>
              </div>
            </div>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full md:w-72 p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-[11px] uppercase tracking-widest appearance-none text-slate-900">
              <option value="Africa/Addis_Ababa">(GMT+03:00) Addis Ababa / Hawassa</option>
              <option value="UTC">(UTC) Coordinated Universal Time</option>
            </select>
          </div>
        </section>
      </div>

      <div className="text-center pt-8">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">HU-CMMS • Version 3.1.0 • Built for Maintenance Excellence</p>
      </div>
    </div>
  );
}

