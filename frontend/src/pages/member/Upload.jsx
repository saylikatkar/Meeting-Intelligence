
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import Panel from "../../components/Panel";
import { useData, useMember } from "../../context/DataContext";
import {
  inputClass,
  primaryButton,
  secondaryButton,
} from "../../components/ui";
import api from "../../services/api";

const allowed = [
  "mp3",
  "wav",
  "m4a",
  "aac",
  "mp4",
  "mov",
  "mkv",
  "webm",
];

const steps = [
  ["Upload recording", "We check the file type, size and length."],
  ["Audio extraction", "The audio track is pulled out of video files."],
  ["Transcription", "Speech is turned into a timestamped transcript."],
  ["Conversation analysis", "Summary, key points and action items are created."],
  ["Ready to review", "Read, search, ask questions and export."],
];

function readDuration(file) {
  return new Promise((resolve) => {
    const isVideo =
      file.type.startsWith("video/") ||
      ["mp4", "mov", "mkv", "webm"].includes(
        file.name.split(".").pop().toLowerCase()
      );

    const media = document.createElement(isVideo ? "video" : "audio");
    const url = URL.createObjectURL(file);

    media.preload = "metadata";

    media.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(
        Number.isFinite(media.duration) ? media.duration / 60 : null
      );
    };

    media.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    media.src = url;
  });
}

function Upload() {
  const { settings } = useData();
  const { meetings } = useMember();

  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploaded, setUploaded] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const thisMonth = new Date().toISOString().slice(0, 7);

  const usedThisMonth = meetings.filter((meeting) => {
    if (meeting.example) return false;

    const meetingDate =
      meeting.date ||
      meeting.createdAt ||
      meeting.created_at ||
      "";

    return String(meetingDate).startsWith(thisMonth);
  }).length;

  const remaining = Math.max(
    0,
    settings.monthlyLimit - usedThisMonth
  );

  async function pick(selectedFile) {
    setError("");
    setUploaded(null);

    if (!selectedFile) return;

    const ext = selectedFile.name.split(".").pop().toLowerCase();

    if (!allowed.includes(ext)) {
      setError(
        "Unsupported format. Choose MP3, WAV, M4A, AAC, MP4, MOV, MKV or WebM."
      );
      return;
    }

    if (
      selectedFile.size >
      settings.maxFileSizeMb * 1024 * 1024
    ) {
      setError(
        `This file is larger than ${settings.maxFileSizeMb} MB. Choose a smaller recording.`
      );
      return;
    }

    const minutes = await readDuration(selectedFile);

    if (minutes !== null && minutes > settings.maxMinutes) {
      setError(
        `This recording is ${Math.round(minutes)} minutes long. The limit is ${settings.maxMinutes} minutes.`
      );
      return;
    }

    setFile(selectedFile);
    setDuration(minutes);

    setTitle(
      selectedFile.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
    );
  }

  function clear() {
    setFile(null);
    setDuration(null);
    setTitle("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleUpload() {
    if (!file) {
      setError("Choose a recording first.");
      return;
    }

    if (!title.trim()) {
      setError("Give your meeting a title.");
      return;
    }

    if (remaining === 0) {
      setError(
        `You've used all ${settings.monthlyLimit} meetings for this month.`
      );
      return;
    }

    setError("");
    setUploaded(null);
    setIsUploading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("title", title.trim());

      // The backend stores duration in seconds.
      if (duration !== null) {
        formData.append(
          "duration",
          String(Math.round(duration * 60))
        );
      }

      const response = await api.post("/meetings/", formData, {
        timeout: 0,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const meeting = response.data?.meeting || {};

      const meetingId = String(
        meeting.id ||
          meeting._id ||
          response.data?.jobId ||
          ""
      );

      if (!meetingId) {
        throw new Error(
          "The server did not return a meeting ID. Check the backend response."
        );
      }

      setUploaded({
        id: meetingId,
        title: meeting.title || title.trim(),
      });

      clear();
    } catch (err) {
      console.error("Meeting upload failed:", err);

      setError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          err.message ||
          "Upload failed. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <DashboardLayout title="Upload">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Panel title="Upload a meeting">
            <div className="p-4">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);

                  if (!isUploading) {
                    pick(event.dataTransfer.files?.[0]);
                  }
                }}
                className={`border-2 border-dashed rounded-lg px-4 py-10 text-center transition-colors ${
                  dragging
                    ? "border-blue-700 bg-blue-50"
                    : "border-gray-300"
                }`}
              >
                <p className="font-medium text-gray-900">
                  Drop your recording here
                </p>

                <p className="text-sm text-gray-500 mt-1">
                  or browse files from your computer
                </p>

                <label
                  className={`${secondaryButton} inline-block mt-4 cursor-pointer`}
                >
                  Browse files

                  <input
                    ref={inputRef}
                    type="file"
                    disabled={isUploading}
                    accept=".mp3,.wav,.m4a,.aac,.mp4,.mov,.mkv,.webm,audio/*,video/*"
                    onChange={(event) =>
                      pick(event.target.files?.[0])
                    }
                    className="hidden"
                  />
                </label>

                <p className="text-xs text-gray-400 mt-3">
                  Audio or video · up to {settings.maxFileSizeMb} MB
                  · up to {settings.maxMinutes} minutes
                </p>
              </div>

              {file && (
                <div className="mt-4 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                        {duration !== null
                          ? ` · ${Math.max(1, Math.round(duration))} min`
                          : " · length unknown"}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={clear}
                      className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>

                  <label
                    htmlFor="meeting-title"
                    className="block text-sm font-medium text-gray-700 mt-4 mb-1"
                  >
                    Meeting title
                  </label>

                  <input
                    id="meeting-title"
                    value={title}
                    disabled={isUploading}
                    onChange={(event) => setTitle(event.target.value)}
                    className={inputClass}
                    placeholder="Enter meeting title"
                  />
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2"
                >
                  {error}
                </div>
              )}

              {uploaded && (
                <div className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                  "{uploaded.title}" was uploaded successfully and
                  processing has been requested.{" "}

                  <Link
                    to={`/meetings/${encodeURIComponent(uploaded.id)}`}
                    className="underline"
                  >
                    Follow its progress
                  </Link>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!file || isUploading || remaining === 0}
                  className={`${primaryButton} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isUploading
                    ? "Uploading to Cloudinary..."
                    : "Upload and process"}
                </button>

                <span className="text-xs text-gray-500">
                  {remaining} of {settings.monthlyLimit} uploads left
                  this month
                </span>
              </div>

              {isUploading && (
                <p className="text-xs text-gray-500 mt-3">
                  Please keep this page open while your recording is
                  being uploaded and saved.
                </p>
              )}
            </div>
          </Panel>
        </div>

        <Panel title="What happens next?" className="h-fit">
          <ol>
            {steps.map(([name, description], index) => (
              <li
                key={name}
                className="flex gap-3 px-4 py-3 border-t border-gray-100 first:border-t-0"
              >
                <span className="text-sm text-blue-700 w-6 shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span>
                  <span className="block text-sm text-gray-900">
                    {name}
                  </span>

                  <span className="text-xs text-gray-500">
                    {description}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <p className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
            Recordings are stored in Cloudinary. Your backend saves
            meeting details in MongoDB and starts the processing
            pipeline.
          </p>
        </Panel>
      </div>
    </DashboardLayout>
  );
}

export default Upload;
