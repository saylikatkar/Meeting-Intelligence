import { useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import Panel from "../../components/Panel";
import { useData } from "../../context/DataContext";
import { formatDateTime } from "../../utils/format";
import { downloadCsv } from "../../utils/csv";
import { secondaryButton, selectClass } from "../../components/ui";
import SearchBox from "../../components/SearchBox";

const sources = ["auth", "users", "meetings", "settings", "system"];

function AdminLogs() {
  const { logs, clearLogs } = useData();
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [source, setSource] = useState("all");

  const term = search.toLowerCase();
  const filtered = logs.filter(
    (l) =>
      (level === "all" || l.level === level) &&
      (source === "all" || l.source === source) &&
      (l.message.toLowerCase().includes(term) || l.actor.toLowerCase().includes(term))
  );
  const count = (lvl) => logs.filter((l) => l.level === lvl).length;

  function handleClear() {
    if (window.confirm("Clear the whole activity log?")) {
      clearLogs();
    }
  }

  return (
    <DashboardLayout title="Logs">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Entries" value={logs.length} />
        <StatCard label="Info" value={count("info")} />
        <StatCard label="Warnings" value={count("warning")} />
        <StatCard label="Errors" value={count("error")} />
      </div>

      <Panel
        title="Activity log"
        className="mt-6"
        actions={
          <>
            <SearchBox value={search} onChange={setSearch} placeholder="Search messages or people" />
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectClass}>
              <option value="all">All levels</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={selectClass}>
              <option value="all">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <button onClick={() => downloadCsv("logs.csv", filtered)} className={secondaryButton}>
              Export CSV
            </button>
            <button onClick={handleClear} className={`${secondaryButton} text-red-600`}>
              Clear
            </button>
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="px-4 py-2 font-normal">Time</th>
                <th className="px-4 py-2 font-normal">Level</th>
                <th className="px-4 py-2 font-normal">Source</th>
                <th className="px-4 py-2 font-normal">By</th>
                <th className="px-4 py-2 font-normal">Message</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatDateTime(l.time)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={l.level} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 capitalize">{l.source}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{l.actor}</td>
                  <td className="px-4 py-2.5 text-gray-900">{l.message}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-6 text-center text-gray-500">
                    No log entries found.
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

export default AdminLogs;
