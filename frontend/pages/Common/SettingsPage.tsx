"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";

type SettingsResponse = {
  success: boolean;
  settings: {
    language: "en" | "am";
    dark_mode: boolean;
    font_size: "small" | "medium" | "large";
    default_dashboard_filter: string;
    timezone: string;
    notifications: { status: boolean; chat: boolean; feedback: boolean };
  };
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse["settings"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const data = await apiRequest<SettingsResponse>("/api/me/settings", { method: "GET" }, true);
        setSettings(data.settings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings.");
      }
    };
    void run();
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await apiRequest("/api/me/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      }, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="text-sm text-red-600 font-semibold">{error}</p>;
  if (!settings) return <PageSkeleton cards={2} rows={2} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">Settings</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 grid md:grid-cols-2 gap-4 text-sm">
        <label className="flex flex-col gap-2">
          <span className="font-black">Language</span>
          <select value={settings.language} onChange={(e) => setSettings({ ...settings, language: e.target.value as "en" | "am" })} className="border rounded-lg p-2">
            <option value="en">English</option>
            <option value="am">Amharic</option>
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-black">Default Dashboard Filter</span>
          <input value={settings.default_dashboard_filter} onChange={(e) => setSettings({ ...settings, default_dashboard_filter: e.target.value })} className="border rounded-lg p-2" />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.notifications.status} onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, status: e.target.checked } })} />
          <span>Status notifications</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.notifications.chat} onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, chat: e.target.checked } })} />
          <span>Chat notifications</span>
        </label>
      </div>
      <button onClick={save} disabled={saving} className="px-4 py-2 bg-[#003366] text-white rounded-xl text-sm font-bold">
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
