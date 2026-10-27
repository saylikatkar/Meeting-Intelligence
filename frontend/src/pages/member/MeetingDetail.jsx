import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import StatusBadge from "../../components/StatusBadge";
import Panel from "../../components/Panel";
import ActionList from "../../components/ActionList";
import { useData, useMember } from "../../context/DataContext";
import { formatDate } from "../../utils/format";
import { buildTranscript, formatTimestamp, processingStages } from "../../utils/meetingContent";
import { exportFormats, exportMeeting } from "../../utils/meetingExport";
import { inputClass, primaryButton, secondaryButton, selectClass } from "../../components/ui";
import SearchBox from "../../components/SearchBox";

const tabs = ["Overview", "Transcript", "Action items", "Ask", "Processing"];

const stopWords = new Set(
  "what who when where which does did the was were about this that with have will meeting there from they their and for are how why our you can".split(" ")
);
const synonyms = {
  deadline: ["deadline", "friday", "thursday", "due"],
  when: ["friday", "thursday", "week"],
  owner: ["own", "take"],
  who: ["own", "take"],
  decision: ["agreed", "keep", "decide"],
  decided: ["agreed", "keep"],
  budget: ["budget", "approval"],
  open: ["open", "question", "approval"],
};

// finds the transcript lines that best match the question
function findAnswer(question, transcript, speakers) {
  const words = (question.toLowerCase().match(/[a-z]+/g) || []).filter((w) => w.length > 2 && !stopWords.has(w));
  const terms = [...new Set(words.flatMap((w) => [w, ...(synonyms[w] || [])]))];
  return transcript
    .map((line) => {
      const text = `${speakers[line.speaker] || line.speaker} ${line.text}`.toLowerCase();
      return { line, score: terms.filter((t) => text.includes(t)).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.line);
}

function MeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings, updateMeeting, deleteMeeting, reprocessMeeting } = useData();
  const { meetings, actions, account } = useMember();
  const meeting = meetings.find((m) => m.id === id);

  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(tabs.includes(searchParams.get("tab")) ? searchParams.get("tab") : "Overview");
  const [search, setSearch] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [format, setFormat] = useState(account?.prefs?.defaultExport || "pdf");
  const [exportError, setExportError] = useState("");

  if (!meeting) {
    return (
      <DashboardLayout title="Meeting">
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
          This meeting doesn't exist or isn't yours.{" "}
          <Link to="/meetings" className="text-blue-700 hover:underline">
            Back to my meetings
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const ready = meeting.status === "completed";
  const transcript = meeting.transcript || (ready ? buildTranscript(meeting) : []);
  const speakers = meeting.speakerNames || {};
  const meetingActions = actions.filter((a) => a.meetingId === meeting.id);
  const term = search.toLowerCase();
  const visibleLines = transcript.filter((t) => `${speakers[t.speaker] || t.speaker} ${t.text}`.toLowerCase().includes(term));
  const speakerKeys = [...new Set(transcript.map((t) => t.speaker))];

  function editLine(lineId, text) {
    updateMeeting(meeting.id, { transcript: transcript.map((t) => (t.id === lineId ? { ...t, text } : t)) });
  }

  function renameSpeaker(key, name) {
    updateMeeting(meeting.id, { speakerNames: { ...speakers, [key]: name } });
  }

  function handleExport() {
    setExportError("");
    if (!exportMeeting(format, meeting, transcript, meetingActions, speakers)) {
      setExportError("Allow pop-ups for this site to save the PDF.");
    }
  }

  function handleDelete() {
    if (window.confirm(`Delete "${meeting.title}"? This can't be undone.`)) {
      deleteMeeting(meeting.id, `Deleted meeting '${meeting.title}' (${meeting.owner})`);
      navigate("/meetings");
    }
  }

  function ask(e, q = question) {
    e?.preventDefault();
    if (!q.trim()) return;
    setQuestion(q);
    setAnswer({ question: q, lines: findAnswer(q, transcript, speakers) });
  }

  function jumpTo(line) {
    setTab("Transcript");
    setSearch("");
    setTimeout(() => document.getElementById(line.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  // which processing stage each step is in
  const currentStage = ready ? processingStages.length : Math.max(0, processingStages.indexOf(meeting.stage));

  return (
    <DashboardLayout title="Meeting">
      <Link to="/meetings" className="text-sm text-gray-600 hover:underline">
        ← Back to my meetings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mt-3 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">{meeting.title}</h2>
            <StatusBadge status={meeting.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {formatDate(meeting.date)} · {meeting.duration} min · {meeting.speakers} speakers
            {meeting.fileName && ` · ${meeting.fileName} (${meeting.sizeMb} MB)`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={format} onChange={(e) => setFormat(e.target.value)} className={selectClass} aria-label="Export format">
            {exportFormats.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <button onClick={handleExport} disabled={!ready} className={`${secondaryButton} disabled:opacity-60`}>
            Export
          </button>
          <button onClick={handleDelete} className={`${secondaryButton} text-red-600`}>
            Delete
          </button>
        </div>
      </div>
      {exportError && <p className="text-sm text-red-600 -mt-4 mb-4">{exportError}</p>}

      <Panel>
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 px-2">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-3 text-sm whitespace-nowrap border-b-2 -mb-px ${
                tab === t ? "border-blue-700 text-gray-900 font-medium" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t}
              {t === "Action items" && meetingActions.length > 0 && ` (${meetingActions.length})`}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "Overview" && (
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <h3 className="font-medium text-gray-900">Summary</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {meeting.summary || "The summary will appear here once processing is finished."}
                </p>

                <h3 className="font-medium text-gray-900 mt-5">Key points</h3>
                {ready ? (
                  <ul className="mt-1 text-sm text-gray-600 list-disc pl-5 space-y-1">
                    <li>Current scope stays the same.</li>
                    <li>Final review to be finished before the deadline.</li>
                    <li>Budget for the next phase still needs approval.</li>
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">Available after processing.</p>
                )}

                <h3 className="font-medium text-gray-900 mt-5">Open action items</h3>
                {meetingActions.filter((a) => a.status !== "completed").length === 0 ? (
                  <p className="text-sm text-gray-500 mt-1">None.</p>
                ) : (
                  <ul className="mt-1 text-sm text-gray-600 list-disc pl-5 space-y-1">
                    {meetingActions
                      .filter((a) => a.status !== "completed")
                      .map((a) => (
                        <li key={a.id}>
                          {a.task} <span className="text-gray-400">· {a.assignee} · due {formatDate(a.due)}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              <dl className="text-sm divide-y divide-gray-100 border border-gray-200 rounded-lg px-4 h-fit">
                <Detail label="Status" value={<StatusBadge status={meeting.status} />} />
                <Detail label="Date" value={formatDate(meeting.date)} />
                <Detail label="Duration" value={`${meeting.duration} min`} />
                <Detail label="Speakers" value={meeting.speakers} />
                <Detail label="Transcript lines" value={transcript.length} />
                <Detail label="Action items" value={meetingActions.length} />
              </dl>
            </div>
          )}

          {tab === "Transcript" &&
            (transcript.length === 0 ? (
              <p className="text-sm text-gray-500">The transcript will appear here once processing is finished.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-wrap gap-3">
                    {speakerKeys.map((key) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-500 mb-1">Rename {key}</label>
                        <input
                          value={speakers[key] || ""}
                          placeholder={key}
                          onChange={(e) => renameSpeaker(key, e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-36 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    ))}
                  </div>
                  <SearchBox value={search} onChange={setSearch} placeholder="Search transcript" />
                </div>

                <ul className="mt-4">
                  {visibleLines.map((t) => (
                    <li key={t.id} id={t.id} className="flex gap-3 py-3 border-t border-gray-100 first:border-t-0">
                      <span className="text-xs text-blue-700 w-12 shrink-0 pt-2">{formatTimestamp(t.seconds)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{speakers[t.speaker] || t.speaker}</p>
                        <textarea
                          value={t.text}
                          onChange={(e) => editLine(t.id, e.target.value)}
                          rows={2}
                          className="w-full mt-1 border border-transparent hover:border-gray-300 rounded px-2 py-1 text-sm text-gray-600 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </li>
                  ))}
                  {visibleLines.length === 0 && <li className="text-sm text-gray-500 py-4">No lines match "{search}".</li>}
                </ul>
                <p className="text-xs text-gray-500 mt-2">Click any line to correct it. Changes save automatically.</p>
              </>
            ))}

          {tab === "Action items" && <ActionList meetingId={meeting.id} />}

          {tab === "Ask" &&
            (!ready ? (
              <p className="text-sm text-gray-500">You can ask questions once the transcript is ready.</p>
            ) : (
              <div className="max-w-2xl">
                <p className="text-sm text-gray-600">Ask a question and we'll find the answer in this meeting's transcript.</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {["What was decided?", "Who owns the review?", "What is the deadline?", "What is still open?"].map((q) => (
                    <button key={q} onClick={(e) => ask(e, q)} className={secondaryButton}>
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
                  />
                  <button type="submit" className={primaryButton}>
                    Ask
                  </button>
                </form>

                {answer && (
                  <div className="mt-4 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-900">{answer.question}</p>
                    {answer.lines.length === 0 ? (
                      <p className="text-sm text-gray-500 mt-2">Nothing in the transcript matches that question. Try other words.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {answer.lines.map((line) => (
                          <li key={line.id} className="text-sm text-gray-600">
                            <button onClick={() => jumpTo(line)} className="text-xs text-blue-700 hover:underline mr-2">
                              {formatTimestamp(line.seconds)}
                            </button>
                            <span className="text-gray-900">{speakers[line.speaker] || line.speaker}:</span> {line.text}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-gray-400 mt-3">Answers are matched from the transcript. AI answers come with the backend.</p>
                  </div>
                )}
              </div>
            ))}

          {tab === "Processing" && (
            <div className="max-w-xl">
              <ol>
                {processingStages.map((stage, i) => {
                  const failed = meeting.status === "failed" && i === Math.max(currentStage, 1);
                  const done = i < currentStage || ready;
                  const active = !ready && !failed && i === currentStage && meeting.status !== "failed";
                  return (
                    <li key={stage} className="flex items-center justify-between py-2.5 border-t border-gray-100 first:border-t-0 text-sm">
                      <span className="flex items-center gap-3">
                        <span className="w-6 text-center text-gray-500">{done ? "✓" : i + 1}</span>
                        <span className="text-gray-900">{stage === "Done" ? "Ready to review" : stage}</span>
                      </span>
                      <StatusBadge status={failed ? "failed" : done ? "completed" : active ? "processing" : "queued"} />
                    </li>
                  );
                })}
              </ol>
              {meeting.status === "failed" && (
                <div className="mt-4">
                  <p className="text-sm text-red-600">{meeting.error || "Processing failed."}</p>
                  <button onClick={() => reprocessMeeting(meeting.id)} className={`${primaryButton} mt-3`}>
                    Retry processing
                  </button>
                </div>
              )}
              {!ready && meeting.status !== "failed" && (
                <p className="text-xs text-gray-500 mt-3">This page updates by itself while your meeting is processed.</p>
              )}
              <p className="text-xs text-gray-400 mt-3">
                Recordings up to {settings.maxMinutes} minutes · processed with {settings.transcriptionModel}
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
    <div className="flex justify-between py-2">
      <dt className="text-gray-600">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  );
}

export default MeetingDetail;
