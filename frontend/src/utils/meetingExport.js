import { formatTimestamp } from "./meetingContent";

export const exportFormats = [
  { value: "pdf", label: "PDF report" },
  { value: "txt", label: "Text (.txt)" },
  { value: "doc", label: "Word (.doc)" },
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV transcript" },
  { value: "srt", label: "SRT subtitles" },
  { value: "vtt", label: "VTT subtitles" },
];

function speakerName(line, speakers) {
  return speakers?.[line.speaker] || line.speaker;
}

function subtitleTime(seconds, separator) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  return `${h}:${formatTimestamp(seconds % 3600)}${separator}000`;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildText(meeting, transcript, actions, speakers) {
  return [
    meeting.title,
    `Date: ${meeting.date} · Duration: ${meeting.duration} min · Speakers: ${meeting.speakers}`,
    "",
    "SUMMARY",
    meeting.summary || "No summary available.",
    "",
    "ACTION ITEMS",
    ...(actions.length ? actions.map((a) => `- ${a.task} (${a.assignee}, due ${a.due}, ${a.status})`) : ["None"]),
    "",
    "TRANSCRIPT",
    ...transcript.map((t) => `[${formatTimestamp(t.seconds)}] ${speakerName(t, speakers)}: ${t.text}`),
  ].join("\n");
}

function build(format, meeting, transcript, actions, speakers) {
  if (format === "json") {
    return JSON.stringify(
      {
        ...meeting,
        actionItems: actions,
        transcript: transcript.map((t) => ({ time: formatTimestamp(t.seconds), speaker: speakerName(t, speakers), text: t.text })),
      },
      null,
      2
    );
  }
  if (format === "csv") {
    const rows = transcript.map((t) => [formatTimestamp(t.seconds), speakerName(t, speakers), t.text].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    return ["time,speaker,text", ...rows].join("\n");
  }
  if (format === "srt" || format === "vtt") {
    const sep = format === "srt" ? "," : ".";
    const cues = transcript.map((t, i) => {
      const end = transcript[i + 1]?.seconds ?? t.seconds + 5;
      const head = format === "srt" ? `${i + 1}\n` : "";
      return `${head}${subtitleTime(t.seconds, sep)} --> ${subtitleTime(end, sep)}\n${speakerName(t, speakers)}: ${t.text}`;
    });
    return (format === "vtt" ? "WEBVTT\n\n" : "") + cues.join("\n\n");
  }
  return buildText(meeting, transcript, actions, speakers);
}

// Downloads the meeting in the chosen format. PDF opens the print dialog.
export function exportMeeting(format, meeting, transcript, actions, speakers) {
  const content = build(format, meeting, transcript, actions, speakers);
  const fileBase = meeting.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  if (format === "pdf") {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return false;
    win.document.write(
      `<html><head><title>${escapeHtml(meeting.title)}</title></head><body style="font:14px Arial;padding:32px">` +
        `<pre style="white-space:pre-wrap;font:14px Arial;line-height:1.6">${escapeHtml(content)}</pre>` +
        `<script>window.onload=()=>window.print()<\/script></body></html>`
    );
    win.document.close();
    return true;
  }

  const body = format === "doc" ? `<html><body><pre>${escapeHtml(content)}</pre></body></html>` : content;
  const type = { doc: "application/msword", json: "application/json", csv: "text/csv" }[format] || "text/plain";
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileBase}.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
