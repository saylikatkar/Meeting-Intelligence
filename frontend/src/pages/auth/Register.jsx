import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, roleAccounts } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import Logo from "../../components/Logo";

const inputClass =
  "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-600";

function Register() {
  const { login } = useAuth();
  const { users, createMember, updateUser } = useData();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate() {
    const cleanEmail = email.trim().toLowerCase();
    const reserved = Object.values(roleAccounts).map((a) => (a.email || "").toLowerCase());

    if (name.trim().length < 2) return "Please enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return "Please enter a valid email address.";
    const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
    // accounts without a password (added by an admin, or from older versions) can be claimed here
    if (reserved.includes(cleanEmail) || (existing && (existing.password || existing.role !== "member"))) {
      return "An account with this email already exists. Try signing in.";
    }
    if (password.length < 8) return "Use at least 8 characters for your password.";
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Your password needs at least one letter and one number.";
    if (password !== confirm) return "Passwords do not match.";
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const problem = validate();
    setError(problem);
    if (problem) return;

    setLoading(true);
    try {
      // TODO: replace with POST /api/auth/register/
      const profile = { name: name.trim(), email: email.trim(), password };
      const existing = users.find((u) => u.email.toLowerCase() === profile.email.toLowerCase());
      if (existing) {
        const changes = { name: profile.name, password };
        updateUser(existing.id, changes, `${profile.email} set a password for their account`);
      } else {
        createMember(profile, `New member signed up: ${email.trim()}`);
      }
      await login(email.trim(), password, "member", profile);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Could not create your account. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const strength = [password.length >= 8, /[A-Za-z]/.test(password) && /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  const strengthLabel = ["Too short", "Weak", "Good", "Strong"][strength];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-8" />

        {/* form */}
      <div className="w-full max-w-lg bg-white border border-gray-200 rounded-lg p-6">
        <h1 className="text-xl font-semibold text-gray-900">Create your account</h1>
        <p className="text-sm text-gray-500 mt-1">Turn every meeting into a summary, action items and clear next steps.</p>

        {error && (
          <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Full name
            </label>
            <input id="name" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoComplete="name" />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Work email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-14`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {password && (
              <div className="mt-2">
                <div className="h-2 bg-gray-100 rounded">
                  <div className="h-2 bg-blue-700 rounded" style={{ width: `${(strength / 3) * 100}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">Password strength: {strengthLabel}</p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded py-2 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Already have an account?{" "}
        <Link to="/login" className="text-blue-700 hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default Register;
