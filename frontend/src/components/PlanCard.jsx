import Icon from "./Icon";

// One plan: name, price and feature list. `children` adds an action under the price.
// Pass `onSelect` to make the card clickable; `selected` draws the blue outline.
function PlanCard({ plan, current = false, selected = current, onSelect, children }) {
  const selectable = onSelect && {
    role: "button",
    tabIndex: 0,
    "aria-pressed": selected,
    onClick: onSelect,
    onKeyDown: (e) => {
      if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onSelect();
      }
    },
  };

  return (
    <div
      {...selectable}
      className={`rounded-xl border p-5 bg-white ${selected ? "border-blue-700 ring-1 ring-blue-700" : "border-gray-200"} ${
        onSelect ? `cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${selected ? "" : "hover:border-blue-300"}` : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
        {current && (
          <span className="text-[11px] font-bold tracking-wide bg-green-50 text-green-700 rounded-full px-2.5 py-0.5">CURRENT</span>
        )}
      </div>

      <p className="mt-3 text-gray-900">
        <span className="text-3xl font-extrabold">{plan.price}</span>
        <span className="text-sm text-gray-500">{plan.unit || "/month"}</span>
      </p>
      <p className="text-sm text-gray-500 mt-1">{plan.tagline}</p>

      {children}

      <ul className="mt-5 pt-5 border-t border-gray-200 space-y-2.5">
        {plan.features.map(([included, text]) => (
          <li key={text} className={`flex gap-2.5 text-sm ${included ? "text-gray-700" : "text-gray-400"}`}>
            {included ? (
              <Icon name="check" className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
            ) : (
              <Icon name="x" className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PlanCard;
