
"""
Meetings API Views
Meeting listing, uploads, details, updates, deletion and processing.
Supports MongoDB and the local JSON fallback storage.
"""

import os
import re
import threading
from datetime import datetime
from pathlib import Path as FilePath

import cloudinary.uploader
from bson import ObjectId
from django.conf import settings

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.subscriptions.permissions import (
    check_meeting_limit,
    check_upload_size,
    check_duration_limit,
)

from services.storage.mongo import get_collection
from services.pipeline.processor import PipelineProcessor


ALLOWED_EXTENSIONS = {
    ".mp4", ".mov", ".mkv", ".webm",
    ".mp3", ".wav", ".m4a", ".aac",
}

VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm"}


# ---------------------------------------------------------
# HELPER FUNCTIONS
# ---------------------------------------------------------

def format_duration(seconds):
    if not seconds:
        return "0 min"

    mins = int(round(float(seconds) / 60))

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
    """Convert MongoDB and Python values into JSON-safe values."""

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


def sort_value(value):
    """Provide a consistent sorting value for dates and strings."""

    if value is None:
        return ""

    if isinstance(value, datetime):
        return value.isoformat()

    return str(value)


def get_sorted_documents(collection_name, query=None,
                         sort_field="createdAt",
                         descending=True, limit=None):
    """
    Fetch documents and sort them in Python.

    This avoids relying on MongoDB cursor chaining, which may not
    be supported by the local JSON fallback.
    """

    collection = get_collection(collection_name)

    documents = list(collection.find(query or {}))

    documents.sort(
        key=lambda item: sort_value(item.get(sort_field)),
        reverse=descending,
    )

    if limit is not None:
        documents = documents[:limit]

    return documents


def is_admin_user(user):
    """Check whether the authenticated user is an administrator."""

    return (
        getattr(user, "role", "") == "admin"
        or getattr(user, "is_staff", False)
        or getattr(user, "is_superuser", False)
    )


def user_can_access_meeting(user, meeting):
    """Allow access only to the meeting owner or an admin."""

    if not meeting:
        return False

    if is_admin_user(user):
        return True

    user_id = str(getattr(user, "id", "") or "")
    meeting_user_id = str(meeting.get("userId", "") or "")

    return bool(user_id and meeting_user_id == user_id)


