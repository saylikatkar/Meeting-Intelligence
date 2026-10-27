import Modal from "./Modal";
import StatusBadge from "./StatusBadge";
import { useData } from "../context/DataContext";
import { formatDate } from "../utils/format";
import { planNames } from "./PlansModal";

function UserDetailsModal({ user, onClose }) {
  const { meetings } = useData();
  const userMeetings = meetings.filter((m) => m.ownerId === user.id);

  return (
    <Modal title={user.name} onClose={onClose}>
      <dl className="text-sm divide-y divide-gray-100">
        <Detail label="Email" value={user.email} />
        <Detail label="Role" value={<StatusBadge status={user.role} />} />
        <Detail label="Plan" value={planNames[user.plan || "free"]} />
        <Detail label="Status" value={<StatusBadge status={user.status} />} />
        <Detail label="Meetings" value={user.meetings} />
        <Detail label="Minutes processed" value={user.minutes} />
        <Detail label="Joined" value={formatDate(user.joined)} />
        <Detail label="Last login" value={formatDate(user.lastLogin)} />
      </dl>

      <h3 className="font-medium text-gray-900 mt-5">Recent meetings</h3>
      {userMeetings.length === 0 ? (
        <p className="text-sm text-gray-500 mt-2">No meetings yet.</p>
      ) : (
        <ul className="mt-2 text-sm">
          {userMeetings.map((m) => (
            <li key={m.id} className="flex justify-between items-center py-2 border-t border-gray-100 first:border-t-0">
              <span className="text-gray-900">
                {m.title} <span className="text-gray-400">· {formatDate(m.date)}</span>
              </span>
              <StatusBadge status={m.status} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex justify-between py-2">
      <dt className="text-gray-600">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  );
}

export default UserDetailsModal;
