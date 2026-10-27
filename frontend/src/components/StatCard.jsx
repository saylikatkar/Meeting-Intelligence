import Icon from "./Icon";

export const tones = {
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  yellow: "bg-yellow-50 text-yellow-800",
  red: "bg-red-50 text-red-700",
  gray: "bg-gray-100 text-gray-600",
};

// `trend` is a short change like "+2" shown before "vs. last month".
function StatCard({ label, value, hint, icon, tone = "blue", trend, trendUp = true }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className={`flex items-start justify-between gap-2 ${icon ? "min-h-9" : ""}`}>
        <p className="text-sm text-gray-500 leading-[18px]">{label}</p>
        {icon && (
          <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}>
            <Icon name={icon} className="w-[18px] h-[18px]" />
          </span>
        )}
      </div>
      <p className={`text-2xl font-semibold text-gray-900 ${icon ? "mt-0" : "mt-1"}`}>{value}</p>
      {trend !== undefined && (
        <p className="text-xs text-gray-500 mt-1">
          <span className={trendUp ? "text-green-700 font-medium" : "text-red-600 font-medium"}>{trend}</span> vs. last month
        </p>
      )}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default StatCard;
