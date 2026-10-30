import { useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import Panel from "../../components/Panel";
import ProfilePanel from "../../components/ProfilePanel";
import { useData } from "../../context/DataContext";
import { inputClass, primaryButton } from "../../components/ui";

function AdminSettings() {
  const { settings, updateSettings, updateStaffProfile } = useData();
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave(e) {
    e.preventDefault();
    updateSettings({ ...settings, monthlyLimit: form.monthlyLimit, maxMinutes: form.maxMinutes, maxFileSizeMb: form.maxFileSizeMb });
    setSaved(true);
  }

  return (
    <DashboardLayout title="Settings">
      <h2 className="text-xl font-semibold text-gray-900">Your account</h2>
      <p className="text-sm text-gray-500 mb-4">Your admin profile.</p>
      <div className="max-w-xl">
        <ProfilePanel
          roleLabel="Admin"
          note="Your sign-in email and password are set in the .env file."
          onSave={(name) => updateStaffProfile("admin", { name }, `Admin changed their display name to ${name}`)}
        />
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mt-8">System settings</h2>
      <p className="text-sm text-gray-500 mb-4">These apply to everyone on MeetingIntel.</p>
      <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
        <Panel title="Plan limits">
          <div className="p-4 grid sm:grid-cols-3 gap-4">
            <NumberField label="Meetings per month" value={form.monthlyLimit} onChange={(v) => set("monthlyLimit", v)} />
            <NumberField label="Max minutes per meeting" value={form.maxMinutes} onChange={(v) => set("maxMinutes", v)} />
            <NumberField label="Max file size (MB)" value={form.maxFileSizeMb} onChange={(v) => set("maxFileSizeMb", v)} />
          </div>
        </Panel>

        <div className="flex items-center gap-3">
          <button type="submit" className={primaryButton}>
            Save settings
          </button>
          {saved && <span className="text-sm text-green-700">Settings saved.</span>}
        </div>
      </form>
    </DashboardLayout>
  );
}

function NumberField({ label, value, onChange }) {
  const id = label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputClass}
      />
    </div>
  );
}

export default AdminSettings;
