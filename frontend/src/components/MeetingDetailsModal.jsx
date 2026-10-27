import Modal from "./Modal";
import StatusBadge from "./StatusBadge";
import { useData } from "../context/DataContext";
import { formatDate } from "../utils/format";

function MeetingDetailsModal({ meeting, onClose }) {
  const { actions } = useData();
  const items = actions.filter((a) => a.meetingId === meeting.id);

  return (
    <Modal title={meeting.title} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
        <StatusBadge status={meeting.status} />
        <span>{meeting.owner}</span>
        <span>· {formatDate(meeting.date)}</span>
        <span>· {meeting.duration} min</span>
        <span>· {meeting.speakers} speakers</span>
      </div>

      <h3 className="font-medium text-gray-900 mt-5">Summary</h3>
      <p className="text-sm text-gray-600 mt-1">
        {meeting.summary || "The summary will appear here once processing is complete."}
      </p>

      <h3 className="font-medium text-gray-900 mt-5">Action items</h3>
      {items.length ? (
        <ul className="mt-1 text-sm text-gray-600 list-disc pl-5 space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              {item.task} <span className="text-gray-400">· {item.assignee} · {item.status}</span>
            </li>
          ))}
        
        </ul>
      ) : (
        <p className="text-sm text-gray-500 mt-1">No action items.</p>
      )}
    </Modal>
  );
}

export default MeetingDetailsModal;
