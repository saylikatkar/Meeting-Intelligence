
import DashboardLayout from "../../layouts/DashboardLayout";
import StatCard from "../../components/StatCard";

import { useData } from "../../context/DataContext";
import { adminStats, todayUsage, meetingsPerDay } from "../../data/mockData";
import { formatDate, formatNumber } from "../../utils/format";

function AdminDashboard() {
  const { meetings, reprocessMeeting } = useData();

  const maxCount = Math.max(...meetingsPerDay.map((d) => d.count), 1);
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
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900">
            Meetings processed — last 7 days
          </h3>

          <div className="h-56 flex items-end gap-3 mt-6">
            {meetingsPerDay.map((d) => (
              <div
                key={d.day}
                className="flex-1 flex flex-col items-center justify-end h-full"
              >
                <span className="text-xs text-gray-600 mb-1">
                  {d.count}
                </span>

                <div
                  className="w-full max-w-10 bg-blue-700 rounded-t"
                  style={{
                    height: `${(d.count / maxCount) * 100}%`,
                  }}
                />

                <span className="text-xs text-gray-500 mt-2">
                  {d.day}
                </span>
              </div>
            ))}
          </div>
        </div>

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
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-lg w-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900 text-lg">
              Failed meetings
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Review and reprocess unsuccessful meetings
            </p>
          </div>

          <span className="text-sm font-medium text-red-600 bg-red-50 rounded-full px-3 py-1">
            {failedMeetings.length} Failed
          </span>
        </div>

        {failedMeetings.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 text-center">
            No failed meetings right now.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {failedMeetings.map((m) => (
              <li
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {m.title}
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    {m.owner}
                    {m.stage && ` · failed at ${m.stage}`} · {formatDate(m.date)}
                  </p>

                  {m.error && (
                    <p className="text-xs text-red-600 mt-1">
                      {m.error}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => reprocessMeeting(m.id)}
                  className="text-sm font-medium border border-gray-300 rounded-lg px-5 py-2 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors shrink-0"
                >
                  Reprocess
                </button>
              </li>
            ))}
          </ul>
        )}
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
