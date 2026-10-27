// Sample AI output used until the transcription/analysis backend is connected.

const transcriptTemplate = [
  ["Speaker 1", "Thanks everyone for joining. Let's go through {topic} and agree on next steps."],
  ["Speaker 2", "From my side the main work is done. I need one more review before we can close it."],
  ["Speaker 3", "The deadline is Friday, so we should finish the review by Thursday."],
  ["Speaker 1", "Agreed. Who will own the final review?"],
  ["Speaker 2", "I can take the review and share the notes with the team afterwards."],
  ["Speaker 3", "One open question is the budget for the next phase. We still need approval."],
  ["Speaker 1", "Let's keep the current scope and revisit the budget next week."],
];

export const processingStages = ["Queued", "Audio extraction", "Transcribing", "Conversation analysis", "Done"];

export function buildTranscript(meeting) {
  return transcriptTemplate.map(([speaker, text], i) => ({
    id: `${meeting.id}-t${i}`,
    seconds: 5 + i * 37,
    speaker,
    text: text.replace("{topic}", meeting.title.toLowerCase()),
  }));
}

export function buildSummary(title) {
  return `The team reviewed ${title.toLowerCase()}, kept the current scope and agreed to finish the final review by Thursday. The budget for the next phase is still open.`;
}

export function buildActionTasks() {
  return [
    { task: "Finish the final review and share notes", assignee: "Speaker 2", priority: "high" },
    { task: "Get budget approval for the next phase", assignee: "Speaker 1", priority: "medium" },
  ];
}

export function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
