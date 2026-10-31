
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import StatusBadge from "../../components/StatusBadge";
import Panel from "../../components/Panel";
import ActionList from "../../components/ActionList";
import { useData, useMember } from "../../context/DataContext";
import { formatDate } from "../../utils/format";
import { formatTimestamp, processingStages } from "../../utils/meetingContent";
import { exportFormats, exportMeeting } from "../../utils/meetingExport";
import {
  inputClass,
  primaryButton,
  secondaryButton,
  selectClass,
} from "../../components/ui";
import SearchBox from "../../components/SearchBox";
import api from "../../services/api";

const tabs = [
  "Overview",
  "Transcript",
  "Deadlines",
  "Action items",
  "Ask",
  "Processing",
];

function getId(item) {
  return String(item?.id ?? item?._id ?? "");
}

function getSeconds(segment) {
  return Number(segment?.startTime ?? segment?.seconds ?? 0);
}

function getSpeakerLabel(segment) {
  return (
    segment?.speakerLabel ||
    segment?.speaker ||
    segment?.speakerName ||
    "Speaker"
  );
}

function getDeadlineText(item) {
  if (typeof item === "string") return item;

  return (
    item?.description ||
    item?.task ||
    item?.title ||
    item?.text ||
    item?.deadline ||
    "Deadline identified"
  );
}

