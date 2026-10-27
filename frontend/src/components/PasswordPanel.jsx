import { useState } from "react";
import Panel from "./Panel";
import { useAuth } from "../context/AuthContext";
import { useData, useMember } from "../context/DataContext";
import { inputClass, primaryButton } from "./ui";

// Change password card for members.
function PasswordPanel() {
  const { user } = useAuth();
  const { updateUser } = useData();
  const { account } = useMember();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState(null);

  // TODO: replace with POST /api/auth/change-password/
  function handleSubmit(e) {
    e.preventDefault();
    if (account?.password && current !== account.password) {
      setMessage({ ok: false, text: "Your current password is wrong." });
    } else if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
      setMessage({ ok: false, text: "Use at least 8 characters with a letter and a number." });
    } else if (next !== confirm) {
      setMessage({ ok: false, text: "New passwords do not match." });
    } else {
      updateUser(account.id, { password: next }, `${user.email} changed their password`);
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage({ ok: true, text: "Password changed." });
    }
  }

  return (
    <Panel title="Change password" className="h-fit">
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {account?.password && (
          <div>
            <label htmlFor="current" className="block text-sm font-medium text-gray-700 mb-1">
              Current password
            </label>
            <input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
          </div>
        )}
        <div>
          <label htmlFor="next" className="block text-sm font-medium text-gray-700 mb-1">
            New password
          </label>
          <input id="next" type="password" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm new password
          </label>
          <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className={primaryButton}>
            Update password
          </button>
          {message && <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</span>}
        </div>
      </form>
    </Panel>
  );
}

export default PasswordPanel;
