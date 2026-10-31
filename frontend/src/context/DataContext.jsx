import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import * as mock from "../data/mockData";
import {
  addDays,
  buildActionTasks,
  buildSummary,
  buildTranscript,
  processingStages,
} from "../utils/meetingContent";
import api from "../services/api";

const DataContext = createContext(null);
const STORAGE_KEY = "meetingintel-data";
const SIMULATION_MS = 3000;

function seedActions() {
  const statuses = ["in progress", "pending", "completed"];

  return mock.meetings.flatMap((meeting) =>
    (meeting.actionItems || []).map((task, i) => ({
      id: `a_${meeting.id}_${i}`,
      meetingId: meeting.id,
      ownerId: meeting.ownerId,
      task,
      assignee: meeting.owner,
      due: addDays(meeting.date, 7 + i),
      priority: i === 0 ? "high" : "medium",
      status: statuses[i % statuses.length],
    }))
  );
}

function initialData() {
  return {
    users: mock.users,
    meetings: mock.meetings,
    actions: seedActions(),
    logs: mock.logs,
    settings: mock.defaultSettings,
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

      const demoIds = new Set(
        mock.users.filter((u) => u.password).map((u) => u.id)
      );

      const users = (saved.users || mock.users)
        .map((u) =>
          u.role === "manager" ? { ...u, role: "member" } : u
        )
        .map((u) =>
          demoIds.has(u.id) && !u.password
            ? { ...u, password: mock.DEMO_PASSWORD }
            : u
        );

      const removed = new Set(
        (saved.meetings || [])
          .filter((m) => m.title === "Welcome call")
          .map((m) => m.id)
      );

      const meetings = (saved.meetings || mock.meetings).filter(
        (m) => !removed.has(m.id)
      );

      const actions = (saved.actions || seedActions()).filter(
        (a) => !removed.has(a.meetingId)
      );

      const data = {
        ...initialData(),
        ...saved,
        settings,
        users,
        meetings: withJobDetails(meetings, saved.jobs),
        actions,
      };

      delete data.jobs;

      return saved.samplesVersion === 3
        ? data
        : addMissingSamples(data);
    }
  } catch {
    // Start with fresh demo data if local storage is invalid.
  }

  return initialData();
}

