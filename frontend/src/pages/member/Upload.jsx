
import { useRef, useState } from "react";
import { Link } from "react-router-dom";

import DashboardLayout from "../../layouts/DashboardLayout";
import Panel from "../../components/Panel";
import { useMember } from "../../context/DataContext";

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
    const extension = file.name.split(".").pop().toLowerCase();

    const isVideo =
      file.type.startsWith("video/") ||
      ["mp4", "mov", "mkv", "webm"].includes(extension);

    const media = document.createElement(
      isVideo ? "video" : "audio"
    );

    const url = URL.createObjectURL(file);

    media.preload = "metadata";

    media.onloadedmetadata = () => {
      URL.revokeObjectURL(url);

      resolve(
        Number.isFinite(media.duration)
          ? media.duration / 60
          : null
      );
    };

    media.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    media.src = url;
  });
}

// --------------------------------------------------
// MEETING USAGE
// --------------------------------------------------

function getMeetingUsage(meetings) {
  const currentMonth = new Date().toISOString().slice(0, 7);

  return meetings.filter((meeting) => {
    const meetingDate =
      meeting.createdAt ||
      meeting.created_at ||
      meeting.date ||
      "";

    // Match the backend rule: only successfully uploaded
    // recordings with a positive duration count.
    const duration = Number(meeting.duration || 0);

    return (
      duration > 0 &&
      String(meetingDate).startsWith(currentMonth)
    );
  }).length;
}

// --------------------------------------------------
// UPLOAD PAGE
// --------------------------------------------------

function Upload() {
  const {
    meetings,
    limits,
    plan,
    entitlements,
    entitlementsLoaded,
    refreshEntitlements,
  } = useMember();

  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploaded, setUploaded] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Backend subscription limits.
  const monthlyLimit = limits?.monthlyMeetings ?? null;
  const maxDuration = limits?.maxDurationMinutes ?? null;
  const maxFileSize = limits?.maxUploadSizeMB ?? null;

  // Count only valid uploaded recordings.
  const usedThisMonth = getMeetingUsage(meetings);

  // Include the newly successful upload until the meeting list
  // is refreshed from the backend.
  const currentUsage =
    usedThisMonth + (uploaded ? 1 : 0);

  const remaining =
    monthlyLimit === null
      ? null
      : Math.max(0, monthlyLimit - currentUsage);

  const canUpload =
    entitlementsLoaded &&
    !!entitlements &&
    (remaining === null || remaining > 0);

  // --------------------------------------------------
  // FILE SELECTION AND VALIDATION
  // --------------------------------------------------

  async function pick(selectedFile) {
    setError("");
    setUploaded(null);

    if (!selectedFile) return;

    if (!entitlementsLoaded || !entitlements) {
      setError(
        "Your subscription limits could not be loaded. Please refresh the page and try again."
      );
      return;
    }

    const extension = selectedFile.name
      .split(".")
      .pop()
      .toLowerCase();

    // Validate file format.
    if (!allowed.includes(extension)) {
      setFile(null);
      setDuration(null);

      setError(
        "Unsupported format. Choose MP3, WAV, M4A, AAC, MP4, MOV, MKV or WebM."
      );
      return;
    }

    // Validate file size.
    const fileSizeMB =
      selectedFile.size / (1024 * 1024);

    if (
      maxFileSize !== null &&
      fileSizeMB > maxFileSize
    ) {
      setFile(null);
      setDuration(null);

      setError(
        `This file is ${fileSizeMB.toFixed(1)} MB. Your ${plan} plan allows a maximum of ${maxFileSize} MB per recording.`
      );
      return;
    }

    // Validate recording duration when browser metadata is available.
    const minutes = await readDuration(selectedFile);

    if (
      minutes !== null &&
      maxDuration !== null &&
      minutes > maxDuration
    ) {
      setFile(null);
      setDuration(null);

      setError(
        `This recording is ${Math.round(minutes)} minutes long. Your ${plan} plan allows a maximum of ${maxDuration} minutes.`
      );
      return;
    }

    // Check monthly allowance.
    if (remaining === 0) {
      setFile(null);
      setDuration(null);

      setError(
        `You've used all ${monthlyLimit} meetings allowed by your ${plan} plan this month.`
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

  // --------------------------------------------------
  // CLEAR SELECTED FILE
  // --------------------------------------------------

  function clear() {
    setFile(null);
    setDuration(null);
    setTitle("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  // --------------------------------------------------
  // UPLOAD MEETING
  // --------------------------------------------------

  async function handleUpload() {
    if (!file) {
      setError("Choose a recording first.");
      return;
    }

    if (!title.trim()) {
      setError("Give your meeting a title.");
      return;
    }

    if (!entitlementsLoaded || !entitlements) {
      setError(
        "Subscription information is unavailable. Please refresh and try again."
      );
      return;
    }

    if (remaining === 0) {
      setError(
        `You've used all ${monthlyLimit} meetings for this month.`
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

      // Backend expects duration in seconds.
      if (duration !== null) {
        formData.append(
          "duration",
          String(Math.round(duration * 60))
        );
      }

      const response = await api.post(
        "/meetings/",
        formData,
        {
          timeout: 0,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

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

      // Count this upload only after the backend confirms success.
      setUploaded({
        id: meetingId,
        title: meeting.title || title.trim(),
      });

      clear();

      // Refresh subscription information.
      await refreshEntitlements();

    } catch (err) {
      console.error(
        "Meeting upload failed:",
        err.response?.data || err.message
      );

      // Failed uploads do not increase usage.
      setUploaded(null);

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

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

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
                    disabled={isUploading || !canUpload}
                    accept=".mp3,.wav,.m4a,.aac,.mp4,.mov,.mkv,.webm,audio/*,video/*"
                    onChange={(event) =>
                      pick(event.target.files?.[0])
                    }
                    className="hidden"
                  />
                </label>

                <p className="text-xs text-gray-400 mt-3">
                  Audio or video
                  {" · "}
                  {maxFileSize === null
                    ? "No file size limit"
                    : `up to ${maxFileSize} MB`}
                  {" · "}
                  {maxDuration === null
                    ? "No duration limit"
                    : `up to ${maxDuration} minutes`}
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
                    onChange={(event) =>
                      setTitle(event.target.value)
                    }
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
                  disabled={
                    !file ||
                    isUploading ||
                    !canUpload
                  }
                  className={`${primaryButton} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isUploading
                    ? "Uploading"
                    : !entitlementsLoaded
                      ? "Loading limits..."
                      : remaining === 0
                        ? "Monthly limit reached"
                        : "Upload and process"}
                </button>

                <span className="text-xs text-gray-500">
                  {remaining === null
                    ? "Unlimited uploads"
                    : `${remaining} of ${monthlyLimit} uploads left this month`}
                </span>
              </div>

              {isUploading && (
                <p className="text-xs text-gray-500 mt-3">
                  Please keep this page open while your recording
                  is being uploaded and saved.
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
        </Panel>
      </div>
    </DashboardLayout>
  );
}

export default Upload;
