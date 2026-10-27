import { useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../../context/DataContext";
import Logo from "../../components/Logo";

function ForgotPassword() {
  const { addLog } = useData();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    // TODO: replace with POST /api/auth/password-reset/
    addLog("auth", `Password reset requested for ${email.trim()}`, "info", "system");
    setSent(true);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <Logo className="mb-8" />

      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-6">
        <h1 className="text-xl font-semibold text-gray-900">Reset your password</h1>

        {sent ? (
          <div className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            If an account exists for {email.trim()}, you'll get an email with a link to reset your password.
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mt-1">Enter your email and we'll send you a reset link.</p>

            {error && (
              <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
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
                />
              </div>
              <button type="submit" className="w-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded py-2">
                Send reset link
              </button>
            </form>
          </>
        )}

        <p className="text-xs text-gray-500 mt-4">The admin password is set by your system administrator.</p>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <Link to="/login" className="text-gray-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default ForgotPassword;
