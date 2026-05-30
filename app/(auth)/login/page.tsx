export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#f9fafb" }}
    >
      <div
        className="bg-white rounded-xl p-8 w-full max-w-sm"
        style={{ border: "1px solid #f3f4f6", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)" }}
      >
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: "#111827" }}>
            Sign in
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
            Access your CRM dashboard
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <label
              className="text-xs font-medium block mb-1"
              style={{ color: "#374151" }}
            >
              Email
            </label>
            <input
              type="email"
              placeholder="you@company.com"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
              style={{ border: "1px solid #e5e7eb", color: "#111827" }}
            />
          </div>
          <div>
            <label
              className="text-xs font-medium block mb-1"
              style={{ color: "#374151" }}
            >
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
              style={{ border: "1px solid #e5e7eb", color: "#111827" }}
            />
          </div>
          <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