function getDeadlineDate(item) {
  if (typeof item === "string") return "";

  return (
    item?.date ||
    item?.dueDate ||
    item?.deadlineDate ||
    item?.due ||
    ""
  );
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace original speaker labels and previously assigned names
 * with the currently assigned speaker names.
 *
 * Example:
 * Speaker 1 -> Sayli
 * John -> Sayli (if John was the previous assigned name)
 */
function replaceSpeakerNames(text, speakerNames = {}, speakerAliases = {}) {
  if (text === null || text === undefined || text === "") return "";

  let result = String(text);
  const replacements = [];

  // Replace old assigned names with their current names.
  Object.entries(speakerAliases).forEach(([label, oldName]) => {
    const currentName = speakerNames[label];

    if (
      oldName &&
      currentName &&
      oldName !== currentName
    ) {
      replacements.push([oldName, currentName]);
    }
  });

  // Replace original transcript labels with current assigned names.
  Object.entries(speakerNames).forEach(([label, currentName]) => {
    if (
      label &&
      currentName &&
      label.toLowerCase() !== String(currentName).toLowerCase()
    ) {
      replacements.push([label, currentName]);
    }
  });

  // Longer names first to reduce partial replacement conflicts.
  replacements.sort((a, b) => b[0].length - a[0].length);

  replacements.forEach(([oldValue, newValue]) => {
    if (!oldValue || !newValue) return;

    const escaped = escapeRegex(oldValue);

    // Match complete names/labels rather than replacing parts of words.
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`,
      "giu"
    );

    result = result.replace(pattern, (match, prefix) => `${prefix}${newValue}`);
  });

  return result;
}

function normalizeSpeakerRecords(records) {
  const names = {};

  if (!Array.isArray(records)) return names;

  records.forEach((speaker) => {
    if (!speaker || typeof speaker !== "object") return;

    const label =
      speaker.label ||
      speaker.speakerLabel ||
      speaker.speaker_label ||
      speaker.speaker;

    const name =
      speaker.name ||
      speaker.displayName ||
      speaker.display_name ||
      label;

    if (label) names[String(label)] = String(name || label);
  });

  return names;
}

function normalizeTextItems(items) {
  return Array.isArray(items) ? items : [];
}

function MeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings, deleteMeeting, reprocessMeeting } = useData();
  const { account } = useMember();
  const [searchParams] = useSearchParams();

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [tab, setTab] = useState(
    tabs.includes(searchParams.get("tab"))
      ? searchParams.get("tab")
      : "Overview"
  );

  const [search, setSearch] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState("");

  const [format, setFormat] = useState(
    account?.prefs?.defaultExport || "pdf"
  );
  const [exportError, setExportError] = useState("");

  const [speakerDrafts, setSpeakerDrafts] = useState({});
  const [savingSpeaker, setSavingSpeaker] = useState("");
  const [speakerMessage, setSpeakerMessage] = useState("");
  const [speakerAliases, setSpeakerAliases] = useState({});

  const [savingTitle, setSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const fetchMeeting = useCallback(async (showLoading = true) => {
    if (!id) {
      setLoadError("Meeting ID is missing.");
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    setLoadError("");

    try {
      const response = await api.get(
        `/meetings/${encodeURIComponent(id)}/`
      );

      const data = response.data;

      let savedSpeakers = Array.isArray(data.speakers)
        ? data.speakers
        : [];

      try {
        const speakersResponse = await api.get(
          `/meetings/${encodeURIComponent(id)}/speakers/`
        );

        const responseSpeakers = speakersResponse.data?.speakers;

        if (Array.isArray(responseSpeakers)) {
          savedSpeakers = responseSpeakers;
        }
      } catch (error) {
        console.warn(
          "Could not load speaker records:",
          error.response?.data || error.message
        );
      }

      const serverSpeakerNames = normalizeSpeakerRecords(savedSpeakers);

      const segments = Array.isArray(data.transcriptSegments)
        ? data.transcriptSegments
        : Array.isArray(data.transcript)
          ? data.transcript
          : [];

      const normalizedSegments = segments.map((segment, index) => ({
        ...segment,
        id: getId(segment) || `segment-${index}`,
        text: segment.text || "",
        seconds: getSeconds(segment),
        speaker: getSpeakerLabel(segment),
      }));

      const normalized = {
        ...data,
        id: String(data.id || data._id || id),
        title: data.title || "Untitled meeting",
        date: data.createdAt || data.date || "",
        duration: Number(data.duration || 0),
        speakers: Number(
          data.speakerCount || savedSpeakers.length || 0
        ),
        fileName: data.originalFileName || data.fileName || "",
        sizeMb: data.fileSize
          ? (Number(data.fileSize) / (1024 * 1024)).toFixed(2)
          : data.sizeMb || "",
        recordingUrl: data.cloudinaryUrl || data.fileUrl || "",
        transcript: normalizedSegments,
        speakerNames: serverSpeakerNames,
        summary: data.summary ?? data.analysis?.summary ?? "",
        keyPoints: normalizeTextItems(
          data.keyPoints ?? data.analysis?.keyPoints
        ),
        decisions: normalizeTextItems(
          data.decisions ?? data.analysis?.decisions
        ),
        deadlines: normalizeTextItems(
          data.deadlines ?? data.analysis?.deadlines
        ),
        actionItems: normalizeTextItems(
          data.actionItems ?? data.analysis?.actionItems
        ),
        stage: data.job?.currentStage || data.currentStage || "",
        error: data.job?.error || data.error || "",
      };

      setMeeting((previous) => {
        if (!previous || previous.id !== normalized.id) {
          return normalized;
        }

        // Keep the existing mapping during polling so a temporary stale
        // server response does not undo a recently saved rename.
        return {
          ...normalized,
          speakerNames: {
            ...serverSpeakerNames,
            ...previous.speakerNames,
          },
        };
      });

      setNewTitle((previous) => previous || normalized.title);

      setSpeakerDrafts((previous) => ({
        ...serverSpeakerNames,
        ...previous,
      }));

      // Preserve previous names as aliases. The current name is always
      // read from speakerNames, so aliases can be used to update old text.
      setSpeakerAliases((previous) => {
        const next = { ...previous };

        Object.entries(serverSpeakerNames).forEach(([label, name]) => {
          if (!(label in next)) {
            next[label] = name;
          }
        });

        return next;
      });
    } catch (error) {
      setLoadError(
        error.response?.data?.error ||
          "Unable to load this meeting. Check the backend server and meeting ID."
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMeeting();

    const timer = window.setInterval(() => {
      fetchMeeting(false);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [fetchMeeting]);

  if (loading && !meeting) {
    return (
      <DashboardLayout title="Meeting">
        <Panel>
          <p className="p-6 text-sm text-gray-500">
            Loading meeting details...
          </p>
        </Panel>
      </DashboardLayout>
    );
  }

  if (!meeting) {
    return (
      <DashboardLayout title="Meeting">
        <Panel>
          <div className="p-8 text-center">
            <p className="text-sm text-red-600">
              {loadError || "Meeting not found."}
            </p>

            <Link
              to="/meetings"
              className="inline-block mt-4 text-sm text-blue-700 hover:underline"
            >
              Back to my meetings
            </Link>

            <button
              onClick={() => fetchMeeting()}
              className={`${secondaryButton} ml-3`}
            >
              Retry
            </button>
          </div>
        </Panel>
      </DashboardLayout>
    );
  }

  const ready = meeting.status === "completed";
  const transcript = meeting.transcript || [];
  const speakers = meeting.speakerNames || {};
  const deadlines = meeting.deadlines || [];
  const meetingActions = meeting.actionItems || [];
  const term = search.toLowerCase();

  const displayText = (text) =>
    replaceSpeakerNames(text, speakers, speakerAliases);

  const visibleLines = transcript.filter((line) =>
    `${speakers[line.speaker] || line.speaker} ${line.text}`
      .toLowerCase()
      .includes(term)
  );

  const speakerKeys = [
    ...new Set(transcript.map((line) => line.speaker).filter(Boolean)),
  ];

  const recordingUrl = meeting.recordingUrl;

  const currentStage = ready
    ? processingStages.length
    : Math.max(0, processingStages.indexOf(meeting.stage));

  async function saveTitle() {
    if (!newTitle.trim()) {
      setTitleError("Meeting title cannot be empty.");
      return;
    }

    setSavingTitle(true);
    setTitleError("");

    try {
      await api.patch(
        `/meetings/${encodeURIComponent(meeting.id)}/`,
        { title: newTitle.trim() }
      );

      setMeeting((current) => ({
        ...current,
        title: newTitle.trim(),
      }));
    } catch (error) {
      setTitleError(
        error.response?.data?.error ||
          "Could not update the meeting title."
      );
    } finally {
      setSavingTitle(false);
    }
  }

  async function saveTranscriptLine(lineId, text) {
    const updatedTranscript = transcript.map((line) =>
      line.id === lineId ? { ...line, text } : line
    );

    setMeeting((current) => ({
      ...current,
      transcript: updatedTranscript,
    }));

    const segment = transcript.find((line) => line.id === lineId);

    if (!segment?._id && !segment?.id) return;

    try {
      await api.patch(
        `/transcript/${encodeURIComponent(segment._id || segment.id)}/`,
        { text }
      );
    } catch (error) {
      console.error("Transcript save failed:", error);

      setLoadError(
        "A transcript edit could not be saved to the backend. Please refresh and check the segment API route."
      );
    }
  }

  function renameSpeaker(key, name) {
    setSpeakerDrafts((previous) => ({
      ...previous,
      [key]: name,
    }));

    setSpeakerMessage("");
  }

  async function saveSpeakerName(key) {
    const name = (speakerDrafts[key] || "").trim();

    if (!name) {
      setSpeakerMessage("Please enter a speaker name.");
      return;
    }

    const oldName = speakers[key] || key;

    setSavingSpeaker(key);
    setSpeakerMessage("");

    try {
      // Use the existing Axios API client so the configured base URL
      // and authentication headers are preserved.
      const response = await api.post(
        `/meetings/${encodeURIComponent(meeting.id)}/speakers/assign/`,
        {
          speakers: [{ label: key, name }],
        }
      );

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      // Keep the old assigned name as an alias so existing AI summary
      // text containing that name can display the new name as well.
      setSpeakerAliases((previous) => ({
        ...previous,
        [key]: oldName,
      }));

      // Update the UI immediately without waiting for the next poll.
      setMeeting((previous) => ({
        ...previous,
        speakerNames: {
          ...(previous?.speakerNames || {}),
          [key]: name,
        },
      }));

      setSpeakerDrafts((previous) => ({
        ...previous,
        [key]: name,
      }));

      setSpeakerMessage(`Speaker renamed to ${name}.`);

      // Refresh to verify that the backend saved the new name.
      await fetchMeeting(false);
    } catch (error) {
      console.error(
        "Speaker rename error:",
        error.response?.data || error.message
      );

      setSpeakerMessage(
        error.response?.data?.error ||
          error.message ||
          "Failed to update speaker name."
      );
    } finally {
      setSavingSpeaker("");
    }
  }

  function handleExport() {
    setExportError("");

    const exportKeyPoints = meeting.keyPoints.map((point) =>
      typeof point === "string"
        ? displayText(point)
        : {
            ...point,
            text: displayText(
              point.text || point.description || point.title || ""
            ),
          }
    );

    const exportDecisions = meeting.decisions.map((decision) =>
      typeof decision === "string"
        ? displayText(decision)
        : {
            ...decision,
            text: displayText(getDeadlineText(decision)),
          }
    );

    if (
      !exportMeeting(
        format,
        {
          ...meeting,
          summary: displayText(meeting.summary),
          keyPoints: exportKeyPoints,
          decisions: exportDecisions,
          deadlines: deadlines.map((deadline) =>
            typeof deadline === "string"
              ? displayText(deadline)
              : {
                  ...deadline,
                  description: displayText(getDeadlineText(deadline)),
                  assignee: displayText(deadline.assignee || ""),
                }
          ),
        },
        transcript,
        meetingActions,
        speakers
      )
    ) {
      setExportError("Allow pop-ups for this site to save the export.");
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete "${meeting.title}"? This can't be undone.`
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/meetings/${encodeURIComponent(meeting.id)}/`
      );

      try {
        await deleteMeeting?.(
          meeting.id,
          `Deleted meeting '${meeting.title}'`
        );
      } catch (error) {
        console.warn("Local state cleanup failed:", error);
      }

      navigate("/meetings");
    } catch (error) {
      setLoadError(
        error.response?.data?.error || "Could not delete this meeting."
      );
    }
  }

  async function ask(e, q = question) {
    e?.preventDefault();

    const askedQuestion = q.trim();

    if (!askedQuestion || askLoading) return;

    setQuestion(askedQuestion);
    setAnswer(null);
    setAskError("");
    setAskLoading(true);

    try {
      const response = await api.post(
        `/meetings/${encodeURIComponent(meeting.id)}/ask/`,
        { question: askedQuestion }
      );

      const data = response.data;

      setAnswer({
        question: data.question || askedQuestion,
        answer: data.answer || "The AI did not return an answer.",
        sourceTimestamp: data.sourceTimestamp || "",
        citedSpeaker: data.citedSpeaker || "",
        confidence: data.confidence || "low",
      });
    } catch (error) {
      console.error(
        "Ask Meeting AI failed:",
        error.response?.data || error.message
      );

      setAskError(
        error.response?.data?.error ||
          "Could not get an AI answer. Please try again."
      );
    } finally {
      setAskLoading(false);
    }
  }

  function jumpTo(line) {
    setTab("Transcript");
    setSearch("");

    window.setTimeout(() => {
      document.getElementById(line.id)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
  }

  function jumpToTimestamp(timestamp) {
    if (!timestamp) return;

    const sourceLine = transcript.find(
      (line) => formatTimestamp(line.seconds) === timestamp
    );

    if (sourceLine) {
      jumpTo(sourceLine);
    } else {
      setTab("Transcript");
      setSearch("");
    }
  }

  return (
    <DashboardLayout title="Meeting">
      <Link
        to="/meetings"
        className="text-sm text-gray-600 hover:underline"
      >
        ← Back to my meetings
      </Link>

      {loadError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
          <button
            onClick={() => fetchMeeting(false)}
            className="ml-2 underline"
          >
            Refresh
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 mt-3 mb-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">
              {meeting.title}
            </h2>
            <StatusBadge status={meeting.status} />
          </div>

          <p className="text-sm text-gray-500 mt-1">
            {meeting.date ? formatDate(meeting.date) : "Date unavailable"}
            {" · "}
            {meeting.duration} sec
            {" · "}
            {meeting.speakers} speakers
            {meeting.fileName && ` · ${meeting.fileName}`}
            {meeting.sizeMb && ` (${meeting.sizeMb} MB)`}
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              aria-label="Meeting title"
            />

            <button
              onClick={saveTitle}
              disabled={savingTitle}
              className={secondaryButton}
            >
              {savingTitle ? "Saving..." : "Save title"}
            </button>
          </div>

          {titleError && (
            <p className="text-sm text-red-600 mt-1">{titleError}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className={selectClass}
            aria-label="Export format"
          >
            {exportFormats.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleExport}
            disabled={!ready}
            className={`${secondaryButton} disabled:opacity-60`}
          >
            Export
          </button>

          <button
            onClick={handleDelete}
            className={`${secondaryButton} text-red-600`}
          >
            Delete
          </button>
        </div>
      </div>

      {exportError && (
        <p className="text-sm text-red-600 mb-4">{exportError}</p>
      )}

      <Panel>
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 px-2">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`px-3 py-3 text-sm whitespace-nowrap border-b-2 -mb-px ${
                tab === item
                  ? "border-blue-700 text-gray-900 font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {item}
              {item === "Deadlines" && deadlines.length > 0 &&
                ` (${deadlines.length})`}
              {item === "Action items" && meetingActions.length > 0 &&
                ` (${meetingActions.length})`}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "Overview" && (
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <h3 className="font-medium text-gray-900">Recording</h3>

                {recordingUrl ? (
                  <div className="mt-2 rounded-lg border border-gray-200 p-3">
                    {meeting.fileType === "audio" ? (
                      <audio controls preload="metadata" className="w-full">
                        <source src={recordingUrl} />
                        Your browser does not support audio playback.
                      </audio>
                    ) : (
                      <video
                        controls
                        preload="metadata"
                        className="w-full max-h-96 rounded-lg bg-black"
                      >
                        <source src={recordingUrl} />
                        Your browser does not support video playback.
                      </video>
                    )}

                    <a
                      href={recordingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-2 text-sm text-blue-700 hover:underline"
                    >
                      Open recording in a new tab
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    No recording URL is available for this meeting.
                  </p>
                )}

                <h3 className="font-medium text-gray-900 mt-5">Summary</h3>

                <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">
                  {displayText(meeting.summary) ||
                    "The AI summary will appear after processing finishes."}
                </p>

                <h3 className="font-medium text-gray-900 mt-5">Key points</h3>

                {ready ? (
                  meeting.keyPoints.length > 0 ? (
                    <ul className="mt-1 text-sm text-gray-600 list-disc pl-5 space-y-1">
                      {meeting.keyPoints.map((point, index) => {
                        const pointText =
                          typeof point === "string"
                            ? point
                            : point.text ||
                              point.description ||
                              point.title ||
                              JSON.stringify(point);

                        return <li key={index}>{displayText(pointText)}</li>;
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">
                      No key points were identified.
                    </p>
                  )
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    Available after processing.
                  </p>
                )}

                <h3 className="font-medium text-gray-900 mt-5">Decisions</h3>

                {meeting.decisions.length > 0 ? (
                  <ul className="mt-1 text-sm text-gray-600 list-disc pl-5 space-y-1">
                    {meeting.decisions.map((decision, index) => (
                      <li key={index}>
                        {displayText(
                          typeof decision === "string"
                            ? decision
                            : getDeadlineText(decision)
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    No decisions have been extracted yet.
                  </p>
                )}

                <h3 className="font-medium text-gray-900 mt-5">
                  Upcoming deadlines
                </h3>

                {deadlines.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {deadlines.slice(0, 5).map((deadline, index) => (
                      <li
                        key={index}
                        className="rounded-lg border border-gray-200 p-3"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {displayText(getDeadlineText(deadline))}
                        </p>

                        {getDeadlineDate(deadline) && (
                          <p className="text-xs text-gray-500 mt-1">
                            Due: {getDeadlineDate(deadline)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    No deadlines found in the saved analysis.
                  </p>
                )}
              </div>

              <dl className="text-sm divide-y divide-gray-100 border border-gray-200 rounded-lg px-4 h-fit">
                <Detail
                  label="Status"
                  value={<StatusBadge status={meeting.status} />}
                />
                <Detail
                  label="Date"
                  value={meeting.date ? formatDate(meeting.date) : "—"}
                />
                <Detail label="Duration" value={`${meeting.duration} sec`} />
                <Detail label="Speakers" value={meeting.speakers} />
                <Detail label="Transcript segments" value={transcript.length} />
                <Detail label="Deadlines" value={deadlines.length} />
                <Detail label="Action items" value={meetingActions.length} />
              </dl>
            </div>
          )}

          {tab === "Transcript" && (
            transcript.length === 0 ? (
              <p className="text-sm text-gray-500">
                {ready
                  ? "No transcript segments were returned by the backend."
                  : "The transcript will appear when processing finishes."}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-wrap gap-4">
                    {speakerKeys.map((key) => (
                      <div key={key} className="min-w-0">
                        <label
                          htmlFor={`speaker-${key}`}
                          className="block text-xs font-medium text-gray-600 mb-1"
                        >
                          Rename {key}
                        </label>

                        <div className="flex items-center gap-2">
                          <input
                            id={`speaker-${key}`}
                            type="text"
                            value={speakerDrafts[key] ?? speakers[key] ?? key}
                            placeholder={key}
                            autoComplete="off"
                            onChange={(e) =>
                              renameSpeaker(key, e.target.value)
                            }
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-40 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />

                          <button
                            type="button"
                            onClick={() => saveSpeakerName(key)}
                            disabled={savingSpeaker === key}
                            className="px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingSpeaker === key ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <SearchBox
                    value={search}
                    onChange={setSearch}
                    placeholder="Search transcript"
                  />
                </div>

                {speakerMessage && (
                  <p className="mt-3 text-sm text-gray-600" role="status">
                    {speakerMessage}
                  </p>
                )}

                <ul className="mt-4">
                  {visibleLines.map((line) => (
                    <li
                      key={line.id}
                      id={line.id}
                      className="flex gap-3 py-3 border-t border-gray-100 first:border-t-0"
                    >
                      <span className="text-xs text-blue-700 w-20 shrink-0 pt-2">
                        {formatTimestamp(line.seconds)}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {speakers[line.speaker] || line.speaker}
                        </p>

                        <textarea
                          value={line.text}
                          onChange={(e) =>
                            saveTranscriptLine(line.id, e.target.value)
                          }
                          rows={2}
                          className="w-full mt-1 border border-gray-200 rounded px-2 py-1 text-sm text-gray-600 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </li>
                  ))}

                  {visibleLines.length === 0 && (
                    <li className="text-sm text-gray-500 py-4">
                      No lines match "{search}".
                    </li>
                  )}
                </ul>
              </>
            )
          )}

          {tab === "Deadlines" && (
            <div>
              <h3 className="font-medium text-gray-900">Extracted deadlines</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                Deadlines identified by the meeting analysis pipeline.
              </p>

              {deadlines.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
                  <p className="text-sm text-gray-600">
                    No deadlines are stored for this meeting yet.
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Check that AI analysis extracts deadlines and saves them in the meeting analysis collection.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deadlines.map((deadline, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-gray-200 p-4"
                    >
                      <p className="font-medium text-gray-900">
                        {displayText(getDeadlineText(deadline))}
                      </p>

                      {getDeadlineDate(deadline) && (
                        <p className="text-sm text-blue-700 mt-1">
                          <span className="font-medium">Due date:</span>{" "}
                          {getDeadlineDate(deadline)}
                        </p>
                      )}

                      {deadline?.assignee && (
                        <p className="text-sm text-gray-600 mt-1">
                          Responsible: {displayText(deadline.assignee)}
                        </p>
                      )}

                      {deadline?.source && (
                        <p className="text-xs text-gray-500 mt-2">
                          Source: {displayText(deadline.source)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "Action items" && (
            <ActionList meetingId={meeting.id} />
          )}

          {tab === "Ask" && (
            !ready ? (
              <p className="text-sm text-gray-500">
                Questions are available after transcript processing finishes.
              </p>
            ) : (
              <div className="max-w-2xl">
                <p className="text-sm text-gray-600">
                  Ask questions about this meeting. Answers are generated
                  by AI using the meeting transcript.
                </p>

                <div className="flex flex-wrap gap-2 mt-3">
                  {[
                    "What was decided?",
                    "Who owns the review?",
                    "What is the deadline?",
                    "What is still open?",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={(e) => ask(e, q)}
                      disabled={askLoading}
                      className={`${secondaryButton} disabled:opacity-50`}
                    >
                      {q}
                    </button>
                  ))}
                </div>

                <form onSubmit={ask} className="flex gap-2 mt-3">
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about this meeting..."
                    className={inputClass}
                    disabled={askLoading}
                  />

                  <button
                    type="submit"
                    disabled={askLoading || !question.trim()}
                    className={`${primaryButton} disabled:opacity-50`}
                  >
                    {askLoading ? "Thinking..." : "Ask"}
                  </button>
                </form>

                {askLoading && (
                  <p className="mt-3 text-sm text-gray-500" role="status">
                    AI is reading the meeting transcript and preparing an answer...
                  </p>
                )}

                {askError && (
                  <div
                    role="alert"
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {askError}
                  </div>
                )}

                {answer && (
                  <div className="mt-4 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-900">
                      {answer.question}
                    </p>

                    <div className="mt-3 text-sm text-gray-700 whitespace-pre-line">
                      {displayText(answer.answer)}
                    </div>

                    {(answer.sourceTimestamp || answer.citedSpeaker) && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-500">
                          SOURCE
                        </p>

                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          {answer.sourceTimestamp && (
                            <button
                              type="button"
                              onClick={() =>
                                jumpToTimestamp(answer.sourceTimestamp)
                              }
                              className="text-sm text-blue-700 hover:underline"
                            >
                              {answer.sourceTimestamp}
                            </button>
                          )}

                          {answer.citedSpeaker && (
                            <span className="text-sm text-gray-600">
                              Speaker: {displayText(answer.citedSpeaker)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {answer.confidence && (
                      <p className="mt-3 text-xs text-gray-500">
                        Confidence: {answer.confidence}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          )}

          {tab === "Processing" && (
            <div className="max-w-xl">
              <ol>
                {processingStages.map((stage, index) => {
                  const failed =
                    meeting.status === "failed" &&
                    index === Math.max(currentStage, 1);

                  const done = index < currentStage || ready;

                  const active =
                    !ready &&
                    !failed &&
                    index === currentStage &&
                    meeting.status !== "failed";

                  return (
                    <li
                      key={stage}
                      className="flex items-center justify-between py-2.5 border-t border-gray-100 first:border-t-0 text-sm"
                    >
                      <span className="flex items-center gap-3">
                        <span className="w-6 text-center text-gray-500">
                          {done ? "✓" : index + 1}
                        </span>

                        <span className="text-gray-900">
                          {stage === "Done" ? "Ready to review" : stage}
                        </span>
                      </span>

                      <StatusBadge
                        status={
                          failed
                            ? "failed"
                            : done
                              ? "completed"
                              : active
                                ? "processing"
                                : "queued"
                        }
                      />
                    </li>
                  );
                })}
              </ol>

              {meeting.status === "failed" && (
                <div className="mt-4">
                  <p className="text-sm text-red-600">
                    {meeting.error || "Processing failed."}
                  </p>

                  <button
                    onClick={async () => {
                      try {
                        await reprocessMeeting(meeting.id);

                        await api.post(
                          `/meetings/${encodeURIComponent(meeting.id)}/process/`
                        );

                        await fetchMeeting();
                      } catch (error) {
                        setLoadError(
                          "Could not restart processing. Check the process endpoint."
                        );
                      }
                    }}
                    className={`${primaryButton} mt-3`}
                  >
                    Retry processing
                  </button>
                </div>
              )}

              {!ready && meeting.status !== "failed" && (
                <p className="text-xs text-gray-500 mt-3">
                  Meeting details refresh every five seconds while processing.
                </p>
              )}

              <p className="text-xs text-gray-400 mt-3">
                Recording limit: {settings.maxMinutes} minutes · Model:{" "}
                {settings.transcriptionModel}
              </p>
            </div>
          )}
        </div>
      </Panel>
    </DashboardLayout>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-2">
      <dt className="text-gray-600">{label}</dt>
      <dd className="text-gray-900 text-right">{value}</dd>
    </div>
  );
}

export default MeetingDetail;
