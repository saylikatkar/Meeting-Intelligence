import Icon from "./Icon";

// Search field with a magnifier icon, used in page toolbars.
function SearchBox({ value, onChange, placeholder, className = "w-full sm:w-72" }) {
  return (
    <label
      className={`flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus-within:border-blue-600 ${className}`}
    >
      <Icon name="search" className="w-4 h-4 text-gray-400 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none focus:shadow-none"
      />
    </label>
  );
}

export default SearchBox;
