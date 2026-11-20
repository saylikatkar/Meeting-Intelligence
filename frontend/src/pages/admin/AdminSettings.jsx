
import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import Panel from "../../components/Panel";
import ProfilePanel from "../../components/ProfilePanel";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { inputClass, primaryButton } from "../../components/ui";

function AdminSettings() {
  const { settings, updateSettings } = useData();
  const { updateProfile } = useAuth();

  const [form, setForm] = useState(settings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const [settingsResponse, profileResponse] = await Promise.all([
          api.get("/settings/system/"),
          api.get("/settings/profile/"),
        ]);

        setForm(settingsResponse.data);
        updateProfile(profileResponse.data);
      } catch (err) {
        setError(
          err.response?.data?.error ||
            "Unable to load settings from the server."
        );
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError("");
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    try {
      const response = await api.patch("/settings/system/", form);
      const updatedSettings = response.data.settings;

      setForm(updatedSettings);
      updateSettings(updatedSettings);
      setSaved(true);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to save settings. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleProfileSave(name) {
    const response = await api.patch("/settings/profile/", { name });
    updateProfile(response.data.user);
  }

  return (
    <DashboardLayout title="Settings">
      <h2 className="text-xl font-semibold text-gray-900">Your account</h2>
      <p className="text-sm text-gray-500 mb-4">Your admin profile.</p>

      <div className="max-w-xl">
        <ProfilePanel
          roleLabel="Admin"
          note="Your sign-in email and password are managed by your account."
          onSave={handleProfileSave}
        />
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">
        System settings
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        These apply to everyone on MeetingIntel.
      </p>

      {loading ? (
        <p className="text-sm text-gray-500">Loading settings...</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
          <Panel title="Plan limits">
            <div className="p-4 grid sm:grid-cols-3 gap-4">
              <NumberField
                label="Meetings per month"
                value={form.monthlyLimit}
                onChange={(v) => set("monthlyLimit", v)}
              />

              <NumberField
                label="Max minutes per meeting"
                value={form.maxMinutes}
                onChange={(v) => set("maxMinutes", v)}
              />

              <NumberField
                label="Max file size (MB)"
                value={form.maxFileSizeMb}
                onChange={(v) => set("maxFileSizeMb", v)}
              />
            </div>
          </Panel>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className={primaryButton}
            >
              {saving ? "Saving..." : "Save settings"}
            </button>

            {saved && (
              <span className="text-sm text-green-700">
                Settings saved.
              </span>
            )}
          </div>
        </form>
      )}
    </DashboardLayout>
  );
}

function NumberField({ label, value, onChange }) {
  const id = label.toLowerCase().replace(/\W+/g, "-");

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>

      <input
        id={id}
        type="number"
        min="1"
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputClass}
      />
    </div>
  );
}

export default AdminSettings;
