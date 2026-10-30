import { useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import Panel from "../../components/Panel";
import { useMember } from "../../context/DataContext";
import { secondaryButton } from "../../components/ui";

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 6 weeks of dates starting on the Monday before the 1st
function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

function Calendar() {
  const { meetings, actions } = useMember();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const days = monthGrid(cursor.year, cursor.month);
  const todayKey = toKey(now);
  const label = new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  function move(delta) {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }

  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
  const meetingsInMonth = meetings.filter((m) => m.date.startsWith(monthPrefix)).length;
  const dueInMonth = actions.filter((a) => a.due.startsWith(monthPrefix) && a.status !== "completed").length;

  return (
    <DashboardLayout title="Calendar">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{label}</h2>
          <p className="text-sm text-gray-500">
            {meetingsInMonth} meetings · {dueInMonth} action items due
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => move(-1)} className={secondaryButton}>
            Previous
          </button>
          <button onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })} className={secondaryButton}>
            Today
          </button>
          <button onClick={() => move(1)} className={secondaryButton}>
            Next
          </button>
        </div>
      </div>

      <Panel>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[700px]">
            {dayNames.map((d) => (
              <div key={d} className="px-2 py-2 text-xs text-gray-500 text-center border-b border-gray-200">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const key = toKey(day);
              const inMonth = day.getMonth() === cursor.month;
              const dayMeetings = meetings.filter((m) => m.date === key);
              const dayActions = actions.filter((a) => a.due === key && a.status !== "completed");
              return (
                <div key={key} className={`min-h-24 p-1.5 border-b border-r border-gray-100 ${inMonth ? "" : "bg-gray-50"}`}>
                  <span
                    className={`inline-block text-xs px-1.5 rounded ${
                      key === todayKey ? "bg-blue-700 text-white" : inMonth ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayMeetings.map((m) => (
                      <Link
                        key={m.id}
                        to={`/meetings/${m.id}`}
                        title={m.title}
                        className="block truncate text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 hover:underline"
                      >
                        {m.title}
                      </Link>
                    ))}
                    {dayActions.map((a) => (
                      <Link
                        key={a.id}
                        to="/actions"
                        title={`Due: ${a.task}`}
                        className="block truncate text-xs bg-yellow-50 text-yellow-800 rounded px-1.5 py-0.5 hover:underline"
                      >
                        Due: {a.task}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex gap-4 px-4 py-2.5 border-t border-gray-200 text-xs text-gray-500">
          <span>
            <span className="inline-block w-2 h-2 rounded-sm bg-blue-700 mr-1" /> Meeting
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-sm bg-yellow-400 mr-1" /> Action item due
          </span>
        </div>
      </Panel>
    </DashboardLayout>
  );
}

export default Calendar;
