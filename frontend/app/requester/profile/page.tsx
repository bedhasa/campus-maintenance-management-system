"use client";

import React, { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { apiRequest, readAuthUser, writeAuthUser } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import {
  User,
  Mail,
  Camera,
  Phone,
  GraduationCap,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Save,
  Edit3,
  X,
  CheckCircle2,
} from "lucide-react";

type ProfileResponse = {
  success: boolean;
  profile: {
    id: number;
    fname: string;
    lname: string;
    username: string;
    email: string;
    university_id_number: string;
    phone: string;
    profile_picture_url?: string | null;
    avg_rating?: number | null;
    total_ratings?: number | null;
    department?: { name: string; faculty: string } | null;
  };
};

type PasswordUpdateResponse = {
  success: boolean;
  message: string;
};

export default function ProfilePage() {
  const { currentUser, t } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success">("idle");

  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [form, setForm] = useState({
    fname: "",
    lname: "",
    username: "",
    email: "",
    university_id_number: "",
    phone: "",
    department: "",
    profilePictureUrl: "",
  });
  const [initialForm, setInitialForm] = useState({
    fname: "",
    lname: "",
    username: "",
    phone: "",
    email: "",
    profilePictureUrl: "",
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [ratingSummary, setRatingSummary] = useState({
    average: 0,
    total: 0,
  });

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ProfileResponse>("/api/me/profile", { method: "GET" }, true);
      const nextForm = {
        fname: data.profile.fname ?? "",
        lname: data.profile.lname ?? "",
        username: data.profile.username ?? "",
        email: data.profile.email ?? "",
        university_id_number: data.profile.university_id_number ?? "",
        phone: data.profile.phone ?? "",
        department: data.profile.department ? `${data.profile.department.name} (${data.profile.department.faculty})` : "",
        profilePictureUrl: data.profile.profile_picture_url ?? "",
      };
      setForm(nextForm);
      setInitialForm({
        fname: nextForm.fname,
        lname: nextForm.lname,
        username: nextForm.username,
        email: nextForm.email,
        phone: nextForm.phone,
        profilePictureUrl: nextForm.profilePictureUrl
      });
      setRatingSummary({
        average: Number(data.profile.avg_rating ?? 0),
        total: Number(data.profile.total_ratings ?? 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const fullName = `${form.fname} ${form.lname}`.trim() || currentUser?.name || "User";
  const effectivePicture = form.profilePictureUrl || currentUser?.profilePicture || "";
  const hasChanges =
    form.fname !== initialForm.fname ||
    form.lname !== initialForm.lname ||
    form.username !== initialForm.username ||
    form.email !== initialForm.email ||
    form.phone !== initialForm.phone ||
    selectedImage !== null;

  const handleCancel = () => {
    setForm((prev) => ({
      ...prev,
      fname: initialForm.fname,
      lname: initialForm.lname,
      username: initialForm.username,
      email: initialForm.email,
      phone: initialForm.phone,
      profilePictureUrl: initialForm.profilePictureUrl,
    }));
    setSelectedImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setIsEditing(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setError(null);
    setSelectedImage(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const newPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(newPreviewUrl);
    setForm((prev) => ({ ...prev, profilePictureUrl: newPreviewUrl }));
  };

  const handleSaveProfile = async () => {
    setSaveStatus("saving");
    setError(null);
    try {
      const body = new FormData();
      body.append("_method", "PUT");
      body.append("fname", form.fname.trim());
      body.append("lname", form.lname.trim());
      body.append("email", form.email.trim());
      body.append("username", form.username.trim().toLowerCase());
      body.append("phone", form.phone.trim());
      if (selectedImage) body.append("profile_picture", selectedImage);

      const data = await apiRequest<ProfileResponse>(
        "/api/me/profile",
        { method: "POST", body },
        true,
      );

      const updatedPicture = data.profile.profile_picture_url ?? "";
      const authUser = readAuthUser<Record<string, unknown>>() ?? {};
      const mergedStoredUser = {
        ...(JSON.parse(localStorage.getItem("user") || "{}") as Record<string, unknown>),
        ...authUser,
        fname: data.profile.fname,
        lname: data.profile.lname,
        username: data.profile.username,
        email: data.profile.email,
        phone: data.profile.phone,
        university_id_number: data.profile.university_id_number,
        department: data.profile.department,
        profile_picture_url: updatedPicture,
        profilePicture: updatedPicture,
      };

      localStorage.setItem("user", JSON.stringify(mergedStoredUser));
      writeAuthUser(mergedStoredUser);

      const finalData = {
        fname: data.profile.fname,
        lname: data.profile.lname,
        username: data.profile.username,
        email: data.profile.email,
        phone: data.profile.phone,
        profilePictureUrl: updatedPicture
      };
      setForm(prev => ({ ...prev, ...finalData }));
      setInitialForm(finalData);
      setSelectedImage(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2500);
      setIsEditing(false);
    } catch (err) {
      setSaveStatus("idle");
      setError(err instanceof Error ? err.message : "Failed to update profile data.");
    }
  };

  const handleUpdatePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError("Please fill all password fields.");
      return;
    }

    try {
      const data = await apiRequest<PasswordUpdateResponse>(
        "/api/me/password",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            current_password: passwordForm.currentPassword,
            password: passwordForm.newPassword,
            password_confirmation: passwordForm.confirmPassword,
          }),
        },
        true,
      );
      setPasswordSuccess(data.message || "Password updated successfully.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password.");
    }
  };

  if (loading) {
    return <PageSkeleton cards={2} rows={4} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-4 md:px-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">{t("profile")}</h1>
          <p className="text-xs text-slate-500 mt-2 font-medium">Manage your identity and HU credentials</p>
        </div>

        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 bg-white border-2 border-slate-200 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all active:scale-95 shadow-sm"
          >
            <Edit3 size={14} /> Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 bg-slate-100 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-all active:scale-95"
            >
              <X size={14} /> Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={saveStatus === "saving"}
              className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95
                ${saveStatus === "success" ? "bg-green-500 text-white" : "bg-slate-900 text-white hover:bg-blue-600"}`}
            >
              {saveStatus === "saving" ? (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : saveStatus === "success" ? (
                <CheckCircle2 size={14} />
              ) : (
                <Save size={14} />
              )}
              <span>{saveStatus === "saving" ? "Saving..." : saveStatus === "success" ? "Updated!" : "Save Changes"}</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border-2 border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700 flex items-center gap-3">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-20 bg-[#003366]" />
            <div className="relative z-10 pt-4">
              <div className="w-20 h-20 rounded-2xl bg-blue-50 border-4 border-white mx-auto flex items-center justify-center text-[#003366] text-2xl font-black shadow-md relative group overflow-hidden">
                {effectivePicture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={effectivePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  fullName.charAt(0)
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-[#003366] text-white rounded-lg shadow-lg border-2 border-white opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Camera size={12} />
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />

              <h2 className="text-lg font-black text-slate-900 mt-4 leading-tight">{fullName}</h2>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">
                {(currentUser?.role || "requester").replace("_", " ")}
              </p>

              <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between">
                <div>
                  <p className="text-base font-black text-slate-900">HU</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Affiliation</p>
                </div>
                <div className="w-px bg-slate-100" />
                <div>
                  <p className="text-base font-black text-green-600">Active</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Status</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100 flex items-start space-x-3">
            <AlertCircle size={18} className="text-orange-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-orange-700 font-medium leading-relaxed">
              {t("securityNote") || "Security: Do not share your HU credentials with anyone."}
            </p>
          </div>

          {currentUser?.role === "technician" && (
            <div className="rounded-2rem border border-amber-100 bg-amber-50 p-5 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-700">
                Average Rating
              </p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-black leading-none text-slate-900">
                    {ratingSummary.total > 0 ? ratingSummary.average.toFixed(1) : "0.0"}
                  </p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-amber-800">
                    {ratingSummary.total} {ratingSummary.total === 1 ? "review" : "reviews"}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-white px-3 py-2 text-right">
                  <p className="text-xs font-black text-amber-700">/ 5.0</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    Requester Score
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-8 flex items-center">
              <User size={16} className="mr-2 text-blue-600" /> Account Details
            </h3>

            <div className="grid sm:grid-cols-2 gap-y-8 gap-x-8">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("firstName") || "First Name"}</label>
                {isEditing ? (
                   <input
                    type="text"
                    value={form.fname}
                    onChange={(e) => setForm((p) => ({ ...p, fname: e.target.value }))}
                    className="w-full px-4 py-3.5 bg-white rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none font-bold text-slate-900 transition-all text-sm"
                  />
                ) : (
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 text-slate-900 font-bold text-sm">{form.fname}</div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("lastName") || "Last Name"}</label>
                {isEditing ? (
                   <input
                    type="text"
                    value={form.lname}
                    onChange={(e) => setForm((p) => ({ ...p, lname: e.target.value }))}
                    className="w-full px-4 py-3.5 bg-white rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none font-bold text-slate-900 transition-all text-sm"
                  />
                ) : (
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 text-slate-900 font-bold text-sm">{form.lname}</div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("username")}</label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm group-focus-within:text-blue-600 transition-colors">@</span>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value.toLowerCase().replace(/\s/g, "") }))}
                    className="w-full pl-9 pr-4 py-3.5 bg-white rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none font-bold text-slate-900 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("universityId")}</label>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-900 font-bold text-sm">
                  {form.university_id_number}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("department")}</label>
                <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <GraduationCap size={16} className="text-slate-400" />
                  <p className="text-slate-900 font-bold text-sm">{form.department}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("phoneNumber")}</label>
                <div className="relative group">
                  <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full pl-11 pr-4 py-3.5 bg-white rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none font-bold text-slate-900 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("universityEmail")}</label>
                {isEditing ? (
                  <div className="relative group">
                    <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      className="w-full pl-11 pr-4 py-3.5 bg-white rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none font-bold text-slate-900 transition-all text-sm"
                    />
                  </div>
                ) : (
                  <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 overflow-hidden">
                    <Mail size={16} className="text-slate-400 shrink-0" />
                    <p className="text-slate-900 font-bold text-sm truncate">{form.email}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-8 flex items-center">
              <Lock size={16} className="mr-2 text-blue-600" /> Security Credentials
            </h3>

            {passwordError && <p className="text-sm font-bold text-red-600 mb-4">{passwordError}</p>}
            {passwordSuccess && <p className="text-sm font-bold text-emerald-600 mb-4">{passwordSuccess}</p>}

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("currentPassword")}</label>
                <div className="relative">
                  <input
                    type={showCurrentPwd ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-4 focus:ring-blue-500/5 font-bold text-sm text-slate-900 placeholder:text-slate-400"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowCurrentPwd(!showCurrentPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600">
                    {showCurrentPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("newPassword")}</label>
                  <div className="relative">
                    <input
                      type={showNewPwd ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                      className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-4 focus:ring-blue-500/5 font-bold text-sm text-slate-900 placeholder:text-slate-400"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600">
                      {showNewPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("confirmNewPassword")}</label>
                  <div className="relative">
                    <input
                      type={showConfirmPwd ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                      className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-4 focus:ring-blue-500/5 font-bold text-sm text-slate-900 placeholder:text-slate-400"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600">
                      {showConfirmPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleUpdatePassword}
                className="w-full py-4 bg-[#003366] text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-blue-900/20 hover:bg-blue-900 transition-all active:scale-[0.98]"
              >
                Update Security Credentials
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
