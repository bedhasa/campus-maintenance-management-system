"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Mail, Loader2, ArrowLeft, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";
import { apiRequest } from "@/lib/api";

type ForgotPasswordResponse = {
  success: boolean;
  message: string;
};

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  // Auto-hide error after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const data = await apiRequest<ForgotPasswordResponse>(
        "/api/forgot-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
        false
      );
      setSuccessMessage(data.message || "Recovery instructions sent! Please check your inbox.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send reset link.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 text-slate-900">
      <div className="w-full max-w-md">
        {/* Header/Branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-900 rounded-3xl shadow-lg mb-4 text-white">
            <KeyRound size={40} />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Recover Access</h1>
          <p className="text-slate-500 mt-2 font-medium">Enter your email to receive a reset link</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden transition-all">
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 ml-1" htmlFor="email">
                  University Email
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <Mail size={18} />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="name@university.edu"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-400 font-medium shadow-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-blue-900 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-950 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Sending Link...</span>
                  </>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>

              {/* Status Messages */}
              <div className="min-h-12.5 transition-all">
                {error && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-semibold flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {successMessage && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-semibold animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="shrink-0" />
                      <span>{successMessage}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-emerald-200/50">
                      <Link 
                        href="/reset-password" 
                        className="text-xs font-bold underline decoration-emerald-500/50 hover:text-emerald-800 transition-colors"
                      >
                        Demo: Go to Reset Page →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Back */}
              <div className="pt-2 text-center">
                <Link 
                  href="/login" 
                  className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-700 group transition-all"
                >
                  <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                  Back to Login
                </Link>
              </div>
            </form>
          </div>

          {/* Bottom Help Text */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
               CMMS Support: +1 (555) HELP-001
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
