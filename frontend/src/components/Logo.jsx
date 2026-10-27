import { Link } from "react-router-dom";
import Icon from "./Icon";

// Brand mark + name, same as the sidebar but for light pages (login, sign-up).
function Logo({ to = "/login", className = "" }) {
  return (
    <Link to={to} className={`flex items-center gap-3 ${className}`}>
      <span className="sb-logo w-10 h-10 rounded-xl flex items-center justify-center">
        <Icon name="sparkles" className="w-5 h-5" />
      </span>
      <span className="leading-tight">
        <span className="block font-bold text-lg text-gray-900" style={{ fontFamily: "var(--display)" }}>
          Meeting<span className="text-blue-700">Intel</span>
        </span>
        <span className="block text-[10px] font-semibold tracking-[0.14em] text-gray-500">AI MEETING INTELLIGENCE</span>
      </span>
    </Link>
  );
}

export default Logo;
