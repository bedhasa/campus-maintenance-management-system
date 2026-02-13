import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <h1 className="text-4xl font-bold text-slate-900 mb-6">
        CMMS – Maintenance Management System
      </h1>
      <p className="text-slate-700 mb-6 text-center">
        Welcome! Please login or register to continue.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Login
        </Link>
        <Link
          href="/register"
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Register
        </Link>
      </div>
    </div>
  );
}
