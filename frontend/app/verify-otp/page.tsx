"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Loader2, Mail, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/api";

type VerifyOtpResponse = {
  success: boolean;
  message: string;
  otp?: string;
  expires_in?: number;
};

export default function VerifyOtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email") ?? "";
  const devOtpFromQuery = searchParams.get("dev_otp") ?? "";

  const [email, setEmail] = useState(emailFromQuery);
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState(devOtpFromQuery);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    setEmail(emailFromQuery);
  }, [emailFromQuery]);

  useEffect(() => {
    if (devOtpFromQuery) setDevOtp(devOtpFromQuery);
  }, [devOtpFromQuery]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  const canResend = useMemo(() => cooldown === 0 && !isResending && !!email.trim(), [cooldown, isResending, email]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit OTP from your email.");
      return;
    }

    setIsVerifying(true);
    try {
      const data = await apiRequest<VerifyOtpResponse>(
        "/api/verify-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        },
        false
      );

      if (data.success) {
        setSuccessMessage(data.message || "OTP verified successfully.");
        setTimeout(() => router.push("/login"), 1600);
      } else {
        setError(data.message || "Verification failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setSuccessMessage("");

    if (!email.trim()) {
      setError("Please enter your email address first.");
      return;
    }

    setIsResending(true);
    try {
      const data = await apiRequest<VerifyOtpResponse>(
        "/api/resend-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
        false
      );

      setSuccessMessage(data.message || "OTP resent successfully.");
      if (data.otp) {
        setDevOtp(data.otp);
      }
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend OTP.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#003366] text-white shadow-lg shadow-slate-900/20">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Verify OTP</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Enter the 6-digit code sent to your email.
          </p>
          {devOtp && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold tracking-wide text-amber-700">
              DEV OTP: {devOtp}
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="p-8">
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-bold text-slate-700">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 font-medium text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="name@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-bold text-slate-700">6-digit OTP</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-2xl font-black tracking-[0.4em] text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-300 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••"
                    autoComplete="one-time-code"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMessage && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#003366] px-4 py-3.5 font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-[#0b4480] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isVerifying ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                <span>{isVerifying ? "Verifying..." : "Verify OTP"}</span>
              </button>
            </form>

            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleResend}
                disabled={!canResend}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResending ? <Loader2 className="animate-spin" size={18} /> : <RotateCcw size={18} />}
                <span>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                </span>
              </button>

              <Link
                href="/login"
                className="text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-slate-700"
              >
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
