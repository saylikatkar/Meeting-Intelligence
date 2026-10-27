import { Navigate } from "react-router-dom";
import { useAuth, isAuthorized } from "../context/AuthContext";

const loginPaths = {
  member: "/login",
  admin: "/admin/login",
};

function ProtectedRoute({ role, children }) {
  const { user } = useAuth();

  if (!isAuthorized(user, role)) {
    return <Navigate to={loginPaths[role]} replace />;
  }

  return children;
}

export default ProtectedRoute;
