
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import StatusBadge from "../../components/StatusBadge";
import Icon from "../../components/Icon";
import { useData, useMember } from "../../context/DataContext";
import { formatDate } from "../../utils/format";
import { smallPrimaryButton } from "../../components/ui";

const selectWrap =
  "flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus-within:border-blue-600";

function MyMeetings() {
  const { deleteMeeting } = useData();
  const { meetings } = useMember();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [deletingId, setDeletingId] = useState(null);

  const term = search.toLowerCase();

  const shown = meetings
    .filter(
      (m) =>
        (status === "all" || m.status === status) &&
        `${m.title} ${m.id} ${m.summary || ""} ${
          m.fileName || ""
        }`
          .toLowerCase()
          .includes(term)
    )
    .sort((a, b) =>
      sort === "newest"
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date)
    );

  async function handleDelete(m) {
    const confirmed = window.confirm(
      `Delete "${m.title}"? The transcript and action items will be removed.`
    );

    if (!confirmed || deletingId) return;

    setDeletingId(m.id);

    try {
      await deleteMeeting(
        m.id,
        `Deleted meeting '${m.title}' (${m.owner || "member"})`
      );

      window.alert("Meeting deleted successfully.");
    } catch (error) {
      console.error("Failed to delete meeting:", error);

      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Could not delete the meeting. Check the backend server and try again.";

      window.alert(message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <DashboardLayout title="My Meetings">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-semibold tracking-widest text-blue-700">
            YOUR LIBRARY
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-1">
            My meetings
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Search meetings by title, ID or summary; filter by status
            and open a record.
          </p>
        </div>

        <Link
          to="/upload"
          className={`${smallPrimaryButton} inline-flex items-center gap-1.5`}
        >
          <Icon name="plus" />
          Upload meeting
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-200">
          <label className={`${selectWrap} w-full sm:w-96`}>
            <Icon
              name="search"
              className="w-4 h-4 text-gray-400 shrink-0"
            />

            <input
              type="text"
              placeholder="Search meetings, transcript topics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none focus:shadow-none"
              aria-label="Search meetings"
            />
          </label>

          <div className="flex gap-2">
            <label className={selectWrap}>
              <Icon
                name="filter"
                className="w-4 h-4 text-gray-400"
              />

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-transparent outline-none"
                aria-label="Filter by status"
              >
                <option value="all">All status</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="queued">Queued</option>
                <option value="failed">Failed</option>
              </select>
            </label>

            <label className={selectWrap}>
              <Icon
                name="sort"
                className="w-4 h-4 text-gray-400"
              />

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-transparent outline-none"
                aria-label="Sort"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <Icon
              name="search"
              className="w-6 h-6 text-gray-400 mx-auto"
            />

            <p className="text-sm font-medium text-gray-900 mt-2">
              {meetings.length === 0
                ? "No meetings yet"
                : "No meetings found"}
            </p>

            <p className="text-sm text-gray-500 mt-1">
              {meetings.length === 0 ? (
                <Link to="/upload" className="text-blue-700">
                  Upload a recording to get started.
                </Link>
              ) : (
                "Try a different search or status filter."
              )}
            </p>
          </div>
        ) : (
          <ul className="px-2">
            {shown.map((m) => (
              <li
                key={m.id}
                onClick={() => navigate(`/meetings/${m.id}`)}
                className="flex items-center gap-4 px-3 py-3.5 border-t border-gray-100 first:border-t-0 rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <span className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <Icon name="mic" className="w-5 h-5" />
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-gray-900 truncate">
                    {m.title}
                  </span>

                  <span className="block text-xs text-gray-500 mt-0.5">
                    {formatDate(m.date)} · {m.duration} min ·{" "}
                    {m.speakers} speakers
                    {m.fileName && ` · ${m.fileName}`}
                  </span>
                </span>

                <StatusBadge status={m.status} />

                <Link
                  to={`/meetings/${m.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:text-blue-700 hover:bg-blue-50 shrink-0"
                  aria-label={`Open ${m.title}`}
                >
                  <Icon name="arrow" />
                </Link>

                <button
                  type="button"
                  disabled={deletingId !== null}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(m);
                  }}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Delete ${m.title}`}
                  title="Delete meeting"
                >
                  {deletingId === m.id ? (
                    <span className="text-xs">...</span>
                  ) : (
                    <Icon name="x" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap justify-between gap-2 px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
          <span>
            Showing {shown.length} of {meetings.length} meeting records
          </span>

          <span>
            Search covers titles, IDs, summaries and file names.
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default MyMeetings;
