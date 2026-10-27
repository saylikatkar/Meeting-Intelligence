import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useData, useMember } from "../context/DataContext";
import Icon from "../components/Icon";
import PlansModal from "../components/PlansModal";
import { formatDate, formatDateTime } from "../utils/format";

export const navLinks = {
  member: [
    { to: "/dashboard", label: "Dashboard", icon: "grid" },
    { to: "/meetings", label: "My Meetings", icon: "file" },
    { to: "/upload", label: "Upload", icon: "upload" },
    { to: "/actions", label: "Action Items", icon: "list" },
    { to: "/calendar", label: "Calendar", icon: "calendar" },
    { to: "/settings", label: "Settings", icon: "settings" },
  ],
  admin: [
    { to: "/admin", label: "Dashboard", icon: "grid" },
    { to: "/admin/users", label: "Users", icon: "users" },
    { to: "/admin/meetings", label: "Meetings", icon: "file" },
    { to: "/admin/analytics", label: "Analytics", icon: "chart" },
    { to: "/admin/logs", label: "Logs", icon: "logs" },
    { to: "/admin/settings", label: "Settings", icon: "settings" },
  ],
};

const loginPaths = {
  member: "/login",
  admin: "/admin/login",
};

const sectionLabels = { member: "Workspace", admin: "Administration" };

function initials(name) {
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function DashboardLayout({ title, children }) {
  const { user, logout } = useAuth();
  const { meetings, logs, settings } = useData();
  const member = useMember();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);

  const role = user.role;
  const links = navLinks[role];
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  // sidebar badges
  const openActions = member.actions.filter((a) => a.status !== "completed");
  const failedMeetings = meetings.filter((m) => m.status === "failed").length;
  const badges = {
    "/actions": openActions.length,
    "/admin/meetings": failedMeetings,
  };

  // bell: tasks due soon + finished meetings for members, recent activity for admins
  const notifications =
    role === "member"
      ? [
          ...openActions
            .filter((a) => a.due <= soon)
            .map((a) => ({ id: a.id, to: "/actions", text: `${a.due < today ? "Overdue" : "Due"}: ${a.task}`, meta: formatDate(a.due) })),
          ...member.meetings
            .filter((m) => m.status === "completed" && m.date >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
            .map((m) => ({ id: m.id, to: `/meetings/${m.id}`, text: `"${m.title}" is ready`, meta: formatDate(m.date) })),
        ].slice(0, 6)
      : logs.slice(0, 6).map((l) => ({ id: l.id, to: role === "admin" ? "/admin/logs" : null, text: l.message, meta: formatDateTime(l.time) }));

  const thisMonth = new Date().toISOString().slice(0, 7);
  const usedThisMonth = member.meetings.filter((m) => !m.example && m.date.startsWith(thisMonth)).length;

  function handleLogout() {
    logout();
    navigate(loginPaths[role]);
  }

  return (
    <div className="min-h-screen flex">
      {/* sidebar */}
      <aside
        className={`sidebar fixed inset-y-0 left-0 z-20 w-64 flex flex-col transform transition-transform md:translate-x-0 md:sticky md:top-0 md:h-screen ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link to={links[0].to} className="flex items-center gap-3 px-5 h-16 shrink-0">
          <span className="sb-logo w-9 h-9 rounded-xl flex items-center justify-center">
            <Icon name="sparkles" className="w-5 h-5" />
          </span>
          <span className="leading-tight">
            <span className="sb-title block font-bold text-[17px]">
              Meeting<span className="sb-accent">Intel</span>
            </span>
            <span className="sb-muted block text-[10px] font-semibold tracking-[0.14em]">AI MEETING INTELLIGENCE</span>
          </span>
        </Link>

        <p className="sb-muted px-6 mt-4 mb-2 text-[11px] font-semibold tracking-[0.14em] uppercase">{sectionLabels[role]}</p>

        <nav className="px-3 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `sb-link ${isActive ? "active" : ""} flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm`}
            >
              <Icon name={link.icon} className="w-[18px] h-[18px]" />
              <span className="flex-1">{link.label}</span>
              {badges[link.to] > 0 && <span className="sb-badge text-[11px] font-semibold rounded-md px-1.5">{badges[link.to]}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto p-3 space-y-3">
          {role === "member" && (
            <div className="sb-card rounded-xl p-4">
              <p className="sb-accent flex items-center gap-1.5 text-xs font-semibold">
                <Icon name="zap" className="w-3.5 h-3.5" /> Workspace usage
              </p>
              <p className="sb-title mt-2 text-sm">
                <span className="text-xl font-bold">
                  {usedThisMonth} of {settings.monthlyLimit}
                </span>{" "}
                <span className="sb-muted text-xs">meetings this month</span>
              </p>
              <div className="sb-track h-1.5 rounded mt-2">
                <div
                  className="sb-fill h-1.5 rounded"
                  style={{ width: `${Math.min(100, (usedThisMonth / settings.monthlyLimit) * 100)}%` }}
                />
              </div>
              <button onClick={() => setPlansOpen(true)} className="sb-accent inline-flex items-center gap-1 text-xs font-semibold mt-3">
                View plans <Icon name="arrow" className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="sb-user flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className="sb-avatar w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
              {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : initials(user.name)}
            </span>
            <span className="flex-1 min-w-0 leading-tight">
              <span className="sb-title block text-sm font-semibold truncate">{user.name}</span>
              <span className="sb-muted block text-xs capitalize">{role}</span>
            </span>
            <button onClick={handleLogout} className="sb-icon-btn rounded-md p-1.5" title="Log out" aria-label="Log out">
              <Icon name="logout" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {menuOpen && <div className="fixed inset-0 z-10 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)} />}

      {/* main */}
      <div className="flex-1 min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden border border-gray-300 rounded p-1.5 text-gray-600"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" />
            </button>
            <h1 className="font-semibold text-gray-900">{title}</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setBellOpen(!bellOpen)}
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100"
                aria-label="Notifications"
              >
                <Icon name="bell" className="w-[18px] h-[18px]" />
                {notifications.length > 0 && <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-red-600" />}
              </button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 z-30 bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <p className="px-4 py-3 border-b border-gray-200 text-sm font-semibold text-gray-900">
                      {role === "member" ? "Notifications" : "Recent activity"}
                    </p>
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-gray-500 text-center">You're all caught up.</p>
                    ) : (
                      <ul className="max-h-80 overflow-y-auto">
                        {notifications.map((n) => {
                          const body = (
                            <>
                              <span className="block text-sm text-gray-900">{n.text}</span>
                              <span className="block text-xs text-gray-500 mt-0.5">{n.meta}</span>
                            </>
                          );
                          return (
                            <li key={n.id} className="border-t border-gray-100 first:border-t-0">
                              {n.to ? (
                                <Link to={n.to} onClick={() => setBellOpen(false)} className="block px-4 py-2.5 hover:bg-gray-50">
                                  {body}
                                </Link>
                              ) : (
                                <div className="px-4 py-2.5">{body}</div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5 pl-1">
              <span className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold overflow-hidden">
                {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : initials(user.name)}
              </span>
              <span className="hidden sm:block leading-tight">
                <span className="block text-sm font-semibold text-gray-900">{user.name}</span>
                <span className="block text-xs text-gray-500">{user.email}</span>
              </span>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-8">{children}</main>
        {plansOpen && <PlansModal onClose={() => setPlansOpen(false)} />}
      </div>
    </div>
  );
}

export default DashboardLayout;
