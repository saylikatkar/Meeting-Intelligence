
import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import Panel from "../../components/Panel";
import api from "../../services/api";
import { formatDateTime } from "../../utils/format";
import { downloadCsv } from "../../utils/csv";
import { secondaryButton, selectClass } from "../../components/ui";
import SearchBox from "../../components/SearchBox";

const sources = ["auth", "users", "meetings", "settings", "system"];

function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [source, setSource] = useState("all");

  useEffect(() => {
    let isMounted = true;

    async function fetchLogs() {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/admin/logs/");

        if (isMounted) {
          setLogs(response.data.logs || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.response?.data?.detail ||
            err.response?.data?.error ||
            "Unable to load activity logs."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchLogs();

    return () => {
      isMounted = false;
    };
  }, []);

  const term = search.toLowerCase();

  const filtered = logs.filter(
    (log) =>
      (level === "all" || log.level === level) &&
      (source === "all" || log.source === source) &&
      (
        (log.message || "").toLowerCase().includes(term) ||
        (log.actor || "").toLowerCase().includes(term)
      )
  );

  const count = (selectedLevel) =>
    logs.filter((log) => log.level === selectedLevel).length;

  return (
    <DashboardLayout title="Logs">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

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
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search messages or people"
            />

            <select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              className={selectClass}
            >
              <option value="all">All levels</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>

            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className={selectClass}
            >
              <option value="all">All sources</option>
              {sources.map((item) => (
                <option key={item} value={item}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </option>
              ))}
            </select>

            <button
              onClick={() => downloadCsv("logs.csv", filtered)}
              className={secondaryButton}
              disabled={loading}
            >
              Export CSV
            </button>
          </>
        }
      >
        {loading ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            Loading activity logs...
          </p>
        ) : (
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
                {filtered.map((log) => (
                  <tr key={log.id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                      {formatDateTime(log.time)}
                    </td>

                    <td className="px-4 py-2.5">
                      <StatusBadge status={log.level} />
                    </td>

                    <td className="px-4 py-2.5 text-gray-600 capitalize">
                      {log.source}
                    </td>

                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                      {log.actor}
                    </td>

                    <td className="px-4 py-2.5 text-gray-900">
                      {log.message}
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No log entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </DashboardLayout>
  );
}

export default AdminLogs;
