import { useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import Panel from "../../components/Panel";
import AddUserModal from "../../components/AddUserModal";
import UserDetailsModal from "../../components/UserDetailsModal";
import { useData } from "../../context/DataContext";
import { formatDate } from "../../utils/format";
import { downloadCsv } from "../../utils/csv";
import { actionButton, actionDanger, actionPrimary, secondaryButton, selectClass, smallPrimaryButton } from "../../components/ui";
import SearchBox from "../../components/SearchBox";
import { planNames } from "../../components/PlansModal";

function AdminUsers() {
  const { users, updateUser, deleteUser } = useData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState(null);

  const term = search.toLowerCase();
  const filtered = users.filter(
    (u) =>
      (status === "all" || u.status === status) &&
      (u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
  );

  function changePlan(u, plan) {
    const from = planNames[u.plan || "free"];
    updateUser(u.id, { plan }, `Changed ${u.email} plan from ${from} to ${planNames[plan]}`);
  }

  function toggleStatus(u) {
    const next = u.status === "active" ? "disabled" : "active";
    updateUser(u.id, { status: next }, `${next === "active" ? "Enabled" : "Disabled"} ${u.email}`);
  }

  function handleDelete(u) {
    if (window.confirm(`Delete ${u.name}? This can't be undone.`)) {
      deleteUser(u.id, `Deleted user ${u.email}`);
    }
  }

  function exportCsv() {
    downloadCsv(
      "users.csv",
      filtered.map(({ name, email, plan, status, meetings, minutes, joined, lastLogin }) => ({
        name, email, plan: planNames[plan || "free"], status, meetings, minutes, joined, lastLogin,
      }))
    );
  }

  return (
    <DashboardLayout title="Users">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total accounts" value={users.length} />
        <StatCard label="Active" value={users.filter((u) => u.status === "active").length} />
        <StatCard label="Meetings" value={users.reduce((sum, u) => sum + u.meetings, 0)} />
        <StatCard label="Disabled" value={users.filter((u) => u.status === "disabled").length} />
      </div>

      <Panel
        title="All users"
        className="mt-6"
        actions={
          <>
            <SearchBox value={search} onChange={setSearch} placeholder="Search by name or email" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
            <button onClick={exportCsv} className={secondaryButton}>
              Export CSV
            </button>
            <button onClick={() => setAdding(true)} className={smallPrimaryButton}>
              + Add user
            </button>
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="px-4 py-2 font-normal">Name</th>
                <th className="px-4 py-2 font-normal">Email</th>
                <th className="px-4 py-2 font-normal">Plan</th>
                <th className="px-4 py-2 font-normal">Meetings</th>
                <th className="px-4 py-2 font-normal">Minutes</th>
                <th className="px-4 py-2 font-normal">Status</th>
                <th className="px-4 py-2 font-normal hidden 2xl:table-cell">Joined</th>
                <th className="px-4 py-2 font-normal">Last login</th>
                <th className="px-4 py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 text-gray-900 whitespace-nowrap">{u.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={u.plan || "free"}
                      onChange={(e) => changePlan(u, e.target.value)}
                      className={selectClass}
                      aria-label={`Plan for ${u.name}`}
                    >
                      {Object.entries(planNames).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{u.meetings}</td>
                  <td className="px-4 py-2.5 text-gray-600">{u.minutes}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap hidden 2xl:table-cell">{formatDate(u.joined)}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatDate(u.lastLogin)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-2">
                    <button onClick={() => setSelected(u)} className={actionPrimary}>
                      View
                    </button>
                    <button onClick={() => toggleStatus(u)} className={actionButton}>
                      {u.status === "active" ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => handleDelete(u)} className={actionDanger}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-4 py-6 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {adding && <AddUserModal onClose={() => setAdding(false)} />}
      {selected && <UserDetailsModal user={selected} onClose={() => setSelected(null)} />}
    </DashboardLayout>
  );
}

export default AdminUsers;
