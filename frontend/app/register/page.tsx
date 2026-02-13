"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  User, 
  Mail, 
  Lock, 
  Phone, 
  Building2, 
  IdCard, 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck
} from "lucide-react";
import { apiRequest, writeAuthToken, writeAuthUser } from "@/lib/api";

type Department = { id: number; name: string; faculty: string };
type Role = { id: number; name: string; description: string };
type RegisterResponse = {
  success: boolean;
  message: string;
  token: string;
  requires_role_selection: boolean;
  user: {
    id: number;
    fname: string;
    lname: string;
    email: string;
    roles: Role[];
    active_role: string | null;
  };
};

export default function RegistrationForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    fname: "",
    lname: "",
    username: "",
    email: "",
    university_id_number: "",
    dept_id: "",
    phone: "",
    password: "",
    password_confirmation: "",
  });

  // Auto-hide error after 8 seconds
  useEffect(() => {
    if (localError) {
      const timer = setTimeout(() => setLocalError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [localError]);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [deptRes, roleRes] = await Promise.all([
          apiRequest<{ departments: Department[] }>("/api/departments", { method: "GET" }),
          apiRequest<{ roles: Role[] }>("/api/roles", { method: "GET" }),
        ]);
        setDepartments(deptRes.departments ?? []);
        setRoles(roleRes.roles ?? []);
      } catch {
        setLocalError("Unable to load departments or roles. Please refresh.");
      }
    };

    loadMeta();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setLocalError(null);
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const validateStep = (s: number) => {
    if (s === 1) return formData.fname && formData.lname && formData.username && formData.email;
    if (s === 2) return formData.university_id_number && formData.dept_id && formData.phone && selectedRoles.length > 0;
    if (s === 3) return formData.password && formData.password_confirmation;
    return true;
  };

  const nextStep = () => {
    if (!validateStep(step)) {
      setLocalError("Please fill in all required fields for this step.");
      return;
    }
    setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) {
      setLocalError("Please confirm your security settings.");
      return;
    }
    if (formData.password !== formData.password_confirmation) {
      setLocalError("Passwords do not match!");
      return;
    }

    setIsLoading(true);
    
    try {
      const data = await apiRequest<RegisterResponse>(
        "/api/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fname: formData.fname,
            lname: formData.lname,
            username: formData.username,
            email: formData.email,
            university_id_number: formData.university_id_number,
            dept_id: Number(formData.dept_id),
            phone: formData.phone,
            password: formData.password,
            password_confirmation: formData.password_confirmation,
            role_ids: selectedRoles,
          }),
        },
        false
      );

      writeAuthToken(data.token);
      writeAuthUser(data.user);
      setSuccessMessage("Account created successfully! Please sign in.");
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed.";
      setLocalError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const progressPercentage = (step / 3) * 100;
  const inputClass = "w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-400 text-slate-900 font-medium shadow-sm";

  return (
    <div className="min-h-screen py-12 flex items-center justify-center p-4 bg-slate-50 text-slate-900">
      <div className="w-full max-w-lg">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-900 rounded-2xl shadow-lg mb-4 text-white font-bold text-3xl transform hover:rotate-3 transition-transform">
            U
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create Account</h1>
          <p className="text-slate-500 mt-2 font-medium">Join the Facilities Management System</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8 px-2">
          <div className="flex justify-between mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>Step {step} of 3</span>
            <span>{Math.round(progressPercentage)}% Complete</span>
          </div>
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div 
              className="h-full bg-blue-600 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(37,99,235,0.4)]"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-8">
            
            <form onSubmit={handleSubmit}>
              {/* STEP 1: Personal */}
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <h2 className="text-xl font-bold text-slate-800 mb-6 border-l-4 border-blue-900 pl-3">Personal Information</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 ml-1" htmlFor="fname">First Name</label>
                      <input id="fname" className={inputClass.replace('pl-10', 'pl-4')} placeholder="John" value={formData.fname} onChange={handleChange} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 ml-1" htmlFor="lname">Last Name</label>
                      <input id="lname" className={inputClass.replace('pl-10', 'pl-4')} placeholder="Doe" value={formData.lname} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 ml-1" htmlFor="username">Username</label>
                    <div className="relative">
                       <User className="absolute left-3 top-3 text-slate-400" size={18} />
                       <input id="username" className={inputClass} placeholder="jdoe24" value={formData.username} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 ml-1" htmlFor="email">University Email</label>
                    <div className="relative">
                       <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                       <input id="email" type="email" className={inputClass} placeholder="name@university.edu" value={formData.email} onChange={handleChange} />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: University Details */}
              {step === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <h2 className="text-xl font-bold text-slate-800 mb-6 border-l-4 border-blue-900 pl-3">University Details</h2>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 ml-1" htmlFor="university_id_number">University ID Number</label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input id="university_id_number" placeholder="e.g. 7654321" className={inputClass} value={formData.university_id_number} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 ml-1" htmlFor="dept_id">Department</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 text-slate-400" size={18} />
                      <select id="dept_id" className={`${inputClass} appearance-none`} value={formData.dept_id} onChange={handleChange}>
                        <option value="">Select Department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} ({dept.faculty})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 ml-1" htmlFor="phone">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input id="phone" type="tel" className={inputClass} placeholder="+1 (555) 000-0000" value={formData.phone} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Select Role(s)</label>
                    <div className="grid grid-cols-2 gap-3">
                      {roles.map((role) => {
                        const selected = selectedRoles.includes(role.id);
                        return (
                          <button
                            type="button"
                            key={role.id}
                            onClick={() => {
                              setLocalError(null);
                              setSelectedRoles((prev) =>
                                prev.includes(role.id)
                                  ? prev.filter((id) => id !== role.id)
                                  : [...prev, role.id]
                              );
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                              selected ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-blue-300"
                            }`}
                          >
                            <ShieldCheck size={14} />
                            <span>{role.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      Choose one or more roles to enable role selection after login.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 3: Security */}
              {step === 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <h2 className="text-xl font-bold text-slate-800 mb-6 border-l-4 border-blue-900 pl-3">Security Settings</h2>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 ml-1" htmlFor="password">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input id="password" type={showPassword ? "text" : "password"} className={inputClass} placeholder="Create a secure password" value={formData.password} onChange={handleChange} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-400">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 ml-1" htmlFor="password_confirmation">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input id="password_confirmation" type={showConfirmPassword ? "text" : "password"} className={inputClass} placeholder="Repeat your password" value={formData.password_confirmation} onChange={handleChange} />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-3 text-slate-400">
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Message Area */}
              <div className="min-h-15 mt-6 transition-all">
                {localError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={18} className="shrink-0" />
                    {localError}
                  </div>
                )}
                {successMessage && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 size={18} className="shrink-0" />
                    {successMessage}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 flex space-x-3">
                {step > 1 && (
                  <button 
                    type="button" 
                    onClick={prevStep}
                    className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <ChevronLeft size={18} /> Back
                  </button>
                )}
                
                {step < 3 ? (
                  <button 
                    type="button" 
                    onClick={nextStep}
                    className="flex-2 py-3 bg-blue-900 text-white font-bold rounded-xl hover:bg-blue-950 transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    Next Step <ChevronRight size={18} />
                  </button>
                ) : (
                  <button 
                    type="submit"
                    disabled={isLoading} 
                    className="flex-2 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Complete Registration"}
                  </button>
                )}
              </div>
            </form>

            <div className="mt-8 text-center border-t border-slate-100 pt-6">
              <p className="text-sm text-slate-500 font-medium">
                Already have an account? <Link href="/login" className="text-blue-600 font-bold hover:underline">Sign In</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
