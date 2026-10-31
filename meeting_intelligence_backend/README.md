# AI Meeting Intelligence Platform — Backend Service

A scalable, production-grade Django REST Framework backend for the **AI Meeting Intelligence Platform** powered by **MongoDB Atlas**, **Groq Whisper** (Speech-to-Text), and **Groq LLM (Llama 3.3 70B)**.

This backend provides the complete API implementation for:
1. **Meeting Intelligence Detail Page** (`/meetings/:id`):
   - Meeting Header & Audio/Video playback info
   - Synchronized Transcript with precise timestamps & speaker labels
   - Executive Summary
   - Key Discussion Points
   - Decisions & dedicated Final Decision highlight
   - Action Items with assignees & deadlines
   - Unresolved Issues & Important Questions (Answered / Unanswered)
   - Potential Risks & Blockers
   - Interactive **Ask Meeting AI** Q&A with cited source timestamps
   - Live Transcript Search (`?q=keyword`)
   - Speaker Renaming & Propagated Speaker Assignments
   - Multi-format Exports (PDF, Word DOCX, TXT, Subtitle SRT, JSON)
2. **All Action Items Page** (`/action-items` or `/actions`):
   - Global status breakdown (`Pending`, `In Progress`, `Completed`)
   - Filtering by meeting, assignee, status, search
   - Real-time status toggling & task updates
3. **Authentication & Admin System**:
   - JWT tokens (Access & Refresh)
   - User roles (`member`, `manager`, `admin`)
   - Admin Analytics & Usage Tracking

---

## 📁 Project Architecture

```
meeting_intelligence_backend/
├── manage.py                     # Django administrative entrypoint
├── requirements.txt              # Production dependencies
├── .env.example                  # Environment configuration template
├── .env                          # Local environment settings
├── Dockerfile                    # Containerization with FFmpeg & Python 3.11
├── docker-compose.yml            # Docker services (backend, redis, celery)
├── test_api.py                   # Automated end-to-end API test suite
├── seed_data.py                  # Demo database seeder matching video walkthrough
├── README.md                     # Complete execution and integration guide
├── config/                       # Core Django configuration
│   ├── settings.py               # Settings, CORS, DRF, MongoDB, Groq
│   ├── urls.py                   # Root URL routing
│   ├── wsgi.py                   # WSGI entrypoint
│   ├── asgi.py                   # ASGI entrypoint
│   └── celery.py                 # Celery asynchronous worker setup
├── apps/                         # Modular Django applications
│   ├── authentication/           # JWT login, register, profile
│   ├── meetings/                 # Meetings CRUD, upload, processing pipeline
│   ├── transcripts/              # Timestamped transcript segments & search
│   ├── speakers/                 # Speaker assignment & diarization
│   ├── analysis/                 # Meeting Intelligence, Summary & Ask AI
│   ├── actions/                  # Dedicated Action Items page endpoints
│   ├── admin_dashboard/          # Admin stats, user management, audit logs
│   └── exports/                  # PDF, DOCX, TXT, SRT, JSON document generation
├── services/                     # Business logic & external AI integrations
│   ├── storage/                  # MongoDB Atlas client with local JSON fallback
│   ├── whisper/                  # Groq Whisper speech-to-text service
│   ├── groq/                     # Groq Llama 3.3 70B conversation & analysis
│   ├── media/                    # FFmpeg audio extraction & metadata
│   └── pipeline/                 # End-to-end processing pipeline coordinator
└── tasks/                        # Celery tasks (transcription, conversation, analysis)
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+ (tested with Python 3.11)
- `pip`
- (Optional) FFmpeg installed in system PATH for local video-to-audio extraction
- (Optional) Free Groq API Key & MongoDB Atlas connection string

### 2. Installation
```bash
# Clone or extract project ZIP into your desired directory
cd meeting_intelligence_backend

# (Recommended) Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install required dependencies
pip install -r requirements.txt
```

### 3. Initialize & Seed Demo Data
Populate the database with the exact demo user, meetings, transcripts, and action items shown in the video:
```bash
python manage.py migrate
python seed_data.py
```
> **Seeded Credentials:**
> - Member Email: `prachi@example.com` | Password: `password123`
> - Admin Email: `ayush@example.com` | Password: `admin123`

### 4. Run the Backend Server
```bash
python manage.py runserver 8000
```
The API is now running at `http://127.0.0.1:8000`!

