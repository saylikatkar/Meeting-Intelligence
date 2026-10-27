import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import * as mock from "../data/mockData";
import { addDays, buildActionTasks, buildSummary, buildTranscript, processingStages } from "../utils/meetingContent";

const DataContext = createContext(null);
const STORAGE_KEY = "meetingintel-data";
const SIMULATION_MS = 3000;

// action items come from the meetings' sample action items
function seedActions() {
  const statuses = ["in progress", "pending", "completed"];
  return mock.meetings.flatMap((m) =>
    (m.actionItems || []).map((task, i) => ({
      id: `a_${m.id}_${i}`,
      meetingId: m.id,
      ownerId: m.ownerId,
      task,
      assignee: m.owner,
      due: addDays(m.date, 7 + i),
      priority: i === 0 ? "high" : "medium",
      status: statuses[i % statuses.length],
    }))
  );
}

// Local store for all pages, saved in localStorage.
// TODO: replace with the Django APIs once they are ready.
function initialData() {
  return {
    users: mock.users,
    meetings: mock.meetings,
    actions: seedActions(),
    logs: mock.logs,
    settings: mock.defaultSettings,
    // admin display name and preferences (the login lives in .env)
    staffProfiles: {},
    samplesVersion: 3,
  };
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      const settings = { ...mock.defaultSettings, ...saved.settings };
      delete settings.managerPermissions;
      const demoIds = new Set(mock.users.filter((u) => u.password).map((u) => u.id));
      // the manager role was removed; saved managers become members
      const users = (saved.users || mock.users)
        .map((u) => (u.role === "manager" ? { ...u, role: "member" } : u))
        .map((u) => (demoIds.has(u.id) && !u.password ? { ...u, password: mock.DEMO_PASSWORD } : u));
      // drop the old "Welcome call" sample meeting from saved data
      const removed = new Set((saved.meetings || []).filter((m) => m.title === "Welcome call").map((m) => m.id));
      const meetings = (saved.meetings || mock.meetings).filter((m) => !removed.has(m.id));
      const actions = (saved.actions || seedActions()).filter((a) => !removed.has(a.meetingId));
      const data = { ...initialData(), ...saved, settings, users, meetings: withJobDetails(meetings, saved.jobs), actions };
      // processing jobs were removed; their stage/error now live on the meeting
      delete data.jobs;
      return saved.samplesVersion === 3 ? data : addMissingSamples(data);
    }
  } catch {
    // ignore broken storage and start fresh
  }
  return initialData();
}

