import { useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import Panel from "../../components/Panel";
import MeetingDetailsModal from "../../components/MeetingDetailsModal";
import { useData } from "../../context/DataContext";
import { formatDate } from "../../utils/format";
import { downloadCsv } from "../../utils/csv";
import { actionButton, actionDanger, actionPrimary, secondaryButton, selectClass } from "../../components/ui";
import SearchBox from "../../components/SearchBox";

const statuses = ["completed", "processing", "queued", "failed", "cancelled"];

function MeetingsPage() {
  const { meetings, deleteMeeting, reprocessMeeting } = useData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState(null);

  const term = search.toLowerCase();
  const filtered = meetings.filter(
    (m) =>
      (status === "all" || m.status === status) &&
      (m.title.toLowerCase().includes(term) || m.owner.toLowerCase().includes(term))
  );
  const count = (s) => meetings.filter((m) => m.status === s).length;

  function handleDelete(m) {
    if (window.confirm(`Delete "${m.title}"? The transcript and summary will be removed.`)) {
      deleteMeeting(m.id, `Deleted meeting '${m.title}' (${m.owner})`);
    }
  }

  function exportCsv() {
    downloadCsv(
      "meetings.csv",
      filtered.map(({ id, title, owner, date, duration, speakers, status }) => ({ id, title, owner, date, duration, speakers, status }))
    );
  }

  return (
    <DashboardLayout title="Meetings">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total meetings" value={meetings.length} />
        <StatCard label="Completed" value={count("completed")} />
        <StatCard label="In progress" value={count("processing") + count("queued")} />
        <StatCard label="Failed" value={count("failed")} />
      </div>

      <Panel
        title="All meetings"
        className="mt-6"
        actions={
          <>
            <SearchBox value={search} onChange={setSearch} placeholder="Search by title or owner" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              <option value="all">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <button onClick={exportCsv} className={secondaryButton}>
              Export CSV
            </button>
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="px-4 py-2 font-normal">Title</th>
                <th className="px-4 py-2 font-normal">Owner</th>
                <th className="px-4 py-2 font-normal">Date</th>
                <th className="px-4 py-2 font-normal">Duration</th>
                <th className="px-4 py-2 font-normal">Speakers</th>
                <th className="px-4 py-2 font-normal">Status</th>
                <th className="px-4 py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-900">{m.title}</td>
                  <td className="px-4 py-2.5 text-gray-600">{m.owner}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatDate(m.date)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{m.duration} min</td>
                  <td className="px-4 py-2.5 text-gray-600">{m.speakers}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-2">
                    <button onClick={() => setSelected(m)} className={actionPrimary}>
                      View
                    </button>
                    {["failed", "cancelled"].includes(m.status) && (
                      <button onClick={() => reprocessMeeting(m.id)} className={actionButton}>
                        Reprocess
                      </button>
                    )}
                    <button onClick={() => handleDelete(m)} className={actionDanger}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-gray-500">
                    No meetings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {selected && <MeetingDetailsModal meeting={selected} onClose={() => setSelected(null)} />}
    </DashboardLayout>
  );
}

export default MeetingsPage;
