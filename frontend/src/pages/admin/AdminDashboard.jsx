
import { useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import StatCard from "../../components/StatCard";
import QuickActions from "../../components/QuickActions";
import api from "../../services/api";
import { formatDate, formatNumber } from "../../utils/format";

function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    let isFetching = false;

    async function fetchDashboard(isInitial = false) {
      if (isFetching) return;

      isFetching = true;

      if (isInitial && isMounted) {
        setLoading(true);
      }

      try {
        const response = await api.get("/admin/dashboard/");

        if (isMounted) {
          setDashboard(response.data);
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.response?.data?.detail ||
            err.response?.data?.error ||
            "Unable to load admin dashboard data."
          );
        }
      } finally {
        isFetching = false;

        if (isMounted && isInitial) {
          setLoading(false);
        }
      }
    }

    // Initial dashboard data fetch
    fetchDashboard(true);

    // Automatically refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchDashboard(false);
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, []);

  const overview = dashboard?.overview || {};
  const todayUsage = dashboard?.todayUsage || {};
  const meetingsPerDay = dashboard?.meetingsPerDay || [];
  const failedMeetings = dashboard?.failedMeetings || [];

  const totalMeetings = overview.totalMeetings || 0;
  const successful = overview.successfulTranscriptions || 0;

  const successRate = totalMeetings
    ? ((successful / totalMeetings) * 100).toFixed(1)
    : "0.0";

  const maxCount = Math.max(
    1,
    ...meetingsPerDay.map((day) => Number(day.count) || 0)
  );

  return (
    <DashboardLayout title="Admin Dashboard">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <p className="mb-4 text-sm text-gray-500">
          Loading dashboard data...
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total users"
          value={formatNumber(overview.totalUsers || 0)}
          icon="users"
          tone="blue"
        />

        <StatCard
          label="Active users"
          value={formatNumber(overview.activeUsers || 0)}
          icon="activity"
          tone="green"
        />

        <StatCard
          label="Total meetings"
          value={formatNumber(totalMeetings)}
          icon="file"
          tone="blue"
        />

        <StatCard
          label="Audio processed"
          value={`${formatNumber(overview.totalAudioProcessedHours || 0)} hrs`}
          icon="mic"
          tone="blue"
        />

        <StatCard
          label="Successful"
          value={formatNumber(successful)}
          icon="check"
          tone="green"
        />

        <StatCard
          label="Failed"
          value={formatNumber(overview.failedTranscriptions || 0)}
          icon="alert"
          tone="red"
        />

        <StatCard
          label="Processing now"
          value={formatNumber(overview.processing || 0)}
          icon="clock"
          tone="yellow"
        />

        <StatCard
          label="Success rate"
          value={`${successRate}%`}
          icon="chart"
          tone="green"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <div className="lg:col-span-2 min-w-0 flex flex-col gap-4">

          {/* Meetings processed chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900">
              Meetings processed — last 7 days
            </h3>

            <div className="h-56 flex items-end gap-3 mt-6">
              {meetingsPerDay.map((day) => {
                const count = Number(day.count) || 0;

                const barHeight = count > 0
                  ? Math.max((count / maxCount) * 100, 4)
                  : 0;

                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center justify-end h-full"
                  >
                    <span className="text-xs text-gray-600 mb-1">
                      {count}
                    </span>

                    <div className="w-full max-w-10 h-40 flex items-end">
                      <div
                        className="w-full bg-blue-700 rounded-t"
                        style={{
                          height: `${barHeight}%`,
                        }}
                      />
                    </div>

                    <span className="text-xs text-gray-500 mt-2">
                      {day.day}
                    </span>
                  </div>
                );
              })}

              {!loading && meetingsPerDay.length === 0 && (
                <p className="w-full text-center text-sm text-gray-500">
                  No meeting data available.
                </p>
              )}
            </div>
          </div>

          {/* Failed meetings */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">
                Failed meetings
              </h3>
            </div>

            {failedMeetings.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500">
                No failed meetings right now.
              </p>
            ) : (
              <ul>
                {failedMeetings.map((meeting) => (
                  <li
                    key={meeting.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 first:border-t-0"
                  >
                    <div>
                      <p className="text-sm text-gray-900">
                        {meeting.title}
                      </p>

                      <p className="text-xs text-gray-500">
                        {meeting.owner}
                        {meeting.stage && ` · failed at ${meeting.stage}`}
                        {meeting.date && ` · ${formatDate(meeting.date)}`}
                      </p>

                      {meeting.error && (
                        <p className="text-xs text-red-600 mt-0.5">
                          {meeting.error}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Today's usage and quick actions */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900">
              Today
            </h3>

            <dl className="mt-3 text-sm divide-y divide-gray-100">
              <Row
                label="New users"
                value={`+${todayUsage.newUsers || 0}`}
              />

              <Row
                label="Meetings"
                value={todayUsage.meetings || 0}
              />

              <Row
                label="Successful"
                value={todayUsage.successful || 0}
              />

              <Row
                label="Failed"
                value={todayUsage.failed || 0}
              />

              <Row
                label="Audio processed"
                value={`${todayUsage.audioHours || 0} hrs`}
              />

              <Row
                label="AI requests"
                value={formatNumber(todayUsage.aiRequests || 0)}
              />
            </dl>
          </div>

          <QuickActions
            actions={[
              {
                to: "/admin/users",
                icon: "users",
                tone: "blue",
                title: "Manage users",
                text: "Add, disable or remove accounts",
              },
              {
                to: "/admin/meetings",
                icon: "file",
                tone: "red",
                title: "Meetings",
                text: "Review and reprocess meetings",
                badge: failedMeetings.length || null,
              },
              {
                to: "/admin/logs",
                icon: "logs",
                tone: "gray",
                title: "Activity log",
                text: "Sign-ins and changes",
              },
              {
                to: "/admin/settings",
                icon: "settings",
                tone: "yellow",
                title: "System settings",
                text: "Limits and models",
              },
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
