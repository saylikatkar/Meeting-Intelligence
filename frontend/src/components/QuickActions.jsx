
import { Link } from "react-router-dom";

function QuickActions({ actions = [] }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Quick actions</h3>

      {actions.map((action, index) => (
        <Link
          key={index}
          to={action.to}
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition"
        >
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
              tones[action.tone] || tones.blue
            }`}
          >
            <span className="text-lg">
              {action.icon === "upload" && "↑"}
              {action.icon === "list" && "☷"}
              {action.icon === "sparkles" && "✦"}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">
              {action.title}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {action.text}
            </p>
          </div>

          {action.badge && (
            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
              {action.badge}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

export default QuickActions;
