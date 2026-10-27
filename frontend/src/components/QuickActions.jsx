import { Link } from "react-router-dom";
import Panel from "./Panel";
import Icon from "./Icon";
import { tones } from "./StatCard";

// "Quick actions" card: rows of shortcuts with an icon and an arrow.
// actions: [{ to | onClick, icon, tone, title, text, badge }]
function QuickActions({ actions }) {
  return (
    <Panel title="Quick actions" subtitle="Keep your work moving" className="h-fit">
      <ul>
        {actions.map((a) => {
          const body = (
            <>
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tones[a.tone || "blue"]}`}>
                <Icon name={a.icon} className="w-[18px] h-[18px]" />
              </span>
              <span className="flex-1 min-w-0 text-left">
                <span className="block text-sm font-medium text-gray-900">{a.title}</span>
                <span className="block text-xs text-gray-500 truncate">{a.text}</span>
              </span>
              {a.badge ? (
                <span className="text-xs font-medium bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">{a.badge}</span>
              ) : null}
              <Icon name="arrow" className="w-4 h-4 text-gray-400 shrink-0" />
            </>
          );
          const cls = "w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50";
          return (
            <li key={a.title} className="border-t border-gray-100 first:border-t-0">
              {a.to ? (
                <Link to={a.to} className={cls}>
                  {body}
                </Link>
              ) : (
                <button type="button" onClick={a.onClick} className={cls}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export default QuickActions;