def get_meeting_or_response(meeting_id, user):
    """Fetch a meeting and verify the current user's permission."""

    meeting = get_collection("meetings").find_one({
        "_id": meeting_id
    })

    if not meeting:
        return None, Response(
            {"error": "Meeting not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not user_can_access_meeting(user, meeting):
        return None, Response(
            {"error": "You do not have permission to access this meeting."},
            status=status.HTTP_403_FORBIDDEN,
        )

    return meeting, None


def cleanup_local_file(file_path):
    """Remove a local uploaded file if it exists."""

    if not file_path:
        return

    try:
        path = FilePath(file_path)

        if path.exists():
            path.unlink()

    except OSError as exc:
        print("Local file cleanup error:", str(exc))


def cleanup_cloudinary(public_id):
    """Remove an uploaded Cloudinary recording."""

    if not public_id:
        return

    try:
        cloudinary.uploader.destroy(
            public_id,
            resource_type="video",
        )

    except Exception as exc:
        print("Cloudinary cleanup error:", str(exc))


# ---------------------------------------------------------
# MEETING LIST AND UPLOAD
# ---------------------------------------------------------

class MeetingListCreateView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_id = str(request.user.id)

        query = {}

        # Members can only access their own meetings.
        if not is_admin_user(request.user):
            query["userId"] = user_id

        status_filter = request.query_params.get("status")

        if status_filter and status_filter.lower() != "all":
            query["status"] = status_filter.lower()

        # Fetch records using simple equality filters.
        # Search and sorting are handled in Python for fallback support.
        all_meetings = get_sorted_documents(
            "meetings",
            query=query,
            sort_field="createdAt",
            descending=True,
        )

        search_query = request.query_params.get("search", "").strip()

        if search_query:
            search_lower = search_query.lower()

            all_meetings = [
                item for item in all_meetings
                if search_lower in str(
                    item.get("title", "")
                ).lower()
            ]

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
            float(item.get("duration", 0) or 0)
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
        user_id = str(request.user.id)

        title = (request.data.get("title") or "").strip()
        uploaded_file = request.FILES.get("file")

        # 1. Validate the uploaded file.

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

        # 2. Check the monthly meeting allowance.

        allowed, error_response = check_meeting_limit(user_id)

        if not allowed:
            return Response(
                error_response,
                status=status.HTTP_403_FORBIDDEN,
            )

        # 3. Check upload size.

        allowed, error_response = check_upload_size(
            user_id,
            uploaded_file.size,
        )

        if not allowed:
            return Response(
                error_response,
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        # 4. Generate a title if necessary.

        if not title:
            title = (
                FilePath(uploaded_file.name)
                .stem.replace("_", " ")
                .replace("-", " ")
                .title()
            )

        file_type = (
            "video"
            if extension in VIDEO_EXTENSIONS
            else "audio"
        )

        meeting_id = str(ObjectId())
        now = datetime.utcnow().isoformat()

        meeting_doc = {
            "_id": meeting_id,
            "userId": user_id,
            "title": title,
            "originalFileName": uploaded_file.name,
            "fileType": file_type,
            "fileSize": uploaded_file.size,
            "duration": 0,
            "language": "English",
            "status": "uploading",
            "speakerCount": 0,
            "createdAt": now,
            "completedAt": None,
            "failureStage": None,
            "failureReason": None,
            "failedAt": None,
        }

        meetings_col = get_collection("meetings")

        try:
            meetings_col.insert_one(meeting_doc)

        except Exception as exc:
            print("Meeting creation error:", str(exc))

            return Response(
                {"error": "Could not create the meeting record."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        def mark_failed(stage, reason):
            failed_at = datetime.utcnow().isoformat()

            meetings_col.update_one(
                {"_id": meeting_id},
                {
                    "$set": {
                        "status": "failed",
                        "failureStage": stage,
                        "failureReason": str(reason),
                        "failedAt": failed_at,
                    }
                },
            )

            get_collection("processing_jobs").update_one(
                {"meetingId": meeting_id},
                {
                    "$set": {
                        "status": "failed",
                        "currentStage": stage.upper(),
                        "error": str(reason),
                        "completedAt": failed_at,
                    }
                },
            )

        # 5. Save a local processing copy.

        media_dir = FilePath(
            getattr(settings, "MEDIA_ROOT", FilePath("media"))
        )

        upload_dir = media_dir / "uploads"
        upload_dir.mkdir(parents=True, exist_ok=True)

        unique_filename = (
            f"{ObjectId()}_{FilePath(uploaded_file.name).name}"
        )

        dest_path = upload_dir / unique_filename

        try:
            with open(dest_path, "wb+") as destination:
                for chunk in uploaded_file.chunks():
                    destination.write(chunk)

        except OSError as exc:
            print("Local file save error:", str(exc))

            reason = "Could not save the uploaded recording."
            mark_failed("upload", reason)

            return Response(
                {"error": reason},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        meetings_col.update_one(
            {"_id": meeting_id},
            {
                "$set": {
                    "filePath": str(dest_path),
                }
            },
        )

        # 6. Upload recording to Cloudinary.

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

            cleanup_local_file(dest_path)

            reason = "Cloudinary upload failed. Check server logs."
            mark_failed("upload", reason)

            return Response(
                {
                    "error": reason,
                    "meetingId": meeting_id,
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        cloudinary_url = cloudinary_result.get("secure_url", "")
        cloudinary_public_id = cloudinary_result.get("public_id", "")

        if not cloudinary_url or not cloudinary_public_id:
            cleanup_cloudinary(cloudinary_public_id)
            cleanup_local_file(dest_path)

            reason = (
                "Cloudinary did not return the recording URL "
                "and public ID."
            )

            mark_failed("upload", reason)

            return Response(
                {
                    "error": reason,
                    "meetingId": meeting_id,
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # 7. Obtain the duration from Cloudinary.

        try:
            duration_value = cloudinary_result.get("duration")

            if duration_value is None:
                raise ValueError(
                    "Cloudinary did not return recording duration."
                )

            duration_seconds = float(duration_value)

            if duration_seconds <= 0:
                raise ValueError("Invalid recording duration.")

        except (TypeError, ValueError) as exc:
            cleanup_cloudinary(cloudinary_public_id)
            cleanup_local_file(dest_path)

            reason = str(exc)
            mark_failed("validation", reason)

            return Response(
                {
                    "error": (
                        "Could not determine the recording duration. "
                        "Please try another recording."
                    ),
                    "meetingId": meeting_id,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 8. Check the duration allowance.

        allowed, error_response = check_duration_limit(
            user_id,
            duration_seconds / 60,
        )

        if not allowed:
            cleanup_cloudinary(cloudinary_public_id)
            cleanup_local_file(dest_path)

            mark_failed(
                "validation",
                error_response.get("error", "Duration limit exceeded."),
            )

            return Response(
                {
                    **error_response,
                    "meetingId": meeting_id,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        duration_seconds = int(round(duration_seconds))

        # 9. Update meeting details.

        meetings_col.update_one(
            {"_id": meeting_id},
            {
                "$set": {
                    "fileUrl": cloudinary_url,
                    "cloudinaryUrl": cloudinary_url,
                    "cloudinaryPublicId": cloudinary_public_id,
                    "duration": duration_seconds,
                    "status": "processing",
                    "failureStage": None,
                    "failureReason": None,
                    "failedAt": None,
                }
            },
        )

        # 10. Create the processing job.

        try:
            get_collection("processing_jobs").insert_one({
                "_id": str(ObjectId()),
                "meetingId": meeting_id,
                "userId": user_id,
                "status": "processing",
                "currentStage": "EXTRACTING_AUDIO",
                "progress": 15,
                "startedAt": datetime.utcnow().isoformat(),
                "completedAt": None,
                "error": None,
            })

        except Exception as exc:
            print("Processing job creation error:", str(exc))

            reason = "Could not create the processing job."
            mark_failed("processing_initialization", reason)

            return Response(
                {
                    "error": reason,
                    "meetingId": meeting_id,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # 11. Start the processing pipeline.

        try:
            thread = threading.Thread(
                target=PipelineProcessor.process_meeting,
                args=(meeting_id, True),
                daemon=True,
            )

            thread.start()

        except Exception as exc:
            print("Processing start error:", str(exc))

            reason = "Could not start the processing pipeline."
            mark_failed("processing_initialization", reason)

            return Response(
                {
                    "error": reason,
                    "meetingId": meeting_id,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        meeting_doc.update({
            "fileUrl": cloudinary_url,
            "cloudinaryUrl": cloudinary_url,
            "cloudinaryPublicId": cloudinary_public_id,
            "filePath": str(dest_path),
            "duration": duration_seconds,
            "status": "processing",
        })

        return Response(
            make_json_safe({
                "message": "Recording uploaded. Processing started.",
                "meeting": meeting_doc,
                "jobId": meeting_id,
            }),
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------
# MEETING DETAILS, UPDATE AND DELETE
# ---------------------------------------------------------

class MeetingDetailView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, meeting_id):
        meeting, error_response = get_meeting_or_response(
            meeting_id,
            request.user,
        )

        if error_response:
            return error_response

        # Fetch related collections without cursor chaining.

        speakers = get_sorted_documents(
            "speakers",
            {"meetingId": meeting_id},
            sort_field="label",
            descending=False,
        )

        analysis = (
            get_collection("meeting_analysis").find_one(
                {"meetingId": meeting_id}
            ) or {}
        )

        segments = get_sorted_documents(
            "transcript_segments",
            {"meetingId": meeting_id},
            sort_field="startTime",
            descending=False,
            limit=100,
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

        # Normalize deadlines.

        raw_deadlines = (
            analysis.get("deadlines")
            or analysis.get("extractedDeadlines")
            or []
        )

        deadlines = []

        for index, item in enumerate(raw_deadlines):

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

        response_data = {
            "id": str(meeting["_id"]),
            "_id": str(meeting["_id"]),
            "userId": meeting.get("userId"),
            "title": meeting.get("title"),
            "fileUrl": meeting.get("fileUrl", ""),
            "cloudinaryUrl": meeting.get("cloudinaryUrl", ""),
            "cloudinaryPublicId": meeting.get(
                "cloudinaryPublicId", ""
            ),
            "originalFileName": meeting.get(
                "originalFileName", ""
            ),
            "fileType": meeting.get("fileType", "video"),
            "fileSize": meeting.get("fileSize", 0),
            "duration": meeting.get("duration", 0),
            "durationFormatted": format_duration(
                meeting.get("duration", 0)
            ),
            "language": meeting.get("language", "English"),
            "status": meeting.get("status", "processing"),
            "speakerCount": meeting.get(
                "speakerCount",
                len(speakers),
            ),
            "createdAt": meeting.get("createdAt"),
            "completedAt": meeting.get("completedAt"),
            "failureStage": meeting.get("failureStage"),
            "failureReason": meeting.get("failureReason"),
            "failedAt": meeting.get("failedAt"),
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
            "unresolvedIssues": analysis.get(
                "unresolvedIssues", []
            ),
            "risks": analysis.get("risks", []),
            "actionItems": action_items,
            "transcriptSegments": segments,
            "job": job,
        }

        return Response(make_json_safe(response_data))

    def patch(self, request, meeting_id):
        meeting, error_response = get_meeting_or_response(
            meeting_id,
            request.user,
        )

        if error_response:
            return error_response

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

        # Never allow the client to modify userId.

        if updates:
            get_collection("meetings").update_one(
                {"_id": meeting_id},
                {"$set": updates},
            )

        updated_meeting = get_collection("meetings").find_one(
            {"_id": meeting_id}
        )

        return Response(make_json_safe(updated_meeting))

    def delete(self, request, meeting_id):
        meeting, error_response = get_meeting_or_response(
            meeting_id,
            request.user,
        )

        if error_response:
            return error_response

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
                print("Cloudinary deletion error:", str(exc))

        # Delete related records.

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

        get_collection("meetings").delete_one(
            {"_id": meeting_id}
        )

        cleanup_local_file(meeting.get("filePath"))

        return Response({
            "message": "Meeting and associated records deleted."
        })


# ---------------------------------------------------------
# RETRY PROCESSING
# ---------------------------------------------------------

class MeetingProcessView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, meeting_id):
        meeting, error_response = get_meeting_or_response(
            meeting_id,
            request.user,
        )

        if error_response:
            return error_response

        get_collection("meetings").update_one(
            {"_id": meeting_id},
            {
                "$set": {
                    "status": "processing",
                    "failureStage": None,
                    "failureReason": None,
                    "failedAt": None,
                }
            },
        )

        try:
            thread = threading.Thread(
                target=PipelineProcessor.process_meeting,
                args=(meeting_id, True),
                daemon=True,
            )

            thread.start()

        except Exception as exc:
            print("Processing retry error:", str(exc))

            return Response(
                {"error": "Could not start processing."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            "message": "Processing pipeline initiated.",
            "meetingId": meeting_id,
        })


# ---------------------------------------------------------
# PROCESSING STATUS
# ---------------------------------------------------------

class MeetingStatusView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, meeting_id):
        meeting, error_response = get_meeting_or_response(
            meeting_id,
            request.user,
        )

        if error_response:
            return error_response

        job = get_collection("processing_jobs").find_one(
            {"meetingId": meeting_id}
        )

        if not job:
            return Response(make_json_safe({
                "meetingId": meeting_id,
                "status": meeting.get("status", "unknown"),
                "failureStage": meeting.get("failureStage"),
                "failureReason": meeting.get("failureReason"),
                "failedAt": meeting.get("failedAt"),
                "currentStage": "UNKNOWN",
                "progress": (
                    100
                    if meeting.get("status") == "completed"
                    else 0
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
            "failureStage": meeting.get("failureStage"),
            "failureReason": meeting.get("failureReason"),
            "failedAt": meeting.get("failedAt"),
        }))
