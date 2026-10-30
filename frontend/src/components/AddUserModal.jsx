import { useState } from "react";
import Modal from "./Modal";
import { useData } from "../context/DataContext";
import { inputClass, primaryButton } from "./ui";

function AddUserModal({ onClose }) {
  const { users, addUser } = useData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Please enter a name and email.");
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
      setError("A user with this email already exists.");
      return;
    }
    addUser({ name: name.trim(), email: email.trim(), role: "member" });
    onClose();
  }

  return (
    <Modal title="Add user" onClose={onClose}>
      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="new-name" className="block text-sm font-medium text-gray-700 mb-1">
            Full name
          </label>
          <input id="new-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="new-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <button type="submit" className={`w-full ${primaryButton}`}>
          Create account
        </button>
      </form>
    </Modal>
  );
}

export default AddUserModal;
