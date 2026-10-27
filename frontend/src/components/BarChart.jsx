// Simple vertical bar chart, same look as the admin dashboard chart.
function BarChart({ data, labelKey, valueKey }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);

  return (
    <div className="flex items-end gap-3 h-48 mt-6">
      {data.map((d) => (
        <div key={d[labelKey]} className="flex-1 flex flex-col items-center justify-end h-full">
          <span className="text-xs text-gray-600 mb-1">{d[valueKey].toLocaleString("en-US")}</span>
          <div className="w-full max-w-10 bg-blue-700 rounded-t" style={{ height: `${(d[valueKey] / max) * 100}%` }} />
          <span className="text-xs text-gray-500 mt-2">{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

export default BarChart;
