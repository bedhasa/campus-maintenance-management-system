"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";

export default function RoutePage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setSuccess(null);
    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest(
        "/api/requester/settings/password",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            current_password: currentPassword,
            password,
            password_confirmation: confirmPassword,
          }),
        },
        true
      );
      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update password.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 max-w-xl">
      <h1 className="text-3xl font-black text-gray-900 leading-none">Settings</h1>
      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      {success && <p className="text-sm text-emerald-600 font-bold">{success}</p>}

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          className="w-full p-3 rounded-xl border border-gray-200"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="w-full p-3 rounded-xl border border-gray-200"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          className="w-full p-3 rounded-xl border border-gray-200"
        />
        <button onClick={save} disabled={saving} className="px-5 py-3 rounded-xl bg-[#003366] text-white text-xs font-black uppercase tracking-widest">
          {saving ? "Saving..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}
