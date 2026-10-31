
import { useState } from "react";
import Panel from "./Panel";
import { inputClass, primaryButton } from "./ui";
import api from "../services/api";

function PasswordPanel() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    if (!current || !next || !confirm) {
      setMessage({ ok: false, text: "Please fill in all password fields." });
      return;
    }

    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
      setMessage({
        ok: false,
        text: "Use at least 8 characters with a letter and a number.",
      });
      return;
    }

    if (next !== confirm) {
      setMessage({ ok: false, text: "New passwords do not match." });
      return;
    }

    if (current === next) {
      setMessage({
        ok: false,
        text: "Your new password must be different from your current password.",
      });
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/change-password/", {
        current_password: current,
        new_password: next,
      });

      setCurrent("");
      setNext("");
      setConfirm("");

      setMessage({
        ok: true,
        text: response.data?.message || "Password changed successfully.",
      });
    } catch (error) {
      const data = error.response?.data;
      const errorText =
        data?.error ||
        data?.detail ||
        data?.current_password?.[0] ||
        data?.new_password?.[0] ||
        "Unable to change password. Please try again.";

      setMessage({ ok: false, text: errorText });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="Change password" className="h-fit">
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div>
          <label htmlFor="current" className="block text-sm font-medium text-gray-700 mb-1">
            Current password
          </label>
          <input
            id="current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="next" className="block text-sm font-medium text-gray-700 mb-1">
            New password
          </label>
          <input
            id="next"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={primaryButton} disabled={loading}>
            {loading ? "Updating..." : "Update password"}
          </button>

          {message && (
            <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>
              {message.text}
            </span>
          )}
        </div>
      </form>
    </Panel>
  );
}

export default PasswordPanel;
