"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";

type ProfileResponse = {
  success: boolean;
  profile: {
    fname: string;
    lname: string;
    email: string;
    username: string;
    phone: string;
    department?: { name: string; faculty?: string } | null;
    roles?: Array<{ name: string }>;
    specialties?: Array<{ name: string }>;
  };
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileResponse["profile"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const data = await apiRequest<ProfileResponse>("/api/me/profile", { method: "GET" }, true);
        setProfile(data.profile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile.");
      }
    };
    void run();
  }, []);

  if (error) return <p className="text-sm text-red-600 font-semibold">{error}</p>;
  if (!profile) return <PageSkeleton cards={2} rows={2} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">Profile</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 grid md:grid-cols-2 gap-4 text-sm">
        <div><span className="font-black">Name:</span> {profile.fname} {profile.lname}</div>
        <div><span className="font-black">Username:</span> {profile.username}</div>
        <div><span className="font-black">Email:</span> {profile.email}</div>
        <div><span className="font-black">Phone:</span> {profile.phone}</div>
        <div><span className="font-black">Department:</span> {profile.department?.name ?? "-"}</div>
        <div><span className="font-black">Roles:</span> {profile.roles?.map((r) => r.name).join(", ") || "-"}</div>
        <div className="md:col-span-2"><span className="font-black">Specialties:</span> {profile.specialties?.map((s) => s.name).join(", ") || "-"}</div>
      </div>
    </div>
  );
}