### 5. Run Automated Test Suite
To verify every single endpoint in under 3 seconds:
```bash
python test_api.py
```

---

## 🔑 External Services Configuration

Edit `.env` to configure external cloud services:

### A. Groq API (Whisper & LLM)
Groq offers an ultra-fast, free-tier API hosting both **Whisper Large v3** and **Llama 3.3 70B**:
1. Go to [https://console.groq.com/keys](https://console.groq.com/keys)
2. Sign in and click **"Create API Key"**
3. Add the key to `.env`:
   ```ini
   GROQ_API_KEY=gsk_your_actual_groq_key_here
   GROQ_MODEL=llama-3.3-70b-versatile
   WHISPER_MODEL=whisper-large-v3
   ```
> *Note: If `GROQ_API_KEY` is not provided, the backend automatically uses realistic semantic intelligence fallbacks, so your local development is never blocked!*

### B. MongoDB Atlas
1. Sign up for free at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free **M0 Shared Cluster**.
3. Under **Security > Network Access**, click **Add IP Address** > Choose **Allow Access from Anywhere (`0.0.0.0/0`)** or your current IP.
4. Under **Security > Database Access**, create a database user (e.g., `app_user` with password).
5. Click **Connect > Drivers > Python** and copy your connection string:
   ```ini
   MONGO_URI=mongodb+srv://app_user:yourPassword@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   MONGO_DB_NAME=meeting_intelligence
   ```
> *Note: If `MONGO_URI` is omitted or network is offline, the backend seamlessly uses a local JSON-persisted document store in `./data/` with the exact same MongoDB collection interface.*

### C. FFmpeg Media Extraction
FFmpeg extracts 16kHz mono audio from uploaded `.mp4`, `.mov`, `.mkv`, and `.webm` files:
- **Windows**: Download from [gyan.dev/ffmpeg](https://www.gyan.dev/ffmpeg/builds/) and add the `bin` folder to your system PATH.
- **Mac**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg`
- **Docker**: Included automatically in `Dockerfile`.

---

## 📡 API Reference & Frontend Data Fetching

### 1. Authentication
#### `POST /api/auth/login/`
**Request Body:**
```json
{
  "email": "prachi@example.com",
  "password": "password123"
}
```
**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "user_prachi_001",
    "name": "Prachi",
    "email": "prachi@example.com",
    "role": "member",
    "totalMeetings": 5,
    "totalMinutesProcessed": 384
  },
  "tokens": {
    "access": "eyJhbGciOi...",
    "refresh": "eyJhbGciOi...",
    "token_type": "Bearer"
  }
}
```
Attach the access token in subsequent requests:
```http
Authorization: Bearer <access_token>
```

---

### 2. Meeting Detail Page (`/meetings/:id`)

#### `GET /api/meetings/:id/`
Fetches all details needed to render the post-meeting intelligence screen:
```javascript
// React Frontend Fetch Example:
const fetchMeetingDetails = async (meetingId) => {
  const response = await fetch(`http://127.0.0.1:8000/api/meetings/${meetingId}/`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const data = await response.json();
  return data;
};
```
**Response Structure:**
```json
{
  "id": "meeting_website_sprint_001",
  "title": "Website Development – Sprint Planning",
  "duration": 2700,
  "durationFormatted": "45 min",
  "fileUrl": "https://assets.mixkit.co/...",
  "status": "completed",
  "speakerCount": 3,
  "createdAt": "2026-10-08T10:00:00Z",
  "speakers": [
    { "_id": "spk_001", "label": "SPEAKER_1", "name": "Ayush", "role": "Project Manager" },
    { "_id": "spk_002", "label": "SPEAKER_2", "name": "Rahul", "role": "Frontend Lead" },
    { "_id": "spk_003", "label": "SPEAKER_3", "name": "Prachi", "role": "Scrum Master" }
  ],
  "summary": "The team aligned on the website development sprint deliverables...",
  "keyPoints": [
    "Frontend responsive layouts and cross-device testing status.",
    "Headless CMS integration and schema mappings schedule.",
    "Client content assets delivery timeline."
  ],
  "decisions": [
    "Frontend responsive layout must be completed and tested before CMS deployment starts.",
    "Client will provide final website content assets and copy by Monday morning."
  ],
  "finalDecision": "The team agreed that the website development must be completed and deployed by Friday.",
  "actionItems": [
    {
      "task": "Complete responsive dashboard layout and test viewports",
      "assignee": "Rahul",
      "deadline": "Thursday",
      "status": "pending"
    }
  ],
  "deadlines": [
    { "item": "Frontend responsive polish", "deadline": "Thursday", "isInferred": false },
    { "item": "CMS configuration", "deadline": "Friday", "isInferred": false }
  ],
  "questions": [
    {
      "question": "Can the responsive layout be finished by Thursday?",
      "classification": "Answered",
      "answer": "Yes, Rahul confirmed it will be ready for review by Thursday evening."
    }
  ],
  "risks": [
    "Potential delay in receiving client content assets before Monday.",
    "CMS schema updates mid-sprint could cause integration delays."
  ],
  "unresolvedIssues": [
    "Hosting provider and production server tier not yet finalized."
  ],
  "transcriptSegments": [
    {
      "segmentNumber": 1,
      "startTime": 4.0,
      "endTime": 10.0,
      "speakerName": "Ayush",
      "text": "Good morning everyone. Let's start our sprint planning meeting."
    }
  ]
}
```

#### `POST /api/meetings/:id/ask/` (Ask Meeting AI)
Ask questions and get answers with cited timestamps:
```json
{
  "question": "Who was assigned the frontend?"
}
```
**Response:**
```json
{
  "question": "Who was assigned the frontend?",
  "answer": "Rahul was assigned the frontend development task to complete responsive layouts by Thursday.",
  "sourceTimestamp": "00:18",
  "citedSpeaker": "Rahul"
}
```

#### `GET /api/meetings/:id/transcript/search/?q=deadline`
Search synchronized transcript lines.

---

### 3. All Action Items Page (`/action-items`)

#### `GET /api/actions/`
Supports filtering query params:
- `?status=pending` (or `in_progress`, `completed`, `all`)
- `?meetingId=meeting_website_sprint_001`
- `?assignee=Rahul`
- `?search=dashboard`

```javascript
// React Frontend Fetch Example:
const fetchAllActionItems = async (statusFilter = "all") => {
  const url = `http://127.0.0.1:8000/api/actions/${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`;
  const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
  return await res.json();
};
```
**Response Structure:**
```json
{
  "stats": {
    "total": 5,
    "pending": 3,
    "inProgress": 1,
    "completed": 1
  },
  "items": [
    {
      "_id": "act_001",
      "meetingId": "meeting_website_sprint_001",
      "meetingTitle": "Website Development – Sprint Planning",
      "task": "Complete responsive dashboard layout and test viewports",
      "assignee": "Rahul",
      "deadline": "Thursday",
      "calendarDate": "2026-10-23",
      "isInferred": false,
      "status": "pending",
      "createdAt": "2026-10-08T10:05:00Z"
    }
  ]
}
```

#### `PATCH /api/actions/:id/` (Toggle Status or Edit)
```json
{
  "status": "completed"
}
```

#### `POST /api/actions/` (Create New Action Item)
```json
{
  "meetingId": "meeting_website_sprint_001",
  "task": "Review staging analytics and caching",
  "assignee": "Prachi",
  "deadline": "Friday",
  "status": "pending"
}
```

---

### 4. Meeting Exports
- `GET /api/meetings/:id/export/pdf/` — Formatted PDF with full meeting intelligence & transcript.
- `GET /api/meetings/:id/export/docx/` — Word Document.
- `GET /api/meetings/:id/export/txt/` — Formatted plain text.
- `GET /api/meetings/:id/export/srt/` — Subtitle file with synchronized timestamps.
- `GET /api/meetings/:id/export/json/` — Raw JSON bundle.

---

### 5. Admin Dashboard
- `GET /api/admin/dashboard/` — System stats (total users, active users, total hours processed).
- `GET /api/admin/users/` — User management directory.
- `PATCH /api/admin/users/:id/` — Change role / status.
- `GET /api/admin/analytics/` — Processing and AI request volume.
