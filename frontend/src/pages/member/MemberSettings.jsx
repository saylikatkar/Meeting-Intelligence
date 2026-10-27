import DashboardLayout from "../../layouts/DashboardLayout";
import ProfilePanel from "../../components/ProfilePanel";
import PasswordPanel from "../../components/PasswordPanel";
import { useAuth } from "../../context/AuthContext";
import { useData, useMember } from "../../context/DataContext";

function MemberSettings() {
  const { user } = useAuth();
  const { updateUser } = useData();
  const { account } = useMember();

  return (
    <DashboardLayout title="Settings">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500">Manage your profile photo, name and password.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ProfilePanel
          roleLabel="Member"
          onSave={(name) => updateUser(account.id, { name }, `${user.email} changed their name to ${name}`)}
          onPhotoChange={(avatar) =>
            updateUser(account.id, { avatar }, `${user.email} ${avatar ? "updated" : "removed"} their profile photo`)
          }
        />
        <PasswordPanel />
      </div>
    </DashboardLayout>
  );
}

export default MemberSettings;
