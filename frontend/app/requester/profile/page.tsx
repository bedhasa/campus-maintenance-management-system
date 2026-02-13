"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type ProfileResponse = {
  success: boolean;
  profile: {
    fname: string;
    lname: string;
    username: string;
    email: string;
    university_id_number: string;
    phone: string;
    department?: { name: string; faculty: string } | null;
  };
};

export default function RoutePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    fname: "",
    lname: "",
    phone: "",
    username: "",
    email: "",
    university_id_number: "",
    department: "",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<ProfileResponse>("/api/requester/profile", { method: "GET" }, true);
        setForm({
          fname: data.profile.fname ?? "",
          lname: data.profile.lname ?? "",
          phone: data.profile.phone ?? "",
          username: data.profile.username ?? "",
          email: data.profile.email ?? "",
          university_id_number: data.profile.university_id_number ?? "",
          department: data.profile.department ? `${data.profile.department.name} (${data.profile.department.faculty})` : "",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load profile.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(
        "/api/requester/profile",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fname: form.fname,
            lname: form.lname,
            phone: form.phone,
          }),
        },
        true
      );
      setSuccess("Profile updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 max-w-2xl">
      <h1 className="text-3xl font-black text-gray-900 leading-none">Profile</h1>
      {loading && <p className="text-sm text-gray-500 font-medium">Loading profile...</p>}
      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      {success && <p className="text-sm text-emerald-600 font-bold">{success}</p>}

      {!loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <input className="p-3 rounded-xl border border-gray-200" value={form.fname} onChange={(e) => setForm((p) => ({ ...p, fname: e.target.value }))} />
            <input className="p-3 rounded-xl border border-gray-200" value={form.lname} onChange={(e) => setForm((p) => ({ ...p, lname: e.target.value }))} />
            <input className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-600" value={form.username} readOnly />
            <input className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-600" value={form.email} readOnly />
            <input className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-600" value={form.university_id_number} readOnly />
            <input className="p-3 rounded-xl border border-gray-200" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <input className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-600" value={form.department} readOnly />
          <button onClick={save} disabled={saving} className="px-5 py-3 rounded-xl bg-[#003366] text-white text-xs font-black uppercase tracking-widest">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
