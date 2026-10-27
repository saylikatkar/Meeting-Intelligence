// Label + value with a horizontal bar, used for breakdowns.
function ProgressRow({ label, value, max, display }) {
  const percent = max ? Math.round((value / max) * 100) : 0;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-900">{display ?? value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded">
        <div className="h-2 bg-blue-700 rounded" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default ProgressRow;
