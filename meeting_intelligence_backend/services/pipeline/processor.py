"""
Meeting Processing Pipeline Coordinator
Orchestrates: Media Extraction -> Whisper Transcription -> Turn Detection -> Meeting Analysis -> Action Items Generation
Tracks processing states and progress updates.
"""

import os
import logging
from datetime import datetime
from bson import ObjectId
from pathlib import Path
from django.conf import settings

from services.storage.mongo import get_collection
from services.media.ffmpeg_service import FFmpegService
from services.whisper.whisper_service import WhisperService
from services.groq.conversation_service import ConversationAnalysisService
from services.groq.analysis_service import MeetingAnalysisService

logger = logging.getLogger(__name__)

class PipelineProcessor:
    @staticmethod
    def process_meeting(meeting_id: str, auto_name_speakers: bool = True):
        """
        Executes the end-to-end processing pipeline for a meeting record.
        """
        meetings_col = get_collection("meetings")
        jobs_col = get_collection("processing_jobs")
        segments_col = get_collection("transcript_segments")
        speakers_col = get_collection("speakers")
        analysis_col = get_collection("meeting_analysis")
        actions_col = get_collection("action_items")
        users_col = get_collection("users")

        meeting = meetings_col.find_one({"_id": meeting_id})
        if not meeting:
            logger.error(f"Meeting {meeting_id} not found.")
            return

        # Find or create processing job
        job = jobs_col.find_one({"meetingId": meeting_id})
        if not job:
            job = {
                "_id": str(ObjectId()),
                "meetingId": meeting_id,
                "userId": meeting.get("userId"),
                "status": "processing",
                "currentStage": "EXTRACTING_AUDIO",
                "progress": 15,
                "startedAt": datetime.utcnow().isoformat(),
                "completedAt": None,
                "error": None
            }
            jobs_col.insert_one(job)

        def update_job(stage: str, progress: int, status="processing", error=None):
            jobs_col.update_one(
                {"meetingId": meeting_id},
                {
                    "$set": {
                        "currentStage": stage,
                        "progress": progress,
                        "status": status,
                        "error": error,
                        "updatedAt": datetime.utcnow().isoformat()
                    }
                }
            )
            meetings_col.update_one(
                {"_id": meeting_id},
                {"$set": {"status": status.lower()}}
            )

        try:
            # 1. AUDIO EXTRACTION
            update_job("EXTRACTING_AUDIO", 20)
            file_path = meeting.get("filePath")
            audio_path = file_path

            if file_path and os.path.exists(file_path):
                ext = Path(file_path).suffix.lower()
                if ext in [".mp4", ".mov", ".mkv", ".webm", ".avi"]:
                    try:
                        audio_path = FFmpegService.extract_audio(file_path)
                    except Exception as e:
                        logger.warning(f"FFmpeg extraction failed ({e}), continuing with original path.")
                        audio_path = file_path

            # 2. WHISPER TRANSCRIPTION
            update_job("TRANSCRIBING", 45)
            transcription = WhisperService.transcribe(audio_path if audio_path and os.path.exists(audio_path) else "")
            raw_segments = transcription.get("segments", [])
            language = transcription.get("language", "English")
            duration = transcription.get("duration", 0.0) or meeting.get("duration", 2700)

            # 3. CONVERSATION TURN DETECTION (Option B)
            update_job("ANALYZING_CONVERSATION", 65)
            turn_analysis = ConversationAnalysisService.detect_speakers(raw_segments)
            detected_speakers = turn_analysis.get("speakers", [])
            turn_assignments = {t["id"]: t["speaker"] for t in turn_analysis.get("turnAssignments", [])}

            # Map speaker labels to names if already configured or default demo names
            default_speaker_names = {
                "SPEAKER_1": ("Ayush", "Project Manager"),
                "SPEAKER_2": ("Rahul", "Frontend Lead"),
                "SPEAKER_3": ("Prachi", "Product Manager / Scrum Master")
            }

            # Upsert speaker documents
            speakers_col.delete_many({"meetingId": meeting_id})
            speaker_map = {}
            for spk in detected_speakers:
                label = spk.get("label", "SPEAKER_1")
                def_name, def_role = default_speaker_names.get(label, (f"Speaker {label[-1]}", spk.get("inferredRole", "Participant")))
                spk_id = str(ObjectId())
                speaker_doc = {
                    "_id": spk_id,
                    "meetingId": meeting_id,
                    "label": label,
                    "name": def_name if auto_name_speakers else label,
                    "role": def_role
                }
                speakers_col.insert_one(speaker_doc)
                speaker_map[label] = speaker_doc

            # Save timestamped transcript segments
            segments_col.delete_many({"meetingId": meeting_id})
            formatted_transcript_lines = []

            for seg in raw_segments:
                seg_id = str(ObjectId())
                seg_label = turn_assignments.get(seg["id"], "SPEAKER_1")
                spk_info = speaker_map.get(seg_label, {})
                spk_name = spk_info.get("name", seg_label)

                seg_doc = {
                    "_id": seg_id,
                    "meetingId": meeting_id,
                    "segmentNumber": seg["id"],
                    "startTime": seg["start"],
                    "endTime": seg["end"],
                    "text": seg["text"],
                    "speakerId": spk_info.get("_id"),
                    "speakerLabel": seg_label,
                    "speakerName": spk_name
                }
                segments_col.insert_one(seg_doc)
                formatted_transcript_lines.append(f"{spk_name}: {seg['text']}")

            full_transcript_text = "\n".join(formatted_transcript_lines)

            # 4. MEETING INTELLIGENCE ANALYSIS
            update_job("GENERATING_ANALYSIS", 85)
            analysis_data = MeetingAnalysisService.analyze_meeting(
                meeting_title=meeting.get("title", "Project Meeting"),
                transcript_text=full_transcript_text
            )

            # Save meeting analysis
            analysis_doc = {
                "meetingId": meeting_id,
                "summary": analysis_data.get("summary", ""),
                "keyPoints": analysis_data.get("keyPoints", []),
                "topics": analysis_data.get("topics", []),
                "decisions": analysis_data.get("decisions", []),
                "finalDecision": analysis_data.get("finalDecision", ""),
                "actionItems": analysis_data.get("actionItems", []),
                "deadlines": analysis_data.get("deadlines", []),
                "questions": analysis_data.get("questions", []),
                "unresolvedIssues": analysis_data.get("unresolvedIssues", []),
                "risks": analysis_data.get("risks", []),
                "updatedAt": datetime.utcnow().isoformat()
            }
            analysis_col.update_one({"meetingId": meeting_id}, {"$set": analysis_doc}, upsert=True)

            # Insert action items into dedicated action_items collection for All Action Items page
            actions_col.delete_many({"meetingId": meeting_id})
            for item in analysis_data.get("actionItems", []):
                action_doc = {
                    "_id": str(ObjectId()),
                    "meetingId": meeting_id,
                    "meetingTitle": meeting.get("title", "Project Meeting"),
                    "userId": meeting.get("userId"),
                    "task": item.get("task"),
                    "assignee": item.get("assignee"),
                    "deadline": item.get("deadline"),
                    "calendarDate": item.get("calendarDate", "2026-10-24"),
                    "isInferred": item.get("isInferred", False),
                    "status": item.get("status", "pending"),
                    "createdAt": datetime.utcnow().isoformat(),
                    "updatedAt": datetime.utcnow().isoformat()
                }
                actions_col.insert_one(action_doc)

            # 5. MARK COMPLETE
            meetings_col.update_one(
                {"_id": meeting_id},
                {
                    "$set": {
                        "status": "completed",
                        "duration": duration,
                        "language": language,
                        "speakerCount": len(detected_speakers),
                        "completedAt": datetime.utcnow().isoformat()
                    }
                }
            )

            jobs_col.update_one(
                {"meetingId": meeting_id},
                {
                    "$set": {
                        "status": "completed",
                        "currentStage": "COMPLETED",
                        "progress": 100,
                        "completedAt": datetime.utcnow().isoformat()
                    }
                }
            )

            # Update User statistics
            if meeting.get("userId"):
                users_col.update_one(
                    {"_id": meeting.get("userId")},
                    {
                        "$inc": {
                            "totalMeetings": 1,
                            "totalMinutesProcessed": int(duration // 60) if duration else 45
                        }
                    }
                )

            logger.info(f"Pipeline successfully completed for meeting {meeting_id}")

        except Exception as e:
            logger.exception(f"Pipeline execution error for meeting {meeting_id}: {e}")
            update_job("FAILED", 100, status="failed", error=str(e))
