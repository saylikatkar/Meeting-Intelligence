import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import Panel from "../../components/Panel";
import SearchBox from "../../components/SearchBox";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { formatDate } from "../../utils/format";
import { actionButton, actionDanger, actionPrimary, selectClass } from "../../components/ui";

function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");

  async function loadUsers() {
    try {
      const { data } = await api.get("/users/");
      setUsers(data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load users. Is the backend running?");
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function change(u, changes) {
    try {
      await api.patch(`/users/${u.id}/`, changes);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update this user.");
    }
  }

  function toggleRole(u) {
    if (u.role === "admin") {
      if (window.confirm(`Remove admin access from ${u.name}?`)) change(u, { role: "member" });
    } else if (window.confirm(`Give ${u.name} admin access?`)) {
      change(u, { role: "admin" });
    }
  }

  function toggleStatus(u) {
    change(u, { status: u.status === "active" ? "disabled" : "active" });
  }

  async function handleDelete(u) {
    if (!window.confirm(`Delete ${u.name}? This can't be undone.`)) return;
    try {
      await api.delete(`/users/${u.id}/`);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not delete this user.");
    }
  }

  const term = search.toLowerCase();
  const filtered = users.filter(
    (u) =>
      (status === "all" || u.status === status) &&
      (u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
  );

  return (
    <DashboardLayout title="Users">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total accounts" value={users.length} />
        <StatCard label="Admins" value={users.filter((u) => u.role === "admin").length} />
        <StatCard label="Members" value={users.filter((u) => u.role === "member").length} />
        <StatCard label="Disabled" value={users.filter((u) => u.status === "disabled").length} />
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
      )}

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
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="px-4 py-2 font-normal">Name</th>
                <th className="px-4 py-2 font-normal">Email</th>
                <th className="px-4 py-2 font-normal">Role</th>
                <th className="px-4 py-2 font-normal">Status</th>
                <th className="px-4 py-2 font-normal">Joined</th>
                <th className="px-4 py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isMe = u.email.toLowerCase() === (me?.email || "").toLowerCase();
                return (
                  <tr key={u.id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5 text-gray-900 whitespace-nowrap">
                      {u.name} {isMe && <span className="text-xs text-gray-400">(you)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${
                          u.role === "admin" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {u.role === "admin" ? "Admin" : "Member"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{u.joined ? formatDate(u.joined) : "-"}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-2">
                      {!isMe && (
                        <>
                          <button onClick={() => toggleRole(u)} className={actionPrimary}>
                            {u.role === "admin" ? "Remove admin" : "Make admin"}
                          </button>
                          <button onClick={() => toggleStatus(u)} className={actionButton}>
                            {u.status === "active" ? "Disable" : "Enable"}
                          </button>
                          <button onClick={() => handleDelete(u)} className={actionDanger}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </DashboardLayout>
  );
}

export default AdminUsers;