function withJobDetails(meetings, jobs = []) {
  return meetings.map((meeting) => {
    const job = jobs.find((j) => j.meetingId === meeting.id);

    if (!job || meeting.status === "completed") {
      return meeting;
    }

    const { stage, error, simulated } = job;

    return {
      ...meeting,
      stage,
      ...(error && { error }),
      ...(simulated && { simulated }),
    };
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

const sampleMeetings = [
  {
    title: "Project kickoff",
    duration: 34,
    speakers: 4,
    daysAgo: 5,
    status: "completed",
  },
  {
    title: "Weekly team sync",
    duration: 25,
    speakers: 5,
    daysAgo: 0,
    status: "processing",
    stage: "Transcribing",
  },
  {
    title: "Client requirements review",
    duration: 41,
    speakers: 3,
    daysAgo: 0,
    status: "queued",
    stage: "Queued",
  },
  {
    title: "Product demo review",
    duration: 19,
    speakers: 2,
    daysAgo: 1,
    status: "failed",
    stage: "Audio extraction",
    error: "The audio file could not be read",
  },
];

function sampleDataFor(
  user,
  titles = sampleMeetings.map((m) => m.title)
) {
  const meetings = [];

  sampleMeetings
    .filter((sample) => titles.includes(sample.title))
    .forEach(
      ({
        title,
        duration,
        speakers,
        daysAgo,
        status,
        stage,
        error,
      }) => {
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
          meeting.example = true;
          meeting.stage = stage;
          if (error) meeting.error = error;
        }

        meetings.push(meeting);
      }
    );

  const actions = meetings
    .filter((meeting) => meeting.status === "completed")
    .flatMap(actionsFor);

  return { meetings, actions };
}

function addMissingSamples(data) {
  const extra = sampleMeetings
    .filter((sample) => sample.status !== "completed")
    .map((sample) => sample.title);

  let { actions } = data;

  let meetings = data.meetings.map((meeting) =>
    extra.includes(meeting.title) && !meeting.fileName
      ? { ...meeting, example: true }
      : meeting
  );

  data.users
    .filter(
      (user) =>
        user.role === "member" &&
        meetings.some(
          (meeting) =>
            meeting.ownerId === user.id &&
            meeting.title === "Project kickoff"
        )
    )
    .forEach((user) => {
      const missing = extra.filter(
        (title) =>
          !meetings.some(
            (meeting) =>
              meeting.ownerId === user.id &&
              meeting.title === title
          )
      );

      if (missing.length === 0) return;

      const samples = sampleDataFor(user, missing);

      meetings = [...samples.meetings, ...meetings];
      actions = [...samples.actions, ...actions];
    });

  return { ...data, meetings, actions, samplesVersion: 3 };
}

function actionsFor(meeting) {
  return buildActionTasks().map((action, i) => ({
    id: newId("a"),
    meetingId: meeting.id,
    ownerId: meeting.ownerId,
    task: action.task,
    assignee: action.assignee,
    priority: action.priority,
    due: addDays(meeting.date, 3 + i * 4),
    status: "pending",
  }));
}

function isSimulating(meeting) {
  return (
    meeting.simulated &&
    ["queued", "processing"].includes(meeting.status)
  );
}

function advanceMeetings(prev) {
  let { actions, users } = prev;

  const meetings = prev.meetings.map((meeting) => {
    if (!isSimulating(meeting)) return meeting;

    const currentStage = processingStages.indexOf(meeting.stage);
    const next =
      processingStages[currentStage + 1] || "Done";

    if (next !== "Done") {
      return { ...meeting, stage: next, status: "processing" };
    }

    const done = {
      ...meeting,
      stage: "Done",
      status: "completed",
      simulated: false,
      summary: meeting.summary || buildSummary(meeting.title),
      transcript:
        meeting.transcript || buildTranscript(meeting),
    };

    if (!actions.some((action) => action.meetingId === done.id)) {
      actions = [...actionsFor(done), ...actions];
    }

    if (meeting.countOnComplete) {
      users = users.map((user) =>
        user.id === meeting.ownerId
          ? {
              ...user,
              meetings: user.meetings + 1,
              minutes: user.minutes + meeting.duration,
            }
          : user
      );

      done.countOnComplete = false;
    }

    return done;
  });

  return { ...prev, meetings, actions, users };
}

// Convert the Django meeting response into the format used by the UI.
function normalizeMeeting(meeting) {
  const seconds = Number(meeting.duration || 0);
  const rawStatus = String(meeting.status || "").toLowerCase();

  const processingStatuses = [
    "uploaded",
    "extracting_audio",
    "transcribing",
    "analyzing_conversation",
    "generating_analysis",
    "waiting_for_speaker_names",
  ];

  return {
    ...meeting,
    id: String(meeting._id || meeting.id || ""),
    title: meeting.title || "Untitled meeting",
    date: meeting.createdAt
      ? new Date(meeting.createdAt).toISOString().slice(0, 10)
      : today(),
    duration: Math.round(seconds / 60),
    speakers: Number(meeting.speakerCount || 0),
    status: processingStatuses.includes(rawStatus)
      ? "processing"
      : rawStatus,
    ownerId: meeting.userId || "",
  };
}


function normalizeAction(action = {}) {
  const rawStatus = String(action.status || "pending")
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ");

  const rawDue = action.calendarDate || action.deadline || action.due || "";
  const due = /^\d{4}-\d{2}-\d{2}/.test(String(rawDue))
    ? String(rawDue).slice(0, 10)
    : rawDue;

  return {
    ...action,
    id: String(action._id || action.id || ""),
    meetingId: String(action.meetingId || action.meeting_id || ""),
    ownerId: String(action.userId || action.ownerId || ""),
    task: action.task || action.title || action.description || "Untitled task",
    status: rawStatus === "in progress" ? "in progress" : rawStatus,
    assignee: action.assignee || "Unassigned",
    priority: String(action.priority || "medium").toLowerCase(),
    due: due || "TBD",
  };
}


export function DataProvider({ children }) {
  const { user } = useAuth();

  const [data, setData] = useState(loadData);

  const [apiMeetings, setApiMeetings] = useState([]);
  const [apiActions, setApiActions] = useState([]);
  const [meetingsLoaded, setMeetingsLoaded] = useState(false);
  const [actionsLoaded, setActionsLoaded] = useState(false);
  const [apiError, setApiError] = useState("");

  // Fetch real meeting and action data after login.
  useEffect(() => {
    if (!user) {
      setApiMeetings([]);
      setApiActions([]);
      setMeetingsLoaded(false);
      setActionsLoaded(false);
      setApiError("");
      return;
    }

    let cancelled = false;

    async function fetchDashboardData() {
      setMeetingsLoaded(false);
      setActionsLoaded(false);
      setApiError("");

      try {
        const response = await api.get("/meetings/");
        const payload = response.data;

        const meetings = Array.isArray(payload)
          ? payload
          : payload.meetings || payload.results || [];

        if (!Array.isArray(meetings)) {
          throw new Error("The meetings API did not return a list.");
        }

        if (!cancelled) {
          setApiMeetings(meetings.map(normalizeMeeting));
          setMeetingsLoaded(true);
        }
      } catch (error) {
        console.error(
          "Meetings API failed:",
          error.response?.data || error.message
        );

        if (!cancelled) {
          setApiMeetings([]);
          setApiError(
            error.response?.data?.message ||
              error.response?.data?.error ||
              error.message ||
              "Could not load meetings from the backend."
          );
          setMeetingsLoaded(true);
        }
      }

      try {
        const response = await api.get("/actions/");
        const payload = response.data;

        // The backend returns { stats, items }, not { actions }.
        const actions = Array.isArray(payload)
          ? payload
          : payload.items || payload.actions || payload.results || [];

        if (!Array.isArray(actions)) {
          throw new Error("The actions API did not return a list.");
        }

        if (!cancelled) {
          setApiActions(actions.map(normalizeAction));
          setActionsLoaded(true);
        }
      } catch (error) {
        console.error(
          "Action items API failed:",
          error.response?.data || error.message
        );

        if (!cancelled) {
          setApiActions([]);
          setActionsLoaded(true);
        }
      }
    }

    fetchDashboardData();

    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  // Keep the existing local demo data for other pages and features.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Local changes remain available in memory if storage is blocked.
    }
  }, [data]);

  const provisioned = useRef(new Set());

  const needsAccount =
    user?.role === "member" &&
    !data.users.some(
      (item) =>
        item.email?.toLowerCase() === user.email?.toLowerCase()
    );

  useEffect(() => {
    if (!needsAccount || provisioned.current.has(user.email)) return;

    provisioned.current.add(user.email);
    createMember({ name: user.name, email: user.email });
  }, [needsAccount]); // eslint-disable-line react-hooks/exhaustive-deps

  const isProcessing = data.meetings.some(isSimulating);

  useEffect(() => {
    if (!isProcessing) return;

    const timer = setInterval(
      () => setData(advanceMeetings),
      SIMULATION_MS
    );

    return () => clearInterval(timer);
  }, [isProcessing]);

  function makeLog(source, message, level = "info", actor) {
    const by =
      actor ||
      (user ? `${user.name} (${user.role})` : "system");

    return {
      id: newId("log"),
      time: new Date().toISOString(),
      level,
      source,
      actor: by,
      message,
    };
  }

  function update(source, message, change, level) {
    setData((prev) => ({
      ...prev,
      ...change(prev),
      logs: [
        makeLog(source, message, level),
        ...prev.logs,
      ].slice(0, 500),
    }));
  }

  function patch(change) {
    setData((prev) => ({ ...prev, ...change(prev) }));
  }

  function addLog(source, message, level, actor) {
    setData((prev) => ({
      ...prev,
      logs: [
        makeLog(source, message, level, actor),
        ...prev.logs,
      ].slice(0, 500),
    }));
  }

  function addUser(
    { name, email, role, password },
    message = `Created ${role} account ${email}`
  ) {
    const account = {
      id: newId("u"),
      name,
      email,
      role,
      meetings: 0,
      minutes: 0,
      status: "active",
      joined: today(),
      lastLogin: null,
    };

    if (password) account.password = password;

    update("users", message, (prev) => ({
      users: [account, ...prev.users],
    }));
  }

  function createMember(
    { name, email, password, phone, avatar },
    message
  ) {
    const account = {
      id: newId("u"),
      name,
      email,
      role: "member",
      meetings: sampleMeetings.length,
      minutes: 34,
      status: "active",
      joined: today(),
      lastLogin: today(),
    };

    if (password) account.password = password;
    if (phone) account.phone = phone;
    if (avatar) account.avatar = avatar;

    const samples = sampleDataFor(account);

    update(
      "users",
      message || `Created member account ${email}`,
      (prev) => ({
        users: [account, ...prev.users],
        meetings: [...samples.meetings, ...prev.meetings],
        actions: [...samples.actions, ...prev.actions],
      })
    );

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
      users: prev.users.map((item) =>
        item.id === id ? { ...item, ...changes } : item
      ),
    }));
  }

  function deleteUser(id, message) {
    update(
      "users",
      message,
      (prev) => ({
        users: prev.users.filter((item) => item.id !== id),
      }),
      "warning"
    );
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

    update(
      "meetings",
      `${owner.email} uploaded '${title}' (${fileName}, ${sizeMb} MB)`,
      (prev) => ({ meetings: [meeting, ...prev.meetings] })
    );

    return meeting;
  }

  function updateMeeting(id, changes) {
    patch((prev) => ({
      meetings: prev.meetings.map((meeting) =>
        meeting.id === id ? { ...meeting, ...changes } : meeting
      ),
    }));
  }


  async function deleteMeeting(id, message) {
    try {
      // First delete the meeting from the Django backend.
      await api.delete(`/meetings/${encodeURIComponent(id)}/`);

      // Only update the UI after the backend confirms deletion.
      setApiMeetings((previousMeetings) =>
        previousMeetings.filter(
          (meeting) => meeting.id !== String(id)
        )
      );

      setApiActions((previousActions) =>
        previousActions.filter(
          (action) => action.meetingId !== String(id)
        )
      );

      // Keep the local demo data and activity log in sync.
      update(
        "meetings",
        message || `Deleted meeting ${id}`,
        (prev) => ({
          meetings: prev.meetings.filter(
            (meeting) => meeting.id !== id
          ),
          actions: prev.actions.filter(
            (action) => action.meetingId !== id
          ),
        }),
        "warning"
      );

      return true;
    } catch (error) {
      console.error(
        "Backend meeting deletion failed:",
        error.response?.data || error.message
      );

      throw error;
    }
  }


  function reprocessMeeting(id) {
    const meeting = data.meetings.find((item) => item.id === id);

    if (!meeting) return;

    update(
      "meetings",
      `Queued '${meeting.title}' for reprocessing`,
      (prev) => ({
        meetings: prev.meetings.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "queued",
                stage: "Queued",
                error: null,
                simulated: true,
              }
            : item
        ),
      })
    );
  }

  async function addAction(action) {
    const payload = {
      task: action.task,
      assignee: action.assignee || "Unassigned",
      deadline: action.due,
      calendarDate: action.due,
      meetingId: action.meetingId,
      meetingTitle: action.meetingTitle || "",
      status: "pending",
    };

    try {
      const response = await api.post("/actions/", payload);
      const body = response.data;
      const savedAction = body?.item || body?.action || body?.data || body;
      if (!savedAction || typeof savedAction !== "object") {
        throw new Error("The server did not return the saved action item.");
      }

      const normalized = normalizeAction(savedAction);
      if (!normalized.id) {
        // Refetch the collection if the POST response only contains a success message.
        const refreshed = await api.get("/actions/");
        const rows = Array.isArray(refreshed.data)
          ? refreshed.data
          : refreshed.data?.items || refreshed.data?.actions || refreshed.data?.results || [];
        setApiActions(Array.isArray(rows) ? rows.map(normalizeAction) : []);
        return normalized;
      }

      setApiActions((previous) => [normalized, ...previous.filter((item) => item.id !== normalized.id)]);
      return normalized;
    } catch (error) {
      console.error("Adding action failed:", error.response?.data || error.message);
      throw error;
    }
  }

  async function updateAction(id, changes) {
    const payload = {};
    if (changes.status !== undefined) payload.status = changes.status;
    if (changes.task !== undefined) payload.task = changes.task;
    if (changes.assignee !== undefined) payload.assignee = changes.assignee;
    if (changes.due !== undefined) {
      payload.deadline = changes.due;
      payload.calendarDate = changes.due;
    }

    try {
      const response = await api.patch(`/actions/${encodeURIComponent(id)}/`, payload);
      const body = response.data;
      const returned = body?.item || body?.action || body?.data || body;

      setApiActions((previous) => previous.map((item) => {
        if (String(item.id) !== String(id)) return item;
        if (!returned || typeof returned !== "object" || (!returned._id && !returned.id && !returned.task && !returned.status)) {
          return normalizeAction({ ...item, ...changes });
        }
        return normalizeAction({ ...item, ...returned, ...changes });
      }));
      return true;
    } catch (error) {
      console.error("Updating action failed:", error.response?.data || error.message);
      throw error;
    }
  }

  async function deleteAction(id) {
    try {
      await api.delete(`/actions/${encodeURIComponent(id)}/`);
      setApiActions((previous) => previous.filter((item) => String(item.id) !== String(id)));
      return true;
    } catch (error) {
      console.error("Deleting action failed:", error.response?.data || error.message);
      throw error;
    }
  }

  function updateStaffProfile(role, changes, message) {
    update("settings", message, (prev) => ({
      staffProfiles: {
        ...prev.staffProfiles,
        [role]: {
          ...prev.staffProfiles[role],
          ...changes,
        },
      },
    }));
  }

  function updateSettings(settings) {
    update("settings", "Updated system settings", () => ({
      settings,
    }));
  }

  function clearLogs() {
    setData((prev) => ({
      ...prev,
      logs: [
        makeLog("system", "Cleared the activity log", "warning"),
      ],
    }));
  }

  function resetData() {
    setData({
      ...initialData(),
      logs: [
        makeLog("system", "Reset all demo data", "warning"),
        ...mock.logs,
      ],
    });
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
    apiMeetings,
    apiActions,
    meetingsLoaded,
    actionsLoaded,
    apiError,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}

export function useMember() {
  const { user } = useAuth();

  const {
    users,
    apiMeetings,
    apiActions,
    meetingsLoaded,
    actionsLoaded,
    apiError,
  } = useData();

  const localAccount = users.find(
    (item) =>
      item.email?.toLowerCase() === user?.email?.toLowerCase()
  );

  // Fall back to the authenticated backend user if no local
  // mock account exists for that email.
  const account = localAccount || (
    user
      ? {
          ...user,
          id: user.id || user._id,
          meetings: user.totalMeetings || 0,
          minutes: user.totalMinutesProcessed || 0,
        }
      : null
  );

  return {
    account,
    meetings: apiMeetings,
    actions: apiActions,
    meetingsLoaded,
    actionsLoaded,
    apiError,
  };
}