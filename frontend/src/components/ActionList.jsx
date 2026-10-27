import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import { useData, useMember } from "../context/DataContext";
import { formatDate } from "../utils/format";
import { inputClass, secondaryButton, selectClass, smallPrimaryButton } from "./ui";

const statuses = ["pending", "in progress", "completed"];
const statusLabels = { pending: "Pending", "in progress": "In Progress", completed: "Completed" };
const statusDots = { pending: "bg-yellow-400", "in progress": "bg-blue-600", completed: "bg-green-500" };
const priorityTags = {
  high: "bg-red-50 text-red-700",
  medium: "bg-blue-50 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

function initials(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Kanban board / list of action items.
// `meetingId` limits it to one meeting; `heading` shows the page title row.
function ActionList({ meetingId, heading }) {
  const { addAction, updateAction, deleteAction } = useData();
  const { account, meetings, actions } = useMember();
  const [view, setView] = useState("board");
  const [filterMeeting, setFilterMeeting] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [menuFor, setMenuFor] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ task: "", assignee: "", due: "", priority: "medium", meetingId: meetingId || "" });
  const [error, setError] = useState("");

  const meetingTitle = (id) => meetings.find((m) => m.id === id)?.title || "—";
  const scope = meetingId || filterMeeting;
  const items = actions
    .filter((a) => scope === "all" || a.meetingId === scope)
    .filter((a) => filterPriority === "all" || a.priority === filterPriority)
    .sort((a, b) => a.due.localeCompare(b.due));
  const byStatus = (s) => items.filter((a) => a.status === s);
  const today = new Date().toISOString().slice(0, 10);

  function handleAdd(e) {
    e.preventDefault();
    if (!form.task.trim() || !form.meetingId || !form.due) {
      setError("Add a task, pick a meeting and choose a due date.");
      return;
    }
    addAction({ ...form, task: form.task.trim(), assignee: form.assignee.trim() || account.name, ownerId: account.id });
    setForm({ task: "", assignee: "", due: "", priority: "medium", meetingId: meetingId || "" });
    setError("");
    setAdding(false);
  }

  function handleDelete(a) {
    setMenuFor(null);
    if (window.confirm(`Delete "${a.task}"?`)) deleteAction(a.id);
  }

  const viewToggle = (
    <div className="inline-flex gap-1 bg-white border border-gray-200 rounded-full p-1">
      {[
        ["board", "Kanban board"],
        ["list", "List view"],
      ].map(([v, label]) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={`text-sm font-medium rounded-full px-4 py-1.5 ${
            view === v ? "bg-blue-700 text-white" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const statusSelect = (a, extra = "") => (
    <select
      value={a.status}
      onChange={(e) => updateAction(a.id, { status: e.target.value })}
      className={`${selectClass} ${extra}`}
      aria-label={`Move ${a.task}`}
    >
      {statuses.map((s) => (
        <option key={s} value={s}>
          {statusLabels[s]}
        </option>
      ))}
    </select>
  );

  const card = (a) => {
    const overdue = a.status !== "completed" && a.due < today;
    return (
      <article key={a.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-semibold rounded-md px-2 py-0.5 ${priorityTags[a.priority] || priorityTags.medium}`}>
            {a.priority.charAt(0).toUpperCase() + a.priority.slice(1)} priority
          </span>
          <div className="relative">
            <button
              onClick={() => setMenuFor(menuFor === a.id ? null : a.id)}
              className="text-gray-400 hover:text-gray-900 px-1 tracking-widest leading-none"
              aria-label={`Options for ${a.task}`}
            >
              •••
            </button>
            {menuFor === a.id && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                <div className="absolute right-0 mt-1 w-40 z-20 bg-white border border-gray-200 rounded-lg overflow-hidden text-sm">
                  {!meetingId && (
                    <Link to={`/meetings/${a.meetingId}`} className="block px-3 py-2 text-gray-700 hover:bg-gray-50">
                      Open meeting
                    </Link>
                  )}
                  <button onClick={() => handleDelete(a)} className="block w-full text-left px-3 py-2 text-red-600 hover:bg-red-50">
                    Delete task
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <p className={`mt-3 font-semibold ${a.status === "completed" ? "text-gray-400 line-through" : "text-gray-900"}`}>{a.task}</p>
        {!meetingId && <p className="text-xs text-gray-500 mt-1">{meetingTitle(a.meetingId)}</p>}

        <div className="flex items-center justify-between gap-2 mt-3 text-xs">
          <span className="flex items-center gap-2 text-gray-600 min-w-0">
            <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
              {initials(a.assignee)}
            </span>
            <span className="truncate">{a.assignee}</span>
          </span>
          <span className={`flex items-center gap-1 shrink-0 ${overdue ? "text-red-600" : "text-gray-500"}`}>
            <Icon name="calendar" className="w-3.5 h-3.5" />
            {formatDate(a.due)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-200">
          <span className="text-xs text-gray-500">Move task</span>
          {statusSelect(a, "text-xs")}
        </div>
      </article>
    );
  };

  return (
    <div>
      {heading ? (
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <p className="text-xs font-semibold tracking-widest text-blue-700">{heading.eyebrow}</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-1">{heading.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{heading.subtitle}</p>
          </div>
          {viewToggle}
        </div>
      ) : (
        <div className="mb-4">{viewToggle}</div>
      )}

      {/* summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {statuses.map((s) => (
          <div key={s} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">{statusLabels[s]}</span>
            <span className="text-2xl font-semibold text-gray-900">{byStatus(s).length}</span>
          </div>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-end gap-2 mt-4">
        {!meetingId && (
          <select value={filterMeeting} onChange={(e) => setFilterMeeting(e.target.value)} className={selectClass}>
            <option value="all">All meetings</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        )}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className={selectClass}
          aria-label="Filter by priority"
        >
          <option value="all">All priorities</option>
          <option value="high">High priority</option>
          <option value="medium">Medium priority</option>
          <option value="low">Low priority</option>
        </select>
        <button onClick={() => setAdding(!adding)} className={smallPrimaryButton}>
          {adding ? "Cancel" : "+ Add task"}
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="mt-4 bg-white border border-gray-200 rounded-lg p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            placeholder="What needs to be done?"
            value={form.task}
            onChange={(e) => setForm({ ...form, task: e.target.value })}
            className={`${inputClass} lg:col-span-2`}
          />
          <input
            placeholder="Assignee (you if empty)"
            value={form.assignee}
            onChange={(e) => setForm({ ...form, assignee: e.target.value })}
            className={inputClass}
          />
          <input
            type="date"
            value={form.due}
            onChange={(e) => setForm({ ...form, due: e.target.value })}
            className={inputClass}
            aria-label="Due date"
          />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </select>
          {!meetingId && (
            <select
              value={form.meetingId}
              onChange={(e) => setForm({ ...form, meetingId: e.target.value })}
              className={`${inputClass} lg:col-span-2`}
            >
              <option value="">Choose a meeting…</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className={`${secondaryButton} py-2`}>
            Save task
          </button>
          {error && <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-5">{error}</p>}
        </form>
      )}

      {view === "board" ? (
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {statuses.map((s) => (
            <section key={s} className="bg-white border border-gray-200 rounded-lg p-4 self-start">
              <header className="flex items-center gap-2 mb-4">
                <span className={`w-2 h-2 rounded-full ${statusDots[s]}`} />
                <span className="font-semibold text-gray-900">{statusLabels[s]}</span>
                <span className="ml-auto text-xs font-semibold bg-blue-50 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center">
                  {byStatus(s).length}
                </span>
              </header>
              <div className="space-y-3">
                {byStatus(s).map(card)}
                {byStatus(s).length === 0 && (
                  <p className="text-sm text-gray-400 text-center border border-dashed border-gray-200 rounded-xl py-6">No tasks</p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <ul className="mt-4 bg-white border border-gray-200 rounded-lg">
          {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-500">No action items yet.</li>}
          {items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-gray-100 first:border-t-0">
              <input
                type="checkbox"
                checked={a.status === "completed"}
                onChange={(e) => updateAction(a.id, { status: e.target.checked ? "completed" : "pending" })}
                aria-label={`Complete ${a.task}`}
              />
              <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                {initials(a.assignee)}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${a.status === "completed" ? "text-gray-400 line-through" : "text-gray-900"}`}>{a.task}</p>
                <p className="text-xs text-gray-500">
                  {!meetingId && `${meetingTitle(a.meetingId)} · `}
                  {a.assignee} · due {formatDate(a.due)}
                </p>
              </div>
              <span className={`text-xs font-semibold rounded-md px-2 py-0.5 ${priorityTags[a.priority] || priorityTags.medium}`}>
                {a.priority.charAt(0).toUpperCase() + a.priority.slice(1)}
              </span>
              {statusSelect(a)}
              <button onClick={() => handleDelete(a)} className="text-gray-400 hover:text-red-600 p-1" aria-label={`Delete ${a.task}`}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ActionList;
