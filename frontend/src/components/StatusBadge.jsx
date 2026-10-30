const styles = {
  completed: "bg-green-50 text-green-700",
  active: "bg-green-50 text-green-700",
  processing: "bg-yellow-50 text-yellow-800",
  queued: "bg-gray-100 text-gray-700",
  failed: "bg-red-50 text-red-700",
  disabled: "bg-gray-100 text-gray-500",
  cancelled: "bg-gray-100 text-gray-500",
  info: "bg-gray-100 text-gray-700",
  warning: "bg-yellow-50 text-yellow-800",
  error: "bg-red-50 text-red-700",
  admin: "bg-red-50 text-red-700",
  member: "bg-gray-100 text-gray-700",
  pending: "bg-yellow-50 text-yellow-800",
  "in progress": "bg-blue-50 text-blue-700",
  high: "bg-red-50 text-red-700",
  medium: "bg-yellow-50 text-yellow-800",
  low: "bg-gray-100 text-gray-700",
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded capitalize ${styles[status] || "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

export default StatusBadge;
