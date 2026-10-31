
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, roleAccounts } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import Logo from "./Logo";

const dashboardPaths = {
  member: "/dashboard",
  admin: "/admin",
};

const roles = {
  member: {
    label: "Member",
    heading: "Sign in",
    note: "Welcome back. Sign in to see your meetings.",
  },
  admin: {
    label: "Admin",
    heading: "Admin sign in",
    note: "Restricted area. Only for system administrators.",
  },
};

function LoginForm({ initialRole = "member" }) {
  const { login, updateProfile } = useAuth();
  const { staffProfiles, addLog } = useData();
  const navigate = useNavigate();

  const [role, setRole] = useState(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [secretKey, setSecretKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function pickRole(r) {
    setRole(r);
    setSecretKey("");
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    console.log("LOGIN FORM SUBMITTED");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (role === "admin" && !secretKey.trim()) {
      setError("Please enter the admin secret key.");
      return;
    }

    setLoading(true);

    try {
      console.log("CALLING AUTH LOGIN", {
        email: email.trim(),
        role,
        usingMock: !import.meta.env.VITE_API_URL,
      });

      // Authenticate through AuthContext and the Django API.
      const user = await login(
        email.trim(),
        password,
        role,
        undefined,
        secretKey
      );

      if (role !== "member") {
        const savedName = staffProfiles[role]?.name;

        if (savedName) {
          updateProfile({ name: savedName });
        }

        addLog(
          "auth",
          `${role} signed in`,
          "info",
          `${savedName || user.name} (${role})`
        );
      }

      navigate(dashboardPaths[role]);
    } catch (err) {
      console.error("LOGIN ERROR:", err);

      if (role !== "member") {
        addLog(
          "auth",
          `Failed ${role} sign-in attempt for ${email.trim()}`,
          "warning",
          "system"
        );
      }

      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          err.message ||
          "Login failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const { heading, note, label } = roles[role];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-8" />

      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {heading}
        </h1>

        <p className="text-sm text-gray-500 mt-1">{note}</p>

        <div className="mt-5">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-700">
              Sign in as
            </span>
            <span className="text-xs text-gray-500">
              Role-based workspace
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(roles).map(([key, r]) => (
              <button
                key={key}
                type="button"
                onClick={() => pickRole(key)}
                aria-pressed={role === key}
                className={`border rounded py-2 text-sm ${
                  role === key
                    ? "border-blue-700 bg-blue-50 text-blue-700 font-medium"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="password"
                className="text-sm font-medium text-gray-700"
              >
                Password
              </label>

              <Link
                to="/forgot-password"
                className="text-xs text-blue-700 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 pr-14 text-sm focus:outline-none focus:border-blue-600"
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {role === "admin" && (
            <div>
              <label
                htmlFor="secret-key"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Secret key
              </label>

              <input
                id="secret-key"
                type="password"
                placeholder="Enter the admin secret key"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
                autoComplete="off"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded py-2 disabled:opacity-60"
          >
            {loading ? "Signing in..." : `Sign in as ${label}`}
          </button>
        </form>
      </div>

      <div className="mt-4 text-sm text-gray-600 text-center">
        {role === "member" ? (
          <>
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-blue-700 hover:underline"
            >
              Create one
            </Link>
          </>
        ) : (
          "Admin access is set up by the system administrator."
        )}
      </div>
    </div>
  );
}

export default LoginForm;
