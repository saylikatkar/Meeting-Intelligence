// Class names shared by forms and buttons across the admin pages.
export const inputClass =
  "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-600";
export const searchClass =
  "border border-gray-300 rounded px-3 py-1.5 text-sm w-60 focus:outline-none focus:border-blue-600";
export const selectClass = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-600";
export const primaryButton =
  "bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded px-4 py-2 disabled:opacity-60";
export const secondaryButton = "text-sm border border-gray-300 rounded px-3 py-1 hover:bg-gray-50";
export const smallPrimaryButton =
  "bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded px-3 py-1.5 disabled:opacity-60";

// small buttons for row actions (Open, Disable, Delete...)
const actionBase = "inline-flex items-center text-xs font-medium rounded-md border px-2.5 py-1";
export const actionPrimary = `${actionBase} border-blue-700 text-blue-700 hover:bg-blue-50`;
export const actionButton = `${actionBase} border-gray-300 text-gray-700 hover:bg-gray-50`;
export const actionDanger = `${actionBase} border-red-200 text-red-600 hover:bg-red-50`;
