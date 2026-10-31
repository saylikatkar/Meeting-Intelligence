import { Link } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import Panel from "../../components/Panel";
import Icon from "../../components/Icon";
import QuickActions from "../../components/QuickActions";
import { useAuth } from "../../context/AuthContext";
import { useData, useMember } from "../../context/DataContext";
import { formatDate } from "../../utils/format";
import { smallPrimaryButton } from "../../components/ui";

function monthKey(offset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
}

// "+2" / "-1" / "0"
function diff(now, before) {
  const n = now - before;
  return n > 0 ? `+${n}` : String(n);
}

function MemberDashboard() {
  const { user } = useAuth();
  const { addSampleMeetings } = useData();
  const {
  account,
  meetings,
  actions,
  meetingsLoaded,
  actionsLoaded,
  apiError,
} = useMember();

  const thisMonth = meetings.filter((m) => m.date.startsWith(monthKey(0)));
  const lastMonth = meetings.filter((m) => m.date.startsWith(monthKey(-1)));
  const done = (list) => list.filter((m) => m.status === "completed");
  const minutesOf = (list) => done(list).reduce((sum, m) => sum + m.duration, 0);

  const minutes = minutesOf(meetings);
  const inProgress = meetings.filter((m) => ["queued", "processing"].includes(m.status)).length;
  const failed = meetings.filter((m) => m.status === "failed").length;
  const openActions = actions.filter((a) => a.status !== "completed");
  const recent = [...meetings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const latestDone = recent.find((m) => m.status === "completed");

  return (
    <DashboardLayout title="Dashboard">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-semibold tracking-widest text-blue-700">YOUR WORKSPACE</p>
          <h2 className="text-2xl font-semibold text-gray-900 mt-1">Good to see you, {user.name.split(" ")[0]}</h2>
          <p className="text-sm text-gray-500">Here's what's happening with your meetings.</p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded px-4 py-2"
        >
          <Icon name="plus" /> Upload meeting
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total meetings"
          value={meetings.length}
          icon="file"
          tone="blue"
          trend={diff(thisMonth.length, lastMonth.length)}
          trendUp={thisMonth.length >= lastMonth.length}
        />
        <StatCard
          label="Minutes processed"
          value={minutes}
          icon="clock"
          tone="blue"
          trend={diff(minutesOf(thisMonth), minutesOf(lastMonth))}
          trendUp={minutesOf(thisMonth) >= minutesOf(lastMonth)}
        />
        <StatCard
          label="Completed"
          value={done(meetings).length}
          icon="check"
          tone="green"
          trend={diff(done(thisMonth).length, done(lastMonth).length)}
          trendUp={done(thisMonth).length >= done(lastMonth).length}
        />
        <StatCard
          label="Processing"
          value={inProgress}
          icon="activity"
          tone="yellow"
          hint={inProgress ? "Being processed right now" : "Nothing processing"}
        />
        <StatCard
          label="Failed"
          value={failed}
          icon="alert"
          tone="red"
          hint={failed ? "Open the meeting to retry" : "No failed meetings"}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <div className="lg:col-span-2 min-w-0 space-y-4">
        <Panel
          title="Recent meetings"
          subtitle="Your latest meeting activity"
          className="h-fit"
          actions={
            <Link to="/meetings" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700">
              View all <Icon name="arrow" />
            </Link>
          }
        >
          {recent.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              <p>You don't have any meetings yet.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Link to="/upload" className={smallPrimaryButton}>
                  Upload your first meeting
                </Link>
                {account && (
                  <button
                    onClick={() => addSampleMeetings(account)}
                    className="text-sm border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50"
                  >
                    Add sample meetings
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ul>
              {recent.map((m) => (
                <li key={m.id} className="border-t border-gray-100 first:border-t-0">
                  <Link to={`/meetings/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    <span className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                      <Icon name="mic" className="w-[18px] h-[18px]" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-900 truncate">{m.title}</span>
                      <span className="block text-xs text-gray-500">
                        {formatDate(m.date)} · {m.duration} min · {m.speakers} speakers
                      </span>
                    </span>
                    <StatusBadge status={m.status} />
                    <span className="w-8 h-8 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                      <Icon name="arrow" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        </div>

        <QuickActions
          actions={[
            { to: "/upload", icon: "upload", tone: "blue", title: "Upload a recording", text: "MP3, WAV, MP4 and more" },
            {
              to: "/actions",
              icon: "list",
              tone: "green",
              title: "Review action items",
              text: "Track decisions and deadlines",
              badge: openActions.length || null,
            },
            {
              to: latestDone ? `/meetings/${latestDone.id}?tab=Ask` : "/meetings",
              icon: "sparkles",
              tone: "yellow",
              title: "Ask about a meeting",
              text: latestDone ? `Search "${latestDone.title}"` : "Find answers in your transcripts",
            },
          ]}
        />
      </div>
    </DashboardLayout>
  );
}

export default MemberDashboard;
