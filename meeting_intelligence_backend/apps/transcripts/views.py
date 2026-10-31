from datetime import datetime

from bson import ObjectId
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from services.storage.mongo import get_collection


def make_json_safe(value):
    """Convert MongoDB values into JSON-compatible values."""

    if isinstance(value, ObjectId):
        return str(value)

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, dict):
        result = {}

        for key, item in value.items():
            if key != "_id":
                result[str(key)] = make_json_safe(item)

        if "_id" in value:
            result["id"] = str(value["_id"])
            result["_id"] = str(value["_id"])

        return result

    if isinstance(value, (list, tuple)):
        return [make_json_safe(item) for item in value]

    return value


def format_timestamp(seconds):
    """Convert seconds into HH:MM:SS."""

    try:
        seconds = max(0, int(float(seconds or 0)))
    except (TypeError, ValueError):
        seconds = 0

    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    remaining_seconds = seconds % 60

    return f"{hours:02}:{minutes:02}:{remaining_seconds:02}"


def find_by_id(collection, document_id):
    """Find a MongoDB document using either ObjectId or string ID."""

    if ObjectId.is_valid(document_id):
        document = collection.find_one({"_id": ObjectId(document_id)})

        if document:
            return document

    return collection.find_one({"_id": document_id})


class MeetingTranscriptView(APIView):
    """
    GET /api/meetings/<meeting_id>/transcript/
    Fetch all transcript segments for a meeting.
    """

    permission_classes = [AllowAny]

    def get(self, request, meeting_id):
        segments_collection = get_collection("transcript_segments")

        segments = list(
            segments_collection.find(
                {"meetingId": meeting_id}
            ).sort("startTime", 1)
        )

        results = []

        for segment in segments:
            item = make_json_safe(segment)

            item["formattedStartTime"] = format_timestamp(
                segment.get("startTime", 0)
            )
            item["formattedEndTime"] = format_timestamp(
                segment.get("endTime", 0)
            )

            results.append(item)

        return Response({
            "meetingId": meeting_id,
            "count": len(results),
            "segments": results,
        })


class TranscriptSegmentDetailView(APIView):
    """
    PATCH /api/transcript/<segment_id>/
    Update an individual transcript segment.
    """

    permission_classes = [AllowAny]

    def patch(self, request, segment_id):
        segments_collection = get_collection("transcript_segments")

        segment = find_by_id(segments_collection, segment_id)

        if not segment:
            return Response(
                {"error": "Transcript segment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        allowed_fields = (
            "text",
            "speakerId",
            "speakerName",
            "speakerLabel",
            "startTime",
            "endTime",
        )

        updates = {}

        for field in allowed_fields:
            if field in request.data:
                updates[field] = request.data[field]

        if "text" in updates:
            if not isinstance(updates["text"], str):
                return Response(
                    {"error": "Transcript text must be a string."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        for field in ("startTime", "endTime"):
            if field in updates:
                try:
                    updates[field] = float(updates[field])
                except (TypeError, ValueError):
                    return Response(
                        {"error": f"{field} must be a number."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        if (
            "startTime" in updates or "endTime" in updates
        ):
            start_time = updates.get(
                "startTime", segment.get("startTime", 0)
            )
            end_time = updates.get(
                "endTime", segment.get("endTime", 0)
            )

            if end_time < start_time:
                return Response(
                    {
                        "error": (
                            "End time cannot be earlier than start time."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if updates:
            segments_collection.update_one(
                {"_id": segment["_id"]},
                {"$set": updates},
            )

        updated_segment = segments_collection.find_one(
            {"_id": segment["_id"]}
        )

        result = make_json_safe(updated_segment)

        result["formattedStartTime"] = format_timestamp(
            updated_segment.get("startTime", 0)
        )
        result["formattedEndTime"] = format_timestamp(
            updated_segment.get("endTime", 0)
        )

        return Response({
            "message": "Transcript segment updated successfully.",
            "segment": result,
        })


class TranscriptSearchView(APIView):
    """
    GET /api/meetings/<meeting_id>/transcript/search/?q=keyword
    Search transcript text within a meeting.
    """

    permission_classes = [AllowAny]

    def get(self, request, meeting_id):
        search_query = (request.query_params.get("q") or "").strip()

        if not search_query:
            return Response({
                "meetingId": meeting_id,
                "count": 0,
                "results": [],
            })

        segments_collection = get_collection("transcript_segments")

        segments = list(
            segments_collection.find({
                "meetingId": meeting_id,
                "text": {
                    "$regex": search_query,
                    "$options": "i",
                },
            }).sort("startTime", 1).limit(100)
        )

        results = []

        for segment in segments:
            item = make_json_safe(segment)
            item["formattedStartTime"] = format_timestamp(
                segment.get("startTime", 0)
            )
            results.append(item)

        return Response({
            "meetingId": meeting_id,
            "query": search_query,
            "count": len(results),
            "results": results,
        })