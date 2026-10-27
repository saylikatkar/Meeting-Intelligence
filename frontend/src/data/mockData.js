// Dummy data used until the Django APIs are connected.
// Shapes follow the MongoDB documents in the project doc.

export const memberStats = {
  totalMeetings: 12,
  minutesProcessed: 384,
  completed: 10,
  processing: 1,
  failed: 1,
  meetingsThisMonth: 3,
  monthlyLimit: 5,
};

export const recentMeetings = [
  { id: "m1", title: "Website Development", date: "2026-10-08", duration: 45, speakers: 3, status: "completed" },
  { id: "m2", title: "Client Meeting", date: "2026-10-07", duration: 32, speakers: 2, status: "completed" },
  { id: "m3", title: "Sprint Planning", date: "2026-10-07", duration: 51, speakers: 5, status: "processing" },
  { id: "m4", title: "Interview - Frontend Role", date: "2026-10-06", duration: 27, speakers: 2, status: "completed" },
  { id: "m5", title: "Team Sync", date: "2026-10-04", duration: 18, speakers: 4, status: "failed" },
];

// Demo member accounts sign in with this password until the API is connected.
export const DEMO_PASSWORD = "Member@123";

export const users = [
  { id: "u1", password: DEMO_PASSWORD, name: "Ayush Kumar", email: "ayush@example.com", role: "member", plan: "pro", meetings: 12, minutes: 384, status: "active", joined: "2026-10-02", lastLogin: "2026-10-08" },
  { id: "u2", password: DEMO_PASSWORD, name: "Rahul Sharma", email: "rahul@example.com", role: "member", meetings: 8, minutes: 241, status: "active", joined: "2026-10-03", lastLogin: "2026-10-08" },
  { id: "u3", name: "Sneha Reddy", email: "sneha@example.com", role: "member", meetings: 3, minutes: 96, status: "active", joined: "2026-09-21", lastLogin: "2026-10-07" },
  { id: "u4", password: DEMO_PASSWORD, name: "Kiran Rao", email: "kiran@example.com", role: "member", meetings: 1, minutes: 14, status: "disabled", joined: "2026-09-28", lastLogin: "2026-09-30" },
  { id: "u5", password: DEMO_PASSWORD, name: "Priya Nair", email: "priya@example.com", role: "member", plan: "team", meetings: 5, minutes: 162, status: "active", joined: "2026-10-05", lastLogin: "2026-10-06" },
];

export const adminStats = {
  totalUsers: 2481,
  activeUsers: 1827,
  totalMeetings: 6492,
  successful: 6214,
  failed: 278,
  processing: 14,
  audioHours: 18430,
};

export const todayUsage = {
  newUsers: 42,
  meetings: 128,
  successful: 119,
  failed: 9,
  audioHours: 86,
  aiRequests: 1420,
};

export const meetingsPerDay = [
  { day: "Fri", count: 96 },
  { day: "Sat", count: 61 },
  { day: "Sun", count: 54 },
  { day: "Mon", count: 142 },
  { day: "Tue", count: 133 },
  { day: "Wed", count: 117 },
  { day: "Thu", count: 128 },
];

export const meetings = [
  {
    id: "m1", title: "Website Development", owner: "Ayush Kumar", ownerId: "u1", date: "2026-10-08", duration: 45, speakers: 3, status: "completed",
    summary: "Team agreed on the new landing page layout and moved the launch to the last week of October.",
    actionItems: ["Ayush to finish the hero section", "Rahul to set up staging", "Review copy with marketing on Friday"],
  },
  {
    id: "m2", title: "Client Meeting", owner: "Rahul Sharma", ownerId: "u2", date: "2026-10-07", duration: 32, speakers: 2, status: "completed",
    summary: "Client approved the phase 1 scope. Budget for phase 2 to be shared next week.",
    actionItems: ["Send revised estimate", "Schedule phase 2 kickoff"],
  },
  { id: "m3", title: "Sprint Planning", owner: "Ayush Kumar", ownerId: "u1", date: "2026-10-07", duration: 51, speakers: 5, status: "processing", stage: "Transcribing" },
  {
    id: "m4", title: "Interview - Frontend Role", owner: "Sneha Reddy", ownerId: "u3", date: "2026-10-06", duration: 27, speakers: 2, status: "completed",
    summary: "Candidate has strong React experience. Weak on testing. Recommended for a second round.",
    actionItems: ["Schedule technical round", "Share feedback with HR"],
  },
  { id: "m5", title: "Team Sync", owner: "Kiran Rao", ownerId: "u4", date: "2026-10-04", duration: 18, speakers: 4, status: "failed", stage: "Audio extraction", error: "FFmpeg could not read the file" },
  { id: "m6", title: "Design Review", owner: "Priya Nair", ownerId: "u5", date: "2026-10-06", duration: 40, speakers: 3, status: "failed", stage: "Conversation analysis", error: "Groq request timed out" },
  {
    id: "m7", title: "Weekly Review", owner: "Sneha Reddy", ownerId: "u3", date: "2026-10-08", duration: 35, speakers: 6, status: "completed",
    summary: "All teams are on track except QA, which needs one more week for regression testing.",
    actionItems: ["Add one QA contractor", "Move release review to next Thursday"],
  },
  {
    id: "m8", title: "Client Call", owner: "Rahul Sharma", ownerId: "u2", date: "2026-10-08", duration: 22, speakers: 2, status: "completed",
    summary: "Client asked for weekly status emails and a demo of the reporting module.",
    actionItems: ["Set up weekly status email", "Prepare reporting demo"],
  },
  { id: "m9", title: "Marketing Brainstorm", owner: "Priya Nair", ownerId: "u5", date: "2026-10-08", duration: 29, speakers: 4, status: "queued", stage: "Queued" },
];

export const logs = [
  { id: "log_5", time: "2026-10-08T10:42:00", level: "info", source: "meetings", actor: "system", message: "Started processing 'Sprint Planning'" },
  { id: "log_4", time: "2026-10-08T10:31:00", level: "error", source: "meetings", actor: "system", message: "Processing failed for 'Team Sync': FFmpeg could not read the file" },
  { id: "log_3", time: "2026-10-08T10:12:00", level: "error", source: "meetings", actor: "system", message: "Processing failed for 'Design Review': Groq request timed out" },
  { id: "log_2", time: "2026-10-08T09:15:00", level: "warning", source: "auth", actor: "system", message: "3 failed sign-in attempts for kiran@example.com" },
  { id: "log_1", time: "2026-10-08T08:00:00", level: "info", source: "system", actor: "system", message: "Nightly cleanup removed 42 expired audio files" },
];

export const monthlyStats = [
  { month: "Jun", newUsers: 312, meetings: 980, audioHours: 2710 },
  { month: "Jul", newUsers: 401, meetings: 1205, audioHours: 3390 },
  { month: "Aug", newUsers: 455, meetings: 1310, audioHours: 3720 },
  { month: "Sep", newUsers: 598, meetings: 1544, audioHours: 4380 },
  { month: "Oct", newUsers: 715, meetings: 1453, audioHours: 4230 },
];

export const failureReasons = [
  { reason: "Audio extraction (FFmpeg)", count: 104 },
  { reason: "AI request timeout", count: 87 },
  { reason: "Unsupported file", count: 52 },
  { reason: "File over size limit", count: 35 },
];

export const defaultSettings = {
  monthlyLimit: 5,
  maxMinutes: 60,
  maxFileSizeMb: 500,
  retentionDays: 90,
  transcriptionModel: "whisper-large-v3",
  summaryModel: "llama-3.3-70b",
  maintenanceMode: false,
  emailNotifications: true,
};
