import DashboardLayout from "../../layouts/DashboardLayout";
import StatCard from "../../components/StatCard";
import QuickActions from "../../components/QuickActions";
import { useData } from "../../context/DataContext";
import { adminStats, todayUsage, meetingsPerDay } from "../../data/mockData";
import { formatDate, formatNumber } from "../../utils/format";

function AdminDashboard() {
  const { meetings, reprocessMeeting } = useData();

  const maxCount = Math.max(...meetingsPerDay.map((d) => d.count));
  const failedMeetings = meetings.filter((m) => m.status === "failed");

  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total users" value={formatNumber(adminStats.totalUsers)} icon="users" tone="blue" />
        <StatCard label="Active users" value={formatNumber(adminStats.activeUsers)} icon="activity" tone="green" />
        <StatCard label="Total meetings" value={formatNumber(adminStats.totalMeetings)} icon="file" tone="blue" />
        <StatCard label="Audio processed" value={`${formatNumber(adminStats.audioHours)} hrs`} icon="mic" tone="blue" />
        <StatCard label="Successful" value={formatNumber(adminStats.successful)} icon="check" tone="green" />
        <StatCard label="Failed" value={adminStats.failed} icon="alert" tone="red" />
        <StatCard label="Processing now" value={adminStats.processing} icon="clock" tone="yellow" />
        <StatCard
          label="Success rate"
          value={`${((adminStats.successful / adminStats.totalMeetings) * 100).toFixed(1)}%`}
          icon="chart"
          tone="green"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        {/* chart grows so this column matches the height of the right one */}
        <div className="lg:col-span-2 min-w-0 flex flex-col gap-4">
        {/* meetings chart */}
        <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900">Meetings processed — last 7 days</h3>
          <div className="flex-1 min-h-48 flex items-end gap-3 mt-6">
            {meetingsPerDay.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-xs text-gray-600 mb-1">{d.count}</span>
                <div
                  className="w-full max-w-10 bg-blue-700 rounded-t"
                  style={{ height: `${(d.count / maxCount) * 100}%` }}
                />
                <span className="text-xs text-gray-500 mt-2">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* failed meetings */}
        <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Failed meetings</h3>
        </div>
        {failedMeetings.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">No failed meetings right now.</p>
        ) : (
          <ul>
            {failedMeetings.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 first:border-t-0">
                <div>
                  <p className="text-sm text-gray-900">
                    {m.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {m.owner}
                    {m.stage && ` · failed at ${m.stage}`} · {formatDate(m.date)}
                  </p>
                  {m.error && <p className="text-xs text-red-600 mt-0.5">{m.error}</p>}
                </div>
                <button
                  onClick={() => reprocessMeeting(m.id)}
                  className="text-sm border border-gray-300 rounded px-3 py-1 hover:bg-gray-50"
                >
                  Reprocess
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
        </div>

        {/* today */}
        <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900">Today</h3>
          <dl className="mt-3 text-sm divide-y divide-gray-100">
            <Row label="New users" value={`+${todayUsage.newUsers}`} />
            <Row label="Meetings" value={todayUsage.meetings} />
            <Row label="Successful" value={todayUsage.successful} />
            <Row label="Failed" value={todayUsage.failed} />
            <Row label="Audio processed" value={`${todayUsage.audioHours} hrs`} />
            <Row label="AI requests" value={formatNumber(todayUsage.aiRequests)} />
          </dl>
        </div>
        <QuickActions
          actions={[
            { to: "/admin/users", icon: "users", tone: "blue", title: "Manage users", text: "Add, disable or remove accounts" },
            { to: "/admin/meetings", icon: "file", tone: "red", title: "Meetings", text: "Review and reprocess meetings", badge: failedMeetings.length || null },
            { to: "/admin/logs", icon: "logs", tone: "gray", title: "Activity log", text: "Sign-ins and changes" },
            { to: "/admin/settings", icon: "settings", tone: "yellow", title: "System settings", text: "Limits and models" },
          ]}
        />
        </div>
      </div>
    </DashboardLayout>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-2">
      <dt className="text-gray-600">{label}</dt>
      <dd className="text-gray-900 font-medium">{value}</dd>
    </div>
  );
}

export default AdminDashboard;
