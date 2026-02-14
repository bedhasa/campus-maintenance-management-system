"use client";

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">Help & Support</h1>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-sm text-slate-700">
        <p className="font-bold text-slate-900">FAQ</p>
        <p>1. How to track a request? Open your dashboard and click the request ID.</p>
        <p>2. How to contact admin? Email `admin@hu.edu.et` with request details.</p>
        <p>3. How to report a system issue? Use the form below.</p>
      </div>
      <form className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
        <p className="font-bold text-slate-900">Report System Issue</p>
        <input className="w-full border rounded-lg p-2 text-sm" placeholder="Issue title" />
        <textarea className="w-full border rounded-lg p-2 text-sm min-h-28" placeholder="Describe the issue" />
        <button type="button" className="px-4 py-2 bg-[#003366] text-white rounded-xl text-sm font-bold">Submit</button>
      </form>
    </div>
  );
}

