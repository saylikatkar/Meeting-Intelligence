import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { navLinks } from "./layouts/DashboardLayout";

import Home from "./pages/public/Home";
import Features from "./pages/public/Features";
import HowItWorks from "./pages/public/HowItWorks";
import Pricing from "./pages/public/Pricing";
import About from "./pages/public/About";
import Contact from "./pages/public/Contact";

import MemberLogin from "./pages/auth/MemberLogin";
import AdminLogin from "./pages/auth/AdminLogin";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";

import MemberDashboard from "./pages/member/MemberDashboard";
import MyMeetings from "./pages/member/MyMeetings";
import MeetingDetail from "./pages/member/MeetingDetail";
import Upload from "./pages/member/Upload";
import ActionItems from "./pages/member/ActionItems";
import Calendar from "./pages/member/Calendar";
import MemberSettings from "./pages/member/MemberSettings";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminSettings from "./pages/admin/AdminSettings";
import MeetingsPage from "./pages/shared/MeetingsPage";
import AnalyticsPage from "./pages/shared/AnalyticsPage";
import ComingSoon from "./pages/ComingSoon";

const dashboards = {
  member: { path: "/dashboard", page: <MemberDashboard /> },
  admin: { path: "/admin", page: <AdminDashboard /> },
};

// sidebar pages; anything not listed here shows a placeholder
const pages = {
  "/meetings": <MyMeetings />,
  "/upload": <Upload />,
  "/actions": <ActionItems />,
  "/calendar": <Calendar />,
  "/settings": <MemberSettings />,
  "/admin/users": <AdminUsers />,
  "/admin/meetings": <MeetingsPage />,
  "/admin/analytics": <AnalyticsPage />,
  "/admin/logs": <AdminLogs />,
  "/admin/settings": <AdminSettings />,
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/features" element={<Features />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />

      <Route path="/login" element={<MemberLogin />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {Object.entries(dashboards).map(([role, { path, page }]) => (
        <Route key={path} path={path} element={<ProtectedRoute role={role}>{page}</ProtectedRoute>} />
      ))}

      {Object.entries(navLinks).flatMap(([role, links]) =>
        links
          .filter((link) => link.to !== dashboards[role].path)
          .map((link) => (
            <Route
              key={link.to}
              path={link.to}
              element={
                <ProtectedRoute role={role}>{pages[link.to] || <ComingSoon title={link.label} />}</ProtectedRoute>
              }
            />
          ))
      )}

      <Route
        path="/meetings/:id"
        element={
          <ProtectedRoute role="member">
            <MeetingDetail />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
