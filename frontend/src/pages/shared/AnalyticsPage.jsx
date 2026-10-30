import DashboardLayout from "../../layouts/DashboardLayout";
import StatCard from "../../components/StatCard";
import Panel from "../../components/Panel";
import BarChart from "../../components/BarChart";
import ProgressRow from "../../components/ProgressRow";
import { useData } from "../../context/DataContext";
import { adminStats, todayUsage, meetingsPerDay, monthlyStats, failureReasons } from "../../data/mockData";
import { formatNumber } from "../../utils/format";

function AnalyticsPage() {
  const { users, meetings } = useData();

  const successRate = ((adminStats.successful / adminStats.totalMeetings) * 100).toFixed(1);
  const avgMinutes = meetings.length ? Math.round(meetings.reduce((sum, m) => sum + m.duration, 0) / meetings.length) : 0;
  const topUsers = [...users].sort((a, b) => b.minutes - a.minutes).slice(0, 5);
  const maxFailures = Math.max(...failureReasons.map((r) => r.count));

  return (
    <DashboardLayout title="Analytics">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Success rate" value={`${successRate}%`} />
        <StatCard label="Avg. meeting length" value={`${avgMinutes} min`} />
        <StatCard
          label="Active users"
          value={formatNumber(adminStats.activeUsers)}
          hint={`of ${formatNumber(adminStats.totalUsers)} total`}
        />
        <StatCard label="Meetings today" value={todayUsage.meetings} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <Panel title="Meetings processed — last 7 days" className="min-w-0">
          <div className="px-4 pb-4">
            <BarChart data={meetingsPerDay} labelKey="day" valueKey="count" />
          </div>
        </Panel>
        <Panel title="New users per month" className="min-w-0">
          <div className="px-4 pb-4">
            <BarChart data={monthlyStats} labelKey="month" valueKey="newUsers" />
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <Panel title="Processing outcomes">
          <div className="p-4 space-y-4">
            <ProgressRow
              label="Successful"
              value={adminStats.successful}
              max={adminStats.totalMeetings}
              display={formatNumber(adminStats.successful)}
            />
            <ProgressRow label="Failed" value={adminStats.failed} max={adminStats.totalMeetings} />
            <ProgressRow label="Processing" value={adminStats.processing} max={adminStats.totalMeetings} />
          </div>
        </Panel>

        <Panel title="Top users by minutes">
          <div className="p-4 space-y-4">
            {topUsers.map((u) => (
              <ProgressRow key={u.id} label={u.name} value={u.minutes} max={topUsers[0].minutes} display={`${u.minutes} min`} />
            ))}
          </div>
        </Panel>

        <Panel title="Failure reasons">
          <div className="p-4 space-y-4">
            {failureReasons.map((r) => (
              <ProgressRow key={r.reason} label={r.reason} value={r.count} max={maxFailures} />
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Monthly overview" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="px-4 py-2 font-normal">Month</th>
                <th className="px-4 py-2 font-normal">New users</th>
                <th className="px-4 py-2 font-normal">Meetings</th>
                <th className="px-4 py-2 font-normal">Audio hours</th>
              </tr>
            </thead>
            <tbody>
              {monthlyStats.map((m) => (
                <tr key={m.month} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 text-gray-900">{m.month}</td>
                  <td className="px-4 py-2.5 text-gray-600">{formatNumber(m.newUsers)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{formatNumber(m.meetings)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{formatNumber(m.audioHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <StatCard label="AI requests today" value={formatNumber(todayUsage.aiRequests)} />
        <StatCard label="Audio today" value={`${todayUsage.audioHours} hrs`} />
        <StatCard label="Audio all time" value={`${formatNumber(adminStats.audioHours)} hrs`} />
        <StatCard label="Failed all time" value={adminStats.failed} />
      </div>
    </DashboardLayout>
  );
}

export default AnalyticsPage;
