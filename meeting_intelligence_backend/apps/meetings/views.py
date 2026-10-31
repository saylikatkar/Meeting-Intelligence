
"""
Meetings API Views
Implements meeting list, upload/create, retrieve detail, update,
delete, processing trigger, and processing status.
"""

import os
import threading
from datetime import datetime
from pathlib import Path as FilePath

import cloudinary.uploader
from bson import ObjectId
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from services.storage.mongo import get_collection
from services.pipeline.processor import PipelineProcessor


ALLOWED_EXTENSIONS = {
    ".mp4", ".mov", ".mkv", ".webm",
    ".mp3", ".wav", ".m4a", ".aac",
}

VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm"}


def format_duration(seconds):
    if not seconds:
        return "0 min"

    mins = int(round(seconds / 60))

    if mins < 60:
        return f"{mins} min"

    hours = mins // 60
    remaining_mins = mins % 60

    return (
        f"{hours}h {remaining_mins}m"
        if remaining_mins
        else f"{hours}h"
    )


def make_json_safe(value):
    """Convert MongoDB and Python values into JSON-serializable values."""
    if isinstance(value, ObjectId):
        return str(value)

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, dict):
        return {
            str(key): make_json_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [make_json_safe(item) for item in value]

    if value.__class__.__name__ == "Cursor":
        return [make_json_safe(item) for item in value]

    return value


class MeetingListCreateView(APIView):
    """
    GET  /api/meetings/ -> list meetings and dashboard statistics.
    POST /api/meetings/ -> upload recording to Cloudinary and create meeting.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        user_id = getattr(request.user, "id", None)
        query = {}

        if user_id:
            if getattr(request.user, "role", "member") != "admin":
                query["userId"] = user_id

        status_filter = request.query_params.get("status")

        if status_filter and status_filter.lower() != "all":
            query["status"] = status_filter.lower()

        search_query = request.query_params.get("search")

        if search_query:
            # Escape user-supplied regex characters.
            import re
            query["title"] = {
                "$regex": re.escape(search_query),
                "$options": "i",
            }

        meetings_col = get_collection("meetings")
        all_meetings = list(
            meetings_col.find(query).sort("createdAt", -1)
        )

        total = len(all_meetings)
        completed = sum(
            1 for item in all_meetings
            if item.get("status") == "completed"
        )
        processing = sum(
            1 for item in all_meetings
            if item.get("status") == "processing"
        )
        failed = sum(
            1 for item in all_meetings
            if item.get("status") == "failed"
        )

        total_duration = sum(
            item.get("duration", 0) or 0
            for item in all_meetings
        )

        for item in all_meetings:
            item["durationFormatted"] = format_duration(
                item.get("duration", 0)
            )

        response_data = {
            "stats": {
                "totalMeetings": total,
                "minutesProcessed": int(total_duration // 60),
                "completed": completed,
                "processing": processing,
                "failed": failed,
            },
            "meetings": all_meetings,
        }

        return Response(make_json_safe(response_data))

    def post(self, request):
        user_id = getattr(request.user, "id", None) or "demo_user"
        title = (request.data.get("title") or "").strip()
        uploaded_file = request.FILES.get("file")

        if not uploaded_file:
            return Response(
                {"error": "Please select a meeting recording."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        extension = FilePath(uploaded_file.name).suffix.lower()

        if extension not in ALLOWED_EXTENSIONS:
            return Response(
                {
                    "error": (
                        f"Unsupported file format: {extension}. "
                        "Supported formats: "
                        + ", ".join(sorted(ALLOWED_EXTENSIONS))
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_mb = getattr(settings, "MAX_UPLOAD_SIZE_MB", 200)

        if uploaded_file.size > max_mb * 1024 * 1024:
            return Response(
                {"error": f"File size exceeds the {max_mb}MB limit."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not title:
            title = (
                FilePath(uploaded_file.name)
                .stem.replace("_", " ")
                .replace("-", " ")
                .title()
            )

        file_type = (
            "video" if extension in VIDEO_EXTENSIONS else "audio"
        )

        media_dir = FilePath(
            getattr(settings, "MEDIA_ROOT", FilePath("media"))
        )
        upload_dir = media_dir / "uploads"
        upload_dir.mkdir(parents=True, exist_ok=True)

        unique_filename = (
            f"{ObjectId()}_{FilePath(uploaded_file.name).name}"
        )
        dest_path = upload_dir / unique_filename

        # Save a local copy for the existing processing pipeline.
        try:
            with open(dest_path, "wb+") as destination:
                for chunk in uploaded_file.chunks():
                    destination.write(chunk)

        except OSError as exc:
            print("Local file save error:", str(exc))

            return Response(
                {"error": "Could not save the uploaded recording locally."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Upload the recording to Cloudinary.
        # Cloudinary uses resource_type="video" for both video and audio.
        try:
            cloudinary_result = cloudinary.uploader.upload_large(
                str(dest_path),
                resource_type="video",
                folder="meeting-intelligence/recordings",
                use_filename=False,
                unique_filename=True,
            )

        except Exception as exc:
            print("Cloudinary upload error:", str(exc))

            try:
                dest_path.unlink(missing_ok=True)
            except OSError:
                pass

            return Response(
                {
                    "error": (
                        "Cloudinary upload failed. Check your Cloudinary "
                        "credentials and server logs, then try again."
                    )
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        cloudinary_url = cloudinary_result.get("secure_url", "")
        cloudinary_public_id = cloudinary_result.get("public_id", "")

        if not cloudinary_url or not cloudinary_public_id:
            try:
                dest_path.unlink(missing_ok=True)
            except OSError:
                pass

            return Response(
                {"error": "Cloudinary did not return the recording URL and public ID."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # The browser sends duration in seconds when available.
        try:
            duration_seconds = max(
                0,
                int(float(request.data.get("duration", 0))),
            )
        except (TypeError, ValueError):
            duration_seconds = 0

        meeting_id = str(ObjectId())
        now = datetime.utcnow().isoformat()

        meeting_doc = {
            "_id": meeting_id,
            "userId": user_id,
            "title": title,

            # Cloudinary storage metadata
            "fileUrl": cloudinary_url,
            "cloudinaryUrl": cloudinary_url,
            "cloudinaryPublicId": cloudinary_public_id,

            # Local copy for the current processing pipeline
            "filePath": str(dest_path),

            "originalFileName": uploaded_file.name,
            "fileType": file_type,
            "fileSize": uploaded_file.size,
            "duration": duration_seconds,
            "language": "English",
            "status": "processing",
            "speakerCount": 0,
            "createdAt": now,
            "completedAt": None,
        }

        try:
            get_collection("meetings").insert_one(meeting_doc)

            get_collection("processing_jobs").insert_one({
                "_id": str(ObjectId()),
                "meetingId": meeting_id,
                "userId": user_id,
                "status": "processing",
                "currentStage": "EXTRACTING_AUDIO",
                "progress": 15,
                "startedAt": now,
                "completedAt": None,
                "error": None,
            })

        except Exception as exc:
            print("MongoDB save error:", str(exc))

            try:
                cloudinary.uploader.destroy(
                    cloudinary_public_id,
                    resource_type="video",
                )
            except Exception as cleanup_error:
                print("Cloudinary cleanup error:", str(cleanup_error))

            try:
                dest_path.unlink(missing_ok=True)
            except OSError:
                pass

            return Response(
                {
                    "error": (
                        "The recording was uploaded, but its meeting "
                        "record could not be saved."
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            thread = threading.Thread(
                target=PipelineProcessor.process_meeting,
                args=(meeting_id, True),
                daemon=True,
            )
            thread.start()

        except Exception as exc:
            print("Processing start error:", str(exc))

            get_collection("meetings").update_one(
                {"_id": meeting_id},
                {"$set": {"status": "failed"}},
            )

            get_collection("processing_jobs").update_one(
                {"meetingId": meeting_id},
                {
                    "$set": {
                        "status": "failed",
                        "error": "Could not start processing.",
                    }
                },
            )

            return Response(
                make_json_safe({
                    "message": (
                        "Recording stored successfully, but processing "
                        "could not be started."
                    ),
                    "meeting": meeting_doc,
                    "jobId": meeting_id,
                }),
                status=status.HTTP_201_CREATED,
            )

        return Response(
            make_json_safe({
                "message": (
                    "Recording uploaded to Cloudinary. Processing started."
                ),
                "meeting": meeting_doc,
                "jobId": meeting_id,
            }),
            status=status.HTTP_201_CREATED,
        )


class MeetingDetailView(APIView):
    """
    GET    /api/meetings/<meeting_id>/ -> meeting details.
    PATCH  /api/meetings/<meeting_id>/ -> update meeting metadata.
    DELETE /api/meetings/<meeting_id>/ -> delete meeting and related records.
    """

    permission_classes = [AllowAny]


    def get(self, request, meeting_id):
        meetings_col = get_collection("meetings")
        meeting = meetings_col.find_one({"_id": meeting_id})

        if not meeting:
            return Response(
                {"error": "Meeting not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        speakers = list(
            get_collection("speakers")
            .find({"meetingId": meeting_id})
            .sort("label", 1)
        )

        analysis = (
            get_collection("meeting_analysis").find_one(
                {"meetingId": meeting_id}
            ) or {}
        )

        segments = list(
            get_collection("transcript_segments")
            .find({"meetingId": meeting_id})
            .sort("startTime", 1)
            .limit(100)
        )

        job = get_collection("processing_jobs").find_one(
            {"meetingId": meeting_id}
        )

        action_items = list(
            get_collection("action_items").find(
                {"meetingId": meeting_id}
            )
        )

        if not action_items:
            action_items = analysis.get("actionItems", [])

        # Support common field names used by different analysis outputs.
        raw_deadlines = (
            analysis.get("deadlines")
            or analysis.get("extractedDeadlines")
            or []
        )

        deadlines = []

        for index, item in enumerate(raw_deadlines):
            # Handle either structured deadline objects or plain text.
            if isinstance(item, str):
                deadlines.append({
                    "id": str(index),
                    "text": item,
                    "title": item,
                    "dueDate": None,
                    "assignedTo": None,
                    "source": None,
                })
                continue

            if not isinstance(item, dict):
                continue

            deadlines.append({
                "id": str(item.get("_id", item.get("id", index))),
                "text": (
                    item.get("text")
                    or item.get("description")
                    or item.get("task")
                    or item.get("title")
                    or "Deadline identified"
                ),
                "title": (
                    item.get("title")
                    or item.get("task")
                    or item.get("description")
                    or item.get("text")
                    or "Deadline identified"
                ),
                "dueDate": (
                    item.get("dueDate")
                    or item.get("due_date")
                    or item.get("deadline")
                    or item.get("date")
                ),
                "assignedTo": (
                    item.get("assignedTo")
                    or item.get("assigned_to")
                    or item.get("assignee")
                    or item.get("owner")
                ),
                "source": (
                    item.get("source")
                    or item.get("transcript")
                    or item.get("sourceText")
                ),
            })

        # Convert action-item records to a list of JSON-safe dictionaries.
        response_data = {
            "id": str(meeting["_id"]),
            "_id": str(meeting["_id"]),
            "userId": meeting.get("userId"),
            "title": meeting.get("title"),
            "fileUrl": meeting.get("fileUrl", ""),
            "cloudinaryUrl": meeting.get("cloudinaryUrl", ""),
            "cloudinaryPublicId": meeting.get("cloudinaryPublicId", ""),
            "originalFileName": meeting.get("originalFileName", ""),
            "fileType": meeting.get("fileType", "video"),
            "fileSize": meeting.get("fileSize", 0),
            "duration": meeting.get("duration", 0),
            "durationFormatted": format_duration(
                meeting.get("duration", 0)
            ),
            "language": meeting.get("language", "English"),
            "status": meeting.get("status", "processing"),
            "speakerCount": meeting.get(
                "speakerCount", len(speakers)
            ),
            "createdAt": meeting.get("createdAt"),
            "completedAt": meeting.get("completedAt"),
            "speakers": speakers,
            "summary": analysis.get("summary", ""),
            "keyPoints": analysis.get("keyPoints", []),
            "topics": analysis.get("topics", []),
            "decisions": analysis.get("decisions", []),
            "finalDecision": analysis.get(
                "finalDecision",
                "No definitive final decision was identified.",
            ),
            "deadlines": deadlines,
            "questions": analysis.get("questions", []),
            "unresolvedIssues": analysis.get("unresolvedIssues", []),
            "risks": analysis.get("risks", []),
            "actionItems": action_items,
            "transcriptSegments": segments,
            "job": job,
        }

        return Response(make_json_safe(response_data))


    def patch(self, request, meeting_id):
        meetings_col = get_collection("meetings")
        meeting = meetings_col.find_one({"_id": meeting_id})

        if not meeting:
            return Response(
                {"error": "Meeting not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        updates = {}

        if "title" in request.data:
            new_title = str(request.data["title"]).strip()

            if not new_title:
                return Response(
                    {"error": "Meeting title cannot be empty."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            updates["title"] = new_title

        if "language" in request.data:
            updates["language"] = request.data["language"]

        if "userId" in request.data:
            updates["userId"] = request.data["userId"]

        if updates:
            meetings_col.update_one(
                {"_id": meeting_id},
                {"$set": updates},
            )

        updated_meeting = meetings_col.find_one(
            {"_id": meeting_id}
        )

        return Response(make_json_safe(updated_meeting))

    def delete(self, request, meeting_id):
        meetings_col = get_collection("meetings")
        meeting = meetings_col.find_one({"_id": meeting_id})

        if not meeting:
            return Response(
                {"error": "Meeting not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Attempt to remove the Cloudinary asset.
        cloudinary_public_id = meeting.get("cloudinaryPublicId")

        if cloudinary_public_id:
            try:
                result = cloudinary.uploader.destroy(
                    cloudinary_public_id,
                    resource_type="video",
                )

                if result.get("result") not in ("ok", "not found"):
                    print("Cloudinary deletion result:", result)

            except Exception as exc:
                # Continue deleting database records, but log the failure.
                print("Cloudinary deletion error:", str(exc))

        related_collections = (
            "transcript_segments",
            "speakers",
            "meeting_analysis",
            "action_items",
            "chat_messages",
            "processing_jobs",
        )

        for collection_name in related_collections:
            get_collection(collection_name).delete_many(
                {"meetingId": meeting_id}
            )

        meetings_col.delete_one({"_id": meeting_id})

        # Remove the local processing copy if it exists.
        file_path = meeting.get("filePath")

        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError as exc:
                print("Local file deletion error:", str(exc))

        return Response({
            "message": (
                "Meeting and associated records deleted. "
                "Cloudinary cleanup was attempted."
            )
        })


class MeetingProcessView(APIView):
    """POST /api/meetings/<meeting_id>/process/ -> start/retry processing."""

    permission_classes = [AllowAny]

    def post(self, request, meeting_id):
        meeting = get_collection("meetings").find_one(
            {"_id": meeting_id}
        )

        if not meeting:
            return Response(
                {"error": "Meeting not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        thread = threading.Thread(
            target=PipelineProcessor.process_meeting,
            args=(meeting_id, True),
            daemon=True,
        )
        thread.start()

        return Response({
            "message": "Processing pipeline initiated.",
            "meetingId": meeting_id,
        })


class MeetingStatusView(APIView):
    """GET /api/meetings/<meeting_id>/status/ -> processing status."""

    permission_classes = [AllowAny]

    def get(self, request, meeting_id):
        job = get_collection("processing_jobs").find_one(
            {"meetingId": meeting_id}
        )

        if not job:
            meeting = get_collection("meetings").find_one(
                {"_id": meeting_id}
            )

            if not meeting:
                return Response(
                    {"error": "Meeting not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            return Response(make_json_safe({
                "meetingId": meeting_id,
                "status": meeting.get("status", "unknown"),
                "currentStage": "UNKNOWN",
                "progress": (
                    100 if meeting.get("status") == "completed" else 0
                ),
            }))

        return Response(make_json_safe({
            "meetingId": meeting_id,
            "status": job.get("status"),
            "currentStage": job.get("currentStage"),
            "progress": job.get("progress", 0),
            "startedAt": job.get("startedAt"),
            "completedAt": job.get("completedAt"),
            "error": job.get("error"),
        }))
