"""
Demo Data Seeder
Populates MongoDB / local document store with the exact meetings, transcripts,
speakers, intelligence analysis, and action items shown in the video demonstration.
"""

import os
import sys
from datetime import datetime
from pathlib import Path

# Setup Django environment
sys.path.insert(0, str(Path(__file__).resolve().parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from services.storage.mongo import get_collection
from apps.authentication.jwt_utils import hash_password

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def seed():
    print("[*] Starting database seed...")

    users_col = get_collection("users")
    meetings_col = get_collection("meetings")
    segments_col = get_collection("transcript_segments")
    speakers_col = get_collection("speakers")
    analysis_col = get_collection("meeting_analysis")
    actions_col = get_collection("action_items")
    jobs_col = get_collection("processing_jobs")

    # 1. Seed Demo User: Prachi (matching the video at 55s-65s)
    user_id = "user_prachi_001"
    user_doc = {
        "_id": user_id,
        "name": "Prachi",
        "email": "prachi@example.com",
        "passwordHash": hash_password("password123"),
        "role": "member",
        "status": "active",
        "phone": "+1 (555) 234-5678",
        "totalMeetings": 5,
        "totalMinutesProcessed": 384,
        "createdAt": "2026-10-01T09:00:00Z",
        "lastLoginAt": datetime.utcnow().isoformat()
    }
    users_col.update_one({"_id": user_id}, {"$set": user_doc}, upsert=True)
    print(f"[+] Seeded User: {user_doc['name']} ({user_doc['email']}) / password: password123")

    # Also seed Admin user
    admin_id = "user_admin_001"
    admin_doc = {
        "_id": admin_id,
        "name": "Ayush Kumar",
        "email": "ayush@example.com",
        "passwordHash": hash_password("admin123"),
        "role": "admin",
        "status": "active",
        "totalMeetings": 12,
        "totalMinutesProcessed": 384,
        "createdAt": "2026-09-15T08:00:00Z",
        "lastLoginAt": datetime.utcnow().isoformat()
    }
    users_col.update_one({"_id": admin_id}, {"$set": admin_doc}, upsert=True)
    print(f"[+] Seeded Admin User: {admin_doc['name']} ({admin_doc['email']}) / password: admin123")

    # 2. Primary Meeting: Website Development - Sprint Planning (Video 75s-85s)
    m1_id = "meeting_website_sprint_001"
    m1_doc = {
        "_id": m1_id,
        "userId": user_id,
        "title": "Website Development – Sprint Planning",
        "fileUrl": "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3",
        "fileType": "video",
        "duration": 2700, # 45 min
        "language": "English",
        "status": "completed",
        "speakerCount": 3,
        "createdAt": "2026-10-08T10:00:00Z",
        "completedAt": "2026-10-08T10:05:00Z"
    }
    meetings_col.update_one({"_id": m1_id}, {"$set": m1_doc}, upsert=True)

    # Speakers for Meeting 1
    speakers_m1 = [
        {"_id": "spk_001", "meetingId": m1_id, "label": "SPEAKER_1", "name": "Ayush", "role": "Project Manager"},
        {"_id": "spk_002", "meetingId": m1_id, "label": "SPEAKER_2", "name": "Rahul", "role": "Frontend Lead"},
        {"_id": "spk_003", "meetingId": m1_id, "label": "SPEAKER_3", "name": "Prachi", "role": "Scrum Master"}
    ]
    speakers_col.delete_many({"meetingId": m1_id})
    for spk in speakers_m1:
        speakers_col.insert_one(spk)

    # Transcript Segments for Meeting 1
    segments_m1 = [
        {"_id": "seg_001", "meetingId": m1_id, "segmentNumber": 1, "startTime": 4.0, "endTime": 10.0, "text": "Good morning everyone. Let's start our sprint planning meeting.", "speakerId": "spk_001", "speakerLabel": "SPEAKER_1", "speakerName": "Ayush"},
        {"_id": "seg_002", "meetingId": m1_id, "segmentNumber": 2, "startTime": 10.5, "endTime": 17.5, "text": "We need to discuss the website development progress, deliverable timeline, and deadlines.", "speakerId": "spk_001", "speakerLabel": "SPEAKER_1", "speakerName": "Ayush"},
        {"_id": "seg_003", "meetingId": m1_id, "segmentNumber": 3, "startTime": 18.0, "endTime": 24.5, "text": "The frontend is almost complete. I am currently polishing the responsive layouts.", "speakerId": "spk_002", "speakerLabel": "SPEAKER_2", "speakerName": "Rahul"},
        {"_id": "seg_004", "meetingId": m1_id, "segmentNumber": 4, "startTime": 25.0, "endTime": 32.5, "text": "Can we finish the responsive layout and test it across mobile devices by Thursday?", "speakerId": "spk_003", "speakerLabel": "SPEAKER_3", "speakerName": "Prachi"},
        {"_id": "seg_005", "meetingId": m1_id, "segmentNumber": 5, "startTime": 33.0, "endTime": 40.0, "text": "Yes, that should be possible. I will have it ready for review by Thursday evening.", "speakerId": "spk_002", "speakerLabel": "SPEAKER_2", "speakerName": "Rahul"},
        {"_id": "seg_006", "meetingId": m1_id, "segmentNumber": 6, "startTime": 41.0, "endTime": 51.0, "text": "Excellent. I will configure the CMS integration and schema mappings on Friday.", "speakerId": "spk_001", "speakerLabel": "SPEAKER_1", "speakerName": "Ayush"},
        {"_id": "seg_007", "meetingId": m1_id, "segmentNumber": 7, "startTime": 52.0, "endTime": 64.0, "text": "What about the client assets and copy approval? Do we have everything needed?", "speakerId": "spk_003", "speakerLabel": "SPEAKER_3", "speakerName": "Prachi"},
        {"_id": "seg_008", "meetingId": m1_id, "segmentNumber": 8, "startTime": 65.0, "endTime": 77.0, "text": "The client confirmed they will deliver the final website content and assets by Monday morning.", "speakerId": "spk_001", "speakerLabel": "SPEAKER_1", "speakerName": "Ayush"},
        {"_id": "seg_009", "meetingId": m1_id, "segmentNumber": 9, "startTime": 78.0, "endTime": 89.0, "text": "That fits our schedule. Once the CMS is configured, we can hook up the dynamic content.", "speakerId": "spk_002", "speakerLabel": "SPEAKER_2", "speakerName": "Rahul"},
        {"_id": "seg_010", "meetingId": m1_id, "segmentNumber": 10, "startTime": 90.0, "endTime": 101.0, "text": "Let's make sure our staging environment is tested before we deploy to production.", "speakerId": "spk_003", "speakerLabel": "SPEAKER_3", "speakerName": "Prachi"},
        {"_id": "seg_011", "meetingId": m1_id, "segmentNumber": 11, "startTime": 102.0, "endTime": 115.0, "text": "Agreed. So the final decision is that the website must be completed and deployed by Friday.", "speakerId": "spk_001", "speakerLabel": "SPEAKER_1", "speakerName": "Ayush"}
    ]
    segments_col.delete_many({"meetingId": m1_id})
    for seg in segments_m1:
        segments_col.insert_one(seg)

    # Analysis for Meeting 1
    analysis_m1 = {
        "meetingId": m1_id,
        "summary": "The team aligned on the website development sprint deliverables, prioritizing frontend responsive polish, headless CMS integration, and staging verification. Rahul committed to delivering the responsive layouts by Thursday evening, and Ayush will configure CMS schema integrations on Friday. Final website content will be supplied by the client on Monday morning.",
        "keyPoints": [
            "Frontend responsive layouts and cross-device testing status.",
            "Headless CMS integration and schema mappings schedule.",
            "Client content assets delivery timeline.",
            "Staging environment testing protocol prior to production release.",
            "Sprint delivery milestones and target sign-off dates."
        ],
        "topics": [
            "Website Development",
            "Frontend Layouts",
            "CMS Configuration",
            "Client Deliverables",
            "Deployment Planning"
        ],
        "decisions": [
            "Frontend responsive layout must be completed and tested before CMS deployment starts.",
            "Target project completion and staging delivery date is scheduled for Friday.",
            "Client will provide final website content assets and copy by Monday morning."
        ],
        "finalDecision": "The team agreed that the website development must be completed and deployed by Friday.",
        "actionItems": [
            {
                "task": "Complete responsive dashboard layout and test viewports",
                "assignee": "Rahul",
                "deadline": "Thursday",
                "calendarDate": "2026-10-23",
                "isInferred": False,
                "status": "pending"
            },
            {
                "task": "Configure CMS integration and endpoint schema mappings",
                "assignee": "Ayush",
                "deadline": "Friday",
                "calendarDate": "2026-10-24",
                "isInferred": False,
                "status": "pending"
            },
            {
                "task": "Review sprint cadence metrics and team bandwidth",
                "assignee": "Prachi",
                "deadline": "Monday",
                "calendarDate": "2026-10-27",
                "isInferred": False,
                "status": "in_progress"
            },
            {
                "task": "Share sprint notes with stakeholders and collect feedback",
                "assignee": "Ayush",
                "deadline": "Tuesday",
                "calendarDate": "2026-10-28",
                "isInferred": True,
                "status": "completed"
            }
        ],
        "deadlines": [
            {"item": "Frontend responsive polish completion", "deadline": "Thursday", "isInferred": False},
            {"item": "CMS configuration and deployment milestone", "deadline": "Friday", "isInferred": False},
            {"item": "Client asset handover", "deadline": "Monday", "isInferred": False}
        ],
        "questions": [
            {
                "question": "Can the frontend responsive design be completed by Thursday?",
                "classification": "Answered",
                "answer": "Yes, Rahul confirmed the layout will be ready for review by Thursday evening."
            },
            {
                "question": "Which hosting provider and cloud environment will be selected?",
                "classification": "Unanswered",
                "answer": "Hosting provider has not yet been finalized; pending architectural review."
            },
            {
                "question": "Who will configure CMS schemas and webhooks?",
                "classification": "Answered",
                "answer": "Ayush agreed to configure the CMS on Friday."
            }
        ],
        "unresolvedIssues": [
            "Hosting provider and production server tier not yet finalized.",
            "CMS webhook synchronization method with frontend not yet confirmed.",
            "Final budget and third-party API rate quotas require formal approval."
        ],
        "risks": [
            "Potential delay in receiving client content assets before Monday.",
            "CMS schema updates mid-sprint could cause integration delays.",
            "Staging deployment environment not yet fully provisioned."
        ],
        "updatedAt": "2026-10-08T10:05:00Z"
    }
    analysis_col.update_one({"meetingId": m1_id}, {"$set": analysis_m1}, upsert=True)

    # Job for Meeting 1
    jobs_col.update_one(
        {"meetingId": m1_id},
        {
            "$set": {
                "_id": "job_m1_001",
                "meetingId": m1_id,
                "userId": user_id,
                "status": "completed",
                "currentStage": "COMPLETED",
                "progress": 100,
                "startedAt": "2026-10-08T10:00:00Z",
                "completedAt": "2026-10-08T10:05:00Z",
                "error": None
            }
        },
        upsert=True
    )
    print(f"[+] Seeded Meeting 1: {m1_doc['title']}")

    # 3. Seed additional meetings matching the dashboard video
    extra_meetings = [
        {
            "_id": "meeting_roadmap_002",
            "userId": user_id,
            "title": "Product Roadmap Review",
            "fileUrl": "",
            "fileType": "video",
            "duration": 1920, # 32 min
            "language": "English",
            "status": "completed",
            "speakerCount": 4,
            "createdAt": "2026-10-07T14:30:00Z",
            "completedAt": "2026-10-07T14:34:00Z",
            "summary": "Review of Q4 product roadmap, onboarding enhancements, and mobile app timeline.",
            "finalDecision": "Prioritize seamless mobile authentication before building offline sync."
        },
        {
            "_id": "meeting_feedback_003",
            "userId": user_id,
            "title": "Customer Feedback Sync",
            "fileUrl": "",
            "fileType": "audio",
            "duration": 1620, # 27 min
            "language": "English",
            "status": "completed",
            "speakerCount": 3,
            "createdAt": "2026-10-06T11:00:00Z",
            "completedAt": "2026-10-06T11:04:00Z",
            "summary": "Synthesized customer interview findings highlighting the demand for transcript search.",
            "finalDecision": "Implement real-time timestamp-based search in upcoming release."
        },
        {
            "_id": "meeting_weekly_004",
            "userId": user_id,
            "title": "Weekly Engineering Sync",
            "fileUrl": "",
            "fileType": "video",
            "duration": 2400, # 40 min
            "language": "English",
            "status": "processing",
            "speakerCount": 5,
            "createdAt": "2026-10-05T09:00:00Z",
            "completedAt": None,
            "summary": "Discussion of backend microservices latency and Celery queue throughput.",
            "finalDecision": "Evaluate Redis queue tuning and database connection pooling."
        },
        {
            "_id": "meeting_design_005",
            "userId": user_id,
            "title": "Design System Handoff",
            "fileUrl": "",
            "fileType": "video",
            "duration": 1200, # 20 min
            "language": "English",
            "status": "failed",
            "speakerCount": 2,
            "createdAt": "2026-10-04T16:00:00Z",
            "completedAt": None,
            "summary": "Design review of the dark theme color palette and accessibility contrast.",
            "finalDecision": "Revise tertiary accent colors to meet WCAG AA standards."
        }
    ]

    for em in extra_meetings:
        summary_text = em.pop("summary")
        final_dec = em.pop("finalDecision")
        em_id = em["_id"]
        meetings_col.update_one({"_id": em_id}, {"$set": em}, upsert=True)

        analysis_col.update_one(
            {"meetingId": em_id},
            {
                "$set": {
                    "meetingId": em_id,
                    "summary": summary_text,
                    "keyPoints": ["Sprint objectives alignment", "Architecture review", "Delivery milestones"],
                    "decisions": [final_dec],
                    "finalDecision": final_dec,
                    "actionItems": [],
                    "deadlines": [],
                    "questions": [],
                    "unresolvedIssues": [],
                    "risks": []
                }
            },
            upsert=True
        )

    print("[+] Seeded 4 additional meetings matching dashboard list")

    # 4. Seed Action Items Collection for "All Action Items" Page (Video 95s-100s)
    actions_col.delete_many({})
    all_action_items = [
        {
            "_id": "act_001",
            "meetingId": m1_id,
            "meetingTitle": "Website Development – Sprint Planning",
            "userId": user_id,
            "task": "Complete responsive dashboard layout and test viewports",
            "assignee": "Rahul",
            "deadline": "Thursday",
            "calendarDate": "2026-10-23",
            "isInferred": False,
            "status": "pending",
            "createdAt": "2026-10-08T10:05:00Z",
            "updatedAt": "2026-10-08T10:05:00Z"
        },
        {
            "_id": "act_002",
            "meetingId": m1_id,
            "meetingTitle": "Website Development – Sprint Planning",
            "userId": user_id,
            "task": "Configure CMS integration and endpoint schema mappings",
            "assignee": "Ayush",
            "deadline": "Friday",
            "calendarDate": "2026-10-24",
            "isInferred": False,
            "status": "pending",
            "createdAt": "2026-10-08T10:05:00Z",
            "updatedAt": "2026-10-08T10:05:00Z"
        },
        {
            "_id": "act_003",
            "meetingId": m1_id,
            "meetingTitle": "Website Development – Sprint Planning",
            "userId": user_id,
            "task": "Review sprint cadence metrics and team bandwidth",
            "assignee": "Prachi",
            "deadline": "Monday",
            "calendarDate": "2026-10-27",
            "isInferred": False,
            "status": "in_progress",
            "createdAt": "2026-10-08T10:05:00Z",
            "updatedAt": "2026-10-08T10:05:00Z"
        },
        {
            "_id": "act_004",
            "meetingId": m1_id,
            "meetingTitle": "Website Development – Sprint Planning",
            "userId": user_id,
            "task": "Share sprint notes with stakeholders and collect feedback",
            "assignee": "Ayush",
            "deadline": "Tuesday",
            "calendarDate": "2026-10-28",
            "isInferred": True,
            "status": "completed",
            "createdAt": "2026-10-08T10:05:00Z",
            "updatedAt": "2026-10-08T10:05:00Z"
        },
        {
            "_id": "act_005",
            "meetingId": "meeting_roadmap_002",
            "meetingTitle": "Product Roadmap Review",
            "userId": user_id,
            "task": "Design wireframes for offline mobile sync workflow",
            "assignee": "Design Team",
            "deadline": "Next Wednesday",
            "calendarDate": "2026-10-29",
            "isInferred": False,
            "status": "pending",
            "createdAt": "2026-10-07T14:35:00Z",
            "updatedAt": "2026-10-07T14:35:00Z"
        }
    ]

    for it in all_action_items:
        actions_col.insert_one(it)

    print(f"[+] Seeded {len(all_action_items)} Action Items for All Actions Page")
    print("\n[SUCCESS] Database seeding completed successfully! All demo data matching the video is ready.")

if __name__ == "__main__":
    seed()
