import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import Panel from "../../components/Panel";
import { useData, useMember } from "../../context/DataContext";
import { inputClass, primaryButton, secondaryButton } from "../../components/ui";

const allowed = ["mp3", "wav", "m4a", "aac", "mp4", "mov", "mkv", "webm"];

const steps = [
  ["Upload recording", "We check the file type, size and length."],
  ["Audio extraction", "The audio track is pulled out of video files."],
  ["Transcription", "Speech is turned into a timestamped transcript."],
  ["Conversation analysis", "Summary, key points and action items are created."],
  ["Ready to review", "Read, search, ask questions and export."],
];

// reads the real length of an audio/video file in the browser
function readDuration(file) {
  return new Promise((resolve) => {
    const media = document.createElement(file.type.startsWith("video") ? "video" : "audio");
    const url = URL.createObjectURL(file);
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(media.duration) ? media.duration / 60 : null);
    };
    media.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    media.src = url;
  });
}

function Upload() {
  const { settings, uploadMeeting } = useData();
  const { account, meetings } = useMember();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploaded, setUploaded] = useState(null);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const usedThisMonth = meetings.filter((m) => !m.example && m.date.startsWith(thisMonth)).length;
  const remaining = Math.max(0, settings.monthlyLimit - usedThisMonth);

  async function pick(f) {
    setError("");
    setUploaded(null);
    if (!f) return;

    const ext = f.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setError("Unsupported format. Choose MP3, WAV, M4A, AAC, MP4, MOV, MKV or WebM.");
      return;
    }
    if (f.size > settings.maxFileSizeMb * 1024 * 1024) {
      setError(`This file is larger than ${settings.maxFileSizeMb} MB. Choose a smaller recording.`);
      return;
    }

    const minutes = await readDuration(f);
    if (minutes && minutes > settings.maxMinutes) {
      setError(`This recording is ${Math.round(minutes)} minutes long. The limit is ${settings.maxMinutes} minutes.`);
      return;
    }

    setFile(f);
    setDuration(minutes);
    setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
  }

  function clear() {
    setFile(null);
    setDuration(null);
    setTitle("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleUpload() {
    if (!file) return setError("Choose a recording first.");
    if (!title.trim()) return setError("Give your meeting a title.");
    if (remaining === 0) return setError(`You've used all ${settings.monthlyLimit} meetings for this month.`);

    // TODO: replace with POST /api/meetings/upload/ (multipart)
    const meeting = uploadMeeting(account, {
      title: title.trim(),
      fileName: file.name,
      sizeMb: (file.size / 1024 / 1024).toFixed(1),
      duration: Math.max(1, Math.round(duration || 1)),
    });
    setUploaded(meeting);
    clear();
  }

  return (
    <DashboardLayout title="Upload">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Panel title="Upload a meeting">
            <div className="p-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pick(e.dataTransfer.files?.[0]);
                }}
                className={`border-2 border-dashed rounded-lg px-4 py-10 text-center ${
                  dragging ? "border-blue-700 bg-blue-50" : "border-gray-300"
                }`}
              >
                <p className="font-medium text-gray-900">Drop your recording here</p>
                <p className="text-sm text-gray-500 mt-1">or browse files from your computer</p>
                <label className={`${secondaryButton} inline-block mt-4 cursor-pointer`}>
                  Browse files
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".mp3,.wav,.m4a,.aac,.mp4,.mov,.mkv,.webm,audio/*,video/*"
                    onChange={(e) => pick(e.target.files?.[0])}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-400 mt-3">
                  Audio or video · up to {settings.maxFileSizeMb} MB · up to {settings.maxMinutes} minutes
                </p>
              </div>

              {file && (
                <div className="mt-4 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                        {duration ? ` · ${Math.max(1, Math.round(duration))} min` : " · length unknown"}
                      </p>
                    </div>
                    <button onClick={clear} className="text-sm text-gray-500 hover:text-gray-800">
                      Remove
                    </button>
                  </div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mt-4 mb-1">
                    Meeting title
                  </label>
                  <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
                </div>
              )}

              {error && (
                <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
              )}

              {uploaded && (
                <div className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                  "{uploaded.title}" was uploaded and is being processed.{" "}
                  <Link to={`/meetings/${uploaded.id}`} className="underline">
                    Follow its progress
                  </Link>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                <button onClick={handleUpload} disabled={!file} className={primaryButton}>
                  Upload and process
                </button>
                <span className="text-xs text-gray-500">
                  {remaining} of {settings.monthlyLimit} uploads left this month
                </span>
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="What happens next?" className="h-fit">
          <ol>
            {steps.map(([name, text], i) => (
              <li key={name} className="flex gap-3 px-4 py-3 border-t border-gray-100 first:border-t-0">
                <span className="text-sm text-blue-700 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block text-sm text-gray-900">{name}</span>
                  <span className="text-xs text-gray-500">{text}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
            Processing is simulated in this preview. Real transcription starts when the backend is connected.
          </p>
        </Panel>
      </div>
    </DashboardLayout>
  );
}

export default Upload;
