"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Mail, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { apiRequest, writeAuthToken, writeAuthUser } from "@/lib/api";
import { normalizeUserRole, roleDashboardPath } from "@/lib/role-routes";

type AuthUser = {
  id: number;
  fname: string;
  lname: string;
  username: string;
  email: string;
  roles: { id: number; name: string; description: string }[];
  active_role: string | null;
};

type LoginResponse = {
  success: boolean;
  message: string;
  token: string;
  requires_role_selection: boolean;
  user: AuthUser;
};

export default function LoginForm() {
  const router = useRouter();
 const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Auto-hide error after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const data = await apiRequest<LoginResponse>(
        "/api/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login, password }),
        },
        false
      );

      writeAuthToken(data.token);
      writeAuthUser(data.user);

      const roleNames = (data.user.roles ?? []).map((r) => r.name.toLowerCase());
      const hasSupervisorAdmin = roleNames.includes("supervisor") && roleNames.includes("admin");

      if (data.requires_role_selection && !hasSupervisorAdmin) {
        setSuccessMessage("Login successful. Select your role to continue.");
        setIsTransitioning(true);
        setTimeout(() => router.push("/role-selector"), 1200);
        return;
      }

      const activeRoleName = data.user.active_role ?? data.user.roles?.[0]?.name ?? "";
      if (activeRoleName) {
        const normalizedRole = normalizeUserRole(activeRoleName);
        const destination = normalizedRole ? roleDashboardPath(normalizedRole) : "/requester/dashboard";
        setSuccessMessage("Identity verified. Welcome back!");
        setIsTransitioning(true);
        setTimeout(() => router.push(destination), 1200);
      } else {
        setError("No active role assigned. Please contact support.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Full-screen Transition (Success State)
  if (isTransitioning) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center animate-in fade-in zoom-in duration-500">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-emerald-500 rounded-full shadow-xl mb-6 text-white">
            <CheckCircle2 size={48} strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Access Granted</h2>
          <p className="text-slate-500 mt-2 font-medium">Preparing your personalized dashboard...</p>
        </div>
      </div>
    );
  }

  const inputClass = "block w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-400 text-slate-900 font-medium shadow-sm";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md">
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-900 rounded-2xl shadow-lg mb-4 text-white font-bold text-4xl transform hover:rotate-3 transition-transform">
            U
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">University CMMS</h1>
          <p className="text-slate-500 mt-2 font-medium">Facilities Management Portal</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome Back</h2>
            <p className="text-slate-500 text-sm mb-8">Enter your credentials to access the system.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 ml-1">University Email/Usrename</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <Mail size={18} />
                  </div>
                  <input
                    type="text"
                       required
                       className={inputClass}
                       placeholder="Email or Username"
                       value={login}
                      onChange={(e) => setLogin(e.target.value)}
                    />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-sm font-semibold text-slate-700">Password</label>
                  <Link href="/forgot-password" className="text-xs font-bold text-blue-600 hover:text-blue-700">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className={inputClass}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-blue-900 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-950 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            {/* Notification Area */}
            <div className="mt-6 min-h-12.5 transition-all">
              {error && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-semibold flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {successMessage && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-semibold flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}
            </div>

            {/* Footer Links */}
            <div className="mt-4 text-center">
              <p className="text-sm text-slate-500">
                New to the system?{" "}
                <Link href="/register" className="text-blue-600 font-bold hover:underline">
                  Register Account
                </Link>
              </p>
            </div>
          </div>

          {/* Demo Badge */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center items-center gap-4">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                Demo Credentials
              </span>
              <code className="text-[10px] text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                technician@demo.com | 123456
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