// copy stage/error from old saved jobs onto their meetings
function withJobDetails(meetings, jobs = []) {
  return meetings.map((m) => {
    const job = jobs.find((j) => j.meetingId === m.id);
    if (!job || m.status === "completed") return m;
    const { stage, error, simulated } = job;
    return { ...m, stage, ...(error && { error }), ...(simulated && { simulated }) };
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

// sample meetings so a new member's workspace isn't empty - one per status
const sampleMeetings = [
  { title: "Project kickoff", duration: 34, speakers: 4, daysAgo: 5, status: "completed" },
  { title: "Weekly team sync", duration: 25, speakers: 5, daysAgo: 0, status: "processing", stage: "Transcribing" },
  { title: "Client requirements review", duration: 41, speakers: 3, daysAgo: 0, status: "queued", stage: "Queued" },
  { title: "Product demo review", duration: 19, speakers: 2, daysAgo: 1, status: "failed", stage: "Audio extraction", error: "The audio file could not be read" },
];

// returns the sample meetings plus their action items
function sampleDataFor(user, titles = sampleMeetings.map((m) => m.title)) {
  const meetings = [];
  sampleMeetings
    .filter((s) => titles.includes(s.title))
    .forEach(({ title, duration, speakers, daysAgo, status, stage, error }) => {
      const meeting = {
        id: newId("m"),
        title,
        owner: user.name,
        ownerId: user.id,
        date: addDays(today(), -daysAgo),
        duration,
        speakers,
        status,
      };
      if (status === "completed") {
        meeting.summary = buildSummary(title);
        meeting.transcript = buildTranscript(meeting);
      } else {
        // status examples only - they don't count towards the monthly limit
        meeting.example = true;
        meeting.stage = stage;
        if (error) meeting.error = error;
      }
      meetings.push(meeting);
    });
  const actions = meetings.filter((m) => m.status === "completed").flatMap(actionsFor);
  return { meetings, actions };
}

// give members created before the extra samples existed the ones they're missing
function addMissingSamples(data) {
  const extra = sampleMeetings.filter((s) => s.status !== "completed").map((s) => s.title);
  let { actions } = data;
  // older saves added these without the `example` flag
  let meetings = data.meetings.map((m) => (extra.includes(m.title) && !m.fileName ? { ...m, example: true } : m));
  data.users
    .filter((u) => u.role === "member" && meetings.some((m) => m.ownerId === u.id && m.title === "Project kickoff"))
    .forEach((u) => {
      const missing = extra.filter((t) => !meetings.some((m) => m.ownerId === u.id && m.title === t));
      if (missing.length === 0) return;
      const samples = sampleDataFor(u, missing);
      meetings = [...samples.meetings, ...meetings];
      actions = [...samples.actions, ...actions];
    });
  return { ...data, meetings, actions, samplesVersion: 3 };
}

function actionsFor(meeting) {
  return buildActionTasks().map((a, i) => ({
    id: newId("a"),
    meetingId: meeting.id,
    ownerId: meeting.ownerId,
    task: a.task,
    assignee: a.assignee,
    priority: a.priority,
    due: addDays(meeting.date, 3 + i * 4),
    status: "pending",
  }));
}

function isSimulating(meeting) {
  return meeting.simulated && ["queued", "processing"].includes(meeting.status);
}

// move every simulated meeting one processing stage forward
function advanceMeetings(prev) {
  let { actions, users } = prev;
  const meetings = prev.meetings.map((meeting) => {
    if (!isSimulating(meeting)) return meeting;

    const next = processingStages[processingStages.indexOf(meeting.stage) + 1] || "Done";
    if (next !== "Done") return { ...meeting, stage: next, status: "processing" };

    const done = {
      ...meeting,
      stage: "Done",
      status: "completed",
      simulated: false,
      summary: meeting.summary || buildSummary(meeting.title),
      transcript: meeting.transcript || buildTranscript(meeting),
    };
    if (!actions.some((a) => a.meetingId === done.id)) actions = [...actionsFor(done), ...actions];
    if (meeting.countOnComplete) {
      users = users.map((u) =>
        u.id === meeting.ownerId ? { ...u, meetings: u.meetings + 1, minutes: u.minutes + meeting.duration } : u
      );
      done.countOnComplete = false;
    }
    return done;
  });
  return { ...prev, meetings, actions, users };
}

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState(loadData);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage full or blocked - changes stay in memory only
    }
  }, [data]);

  // members signed in from an older session get an account record
  const provisioned = useRef(new Set());
  const needsAccount =
    user?.role === "member" && !data.users.some((u) => u.email.toLowerCase() === user.email.toLowerCase());
  useEffect(() => {
    if (!needsAccount || provisioned.current.has(user.email)) return;
    provisioned.current.add(user.email);
    createMember({ name: user.name, email: user.email });
  }, [needsAccount]); // eslint-disable-line react-hooks/exhaustive-deps

  // fake processing pipeline for uploads and retries
  const isProcessing = data.meetings.some(isSimulating);
  useEffect(() => {
    if (!isProcessing) return;
    const timer = setInterval(() => setData(advanceMeetings), SIMULATION_MS);
    return () => clearInterval(timer);
  }, [isProcessing]);

  function makeLog(source, message, level = "info", actor) {
    const by = actor || (user ? `${user.name} (${user.role})` : "system");
    return { id: newId("log"), time: new Date().toISOString(), level, source, actor: by, message };
  }

  // apply a change and record it in the activity log
  function update(source, message, change, level) {
    setData((prev) => ({
      ...prev,
      ...change(prev),
      logs: [makeLog(source, message, level), ...prev.logs].slice(0, 500),
    }));
  }

  // apply a change without logging (small edits like transcript fixes)
  function patch(change) {
    setData((prev) => ({ ...prev, ...change(prev) }));
  }

  function addLog(source, message, level, actor) {
    setData((prev) => ({ ...prev, logs: [makeLog(source, message, level, actor), ...prev.logs].slice(0, 500) }));
  }

  // `password` is only set for self-registered members (mock login check)
  function addUser({ name, email, role, password }, message = `Created ${role} account ${email}`) {
    const account = { id: newId("u"), name, email, role, meetings: 0, minutes: 0, status: "active", joined: today(), lastLogin: null };
    if (password) account.password = password;
    update("users", message, (prev) => ({ users: [account, ...prev.users] }));
  }

  // new member account with sample meetings
  function createMember({ name, email, password, phone, avatar }, message) {
    const account = { id: newId("u"), name, email, role: "member", meetings: sampleMeetings.length, minutes: 34, status: "active", joined: today(), lastLogin: today() };
    if (password) account.password = password;
    if (phone) account.phone = phone;
    if (avatar) account.avatar = avatar;
    const samples = sampleDataFor(account);
    update("users", message || `Created member account ${email}`, (prev) => ({
      users: [account, ...prev.users],
      meetings: [...samples.meetings, ...prev.meetings],
      actions: [...samples.actions, ...prev.actions],
    }));
    return account;
  }

  function addSampleMeetings(account) {
    const samples = sampleDataFor(account);
    patch((prev) => ({
      meetings: [...samples.meetings, ...prev.meetings],
      actions: [...samples.actions, ...prev.actions],
    }));
  }

  function updateUser(id, changes, message) {
    update("users", message, (prev) => ({
      users: prev.users.map((u) => (u.id === id ? { ...u, ...changes } : u)),
    }));
  }

  function deleteUser(id, message) {
    update("users", message, (prev) => ({ users: prev.users.filter((u) => u.id !== id) }), "warning");
  }

  function uploadMeeting(owner, { title, fileName, sizeMb, duration }) {
    const meeting = {
      id: newId("m"),
      title,
      owner: owner.name,
      ownerId: owner.id,
      date: today(),
      duration,
      speakers: 3,
      status: "queued",
      stage: "Queued",
      simulated: true,
      fileName,
      sizeMb,
      countOnComplete: true,
    };
    update("meetings", `${owner.email} uploaded '${title}' (${fileName}, ${sizeMb} MB)`, (prev) => ({
      meetings: [meeting, ...prev.meetings],
    }));
    return meeting;
  }

  function updateMeeting(id, changes) {
    patch((prev) => ({ meetings: prev.meetings.map((m) => (m.id === id ? { ...m, ...changes } : m)) }));
  }

  function deleteMeeting(id, message) {
    update(
      "meetings",
      message,
      (prev) => ({
        meetings: prev.meetings.filter((m) => m.id !== id),
        actions: prev.actions.filter((a) => a.meetingId !== id),
      }),
      "warning"
    );
  }

  function reprocessMeeting(id) {
    const meeting = data.meetings.find((m) => m.id === id);
    update("meetings", `Queued '${meeting.title}' for reprocessing`, (prev) => ({
      meetings: prev.meetings.map((m) =>
        m.id === id ? { ...m, status: "queued", stage: "Queued", error: null, simulated: true } : m
      ),
    }));
  }

  function addAction(action) {
    patch((prev) => ({ actions: [{ id: newId("a"), status: "pending", ...action }, ...prev.actions] }));
  }

  function updateAction(id, changes) {
    patch((prev) => ({ actions: prev.actions.map((a) => (a.id === id ? { ...a, ...changes } : a)) }));
  }

  function deleteAction(id) {
    patch((prev) => ({ actions: prev.actions.filter((a) => a.id !== id) }));
  }

  function updateStaffProfile(role, changes, message) {
    update("settings", message, (prev) => ({
      staffProfiles: { ...prev.staffProfiles, [role]: { ...prev.staffProfiles[role], ...changes } },
    }));
  }

  function updateSettings(settings) {
    update("settings", "Updated system settings", () => ({ settings }));
  }

  function clearLogs() {
    setData((prev) => ({ ...prev, logs: [makeLog("system", "Cleared the activity log", "warning")] }));
  }

  function resetData() {
    setData({ ...initialData(), logs: [makeLog("system", "Reset all demo data", "warning"), ...mock.logs] });
  }

  const value = {
    ...data,
    addLog,
    addUser,
    createMember,
    addSampleMeetings,
    updateUser,
    deleteUser,
    uploadMeeting,
    updateMeeting,
    deleteMeeting,
    reprocessMeeting,
    addAction,
    updateAction,
    deleteAction,
    updateSettings,
    updateStaffProfile,
    clearLogs,
    resetData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}

// The signed-in member's account record, meetings and action items.
export function useMember() {
  const { user } = useAuth();
  const { users, meetings, actions } = useData();
  const account = users.find((u) => u.email.toLowerCase() === user?.email?.toLowerCase());
  const myMeetings = account ? meetings.filter((m) => m.ownerId === account.id) : [];
  const myActions = account ? actions.filter((a) => a.ownerId === account.id) : [];
  return { account, meetings: myMeetings, actions: myActions };
}
