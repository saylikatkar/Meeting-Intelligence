
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { inputClass, primaryButton } from "./ui";

function ProfilePanel({
  roleLabel = "Member",
  note = "",
  onSave = async () => {},
}) {
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (name.trim().length < 2) {
      setMessage("Name must contain at least 2 characters.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      await onSave(name.trim());

      updateProfile({
        name: name.trim()
      });

      setMessage("Profile updated successfully.");
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.message ||
          "Unable to update profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      {note && (
        <p className="text-sm text-gray-500 mb-4">
          {note}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full name
          </label>

          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setMessage("");
            }}
            className={inputClass}
            required
            minLength={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>

          <input
            type="email"
            value={user?.email || ""}
            className={inputClass}
            disabled
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>

          <input
            type="text"
            value={roleLabel}
            className={inputClass}
            disabled
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className={primaryButton}
          >
            {saving ? "Saving..." : "Save profile"}
          </button>

          {message && (
            <span
              className={`text-sm ${
                message.includes("successfully")
                  ? "text-green-700"
                  : "text-red-600"
              }`}
            >
              {message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

export default ProfilePanel;
