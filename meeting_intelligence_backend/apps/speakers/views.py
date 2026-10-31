
import re

from bson import ObjectId
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from services.storage.mongo import get_collection


def serialize_document(document):
    """Convert MongoDB documents into JSON-friendly dictionaries."""
    if not document:
        return None

    result = {}

    for key, value in document.items():
        if isinstance(value, ObjectId):
            result[key] = str(value)
        else:
            result[key] = value

    if "_id" in result:
        result["id"] = str(result["_id"])

    return result


def get_speaker_label(speaker):
    """Return the speaker's original label."""
    return (
        speaker.get("label")
        or speaker.get("speakerLabel")
        or speaker.get("speaker")
        or ""
    )


def get_speaker_name(speaker):
    """Return the assigned speaker name or fall back to the label."""
    return (
        speaker.get("name")
        or speaker.get("speakerName")
        or get_speaker_label(speaker)
    )


def replace_text(text, old_text, new_text):
    """Replace a whole word or phrase without matching partial words."""
    if not isinstance(text, str) or not text:
        return text

    if not old_text or not new_text:
        return text

    if old_text.strip().casefold() == new_text.strip().casefold():
        return text

    pattern = (
        r"(?<!\w)"
        + re.escape(old_text.strip())
        + r"(?!\w)"
    )

    return re.sub(
        pattern,
        lambda match: new_text,
        text,
        flags=re.IGNORECASE,
    )


class MeetingSpeakersView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, meeting_id):
        """Fetch all speakers associated with a meeting."""
        speakers_collection = get_collection("speakers")

        speakers = list(
            speakers_collection.find(
                {"meetingId": meeting_id}
            ).sort("label", 1)
        )

        result = []

        for speaker in speakers:
            item = serialize_document(speaker)

            label = get_speaker_label(speaker)
            name = get_speaker_name(speaker)

            item["label"] = label
            item["speakerLabel"] = label
            item["name"] = name
            item["speakerName"] = name

            result.append(item)

        return Response({
            "meetingId": meeting_id,
            "count": len(result),
            "speakers": result,
        })

    def post(self, request, meeting_id):
        """
        Assign names to speakers and update the saved meeting summary
        and transcript segments.
        """
        assignments = request.data.get("speakers", [])

        if not isinstance(assignments, list) or not assignments:
            return Response(
                {"error": "'speakers' must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        speakers_collection = get_collection("speakers")
        segments_collection = get_collection("transcript_segments")
        analysis_collection = get_collection("meeting_analysis")

        analysis = analysis_collection.find_one({
            "meetingId": meeting_id
        })

        if not analysis:
            return Response(
                {
                    "error": (
                        "Meeting analysis was not found for this meeting ID."
                    ),
                    "meetingId": meeting_id,
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        summary = analysis.get("summary", "")
        saved_assignments = []

        # Validate all assignments before making database changes.
        validated_assignments = []
        seen_labels = set()

        for assignment in assignments:
            if not isinstance(assignment, dict):
                return Response(
                    {"error": "Each assignment must be an object."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            label = str(assignment.get("label", "")).strip()
            name = str(assignment.get("name", "")).strip()

            if not label or not name:
                return Response(
                    {
                        "error": (
                            "Each assignment requires a label and a name."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if label.casefold() in seen_labels:
                return Response(
                    {
                        "error": (
                            f"Duplicate speaker label '{label}' in request."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            seen_labels.add(label.casefold())

            speaker = speakers_collection.find_one({
                "meetingId": meeting_id,
                "$or": [
                    {"label": label},
                    {"speakerLabel": label},
                    {"speaker": label},
                ],
            })

            if not speaker:
                return Response(
                    {
                        "error": f"Speaker '{label}' was not found.",
                        "saved": saved_assignments,
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            validated_assignments.append({
                "label": label,
                "name": name,
                "speaker": speaker,
            })

        # Apply each validated assignment.
        for assignment in validated_assignments:
            label = assignment["label"]
            name = assignment["name"]
            speaker = assignment["speaker"]

            old_name = get_speaker_name(speaker)

            # Update the speaker record.
            speakers_collection.update_one(
                {"_id": speaker["_id"]},
                {
                    "$set": {
                        "name": name,
                        "speakerName": name,
                    }
                },
            )

            # Update transcript segments that use this speaker label.
            segments_collection.update_many(
                {
                    "meetingId": meeting_id,
                    "$or": [
                        {"speakerLabel": label},
                        {"speaker": label},
                        {"label": label},
                    ],
                },
                {
                    "$set": {
                        "speakerName": name,
                        "speakerNameAssigned": True,
                    }
                },
            )

            # Update the saved summary using the previous name and label.
            # This supports summaries containing either "Ayush" or
            # the original label, such as "SPEAKER_1".
            if old_name and old_name != label:
                summary = replace_text(
                    summary,
                    old_name,
                    name,
                )

            summary = replace_text(
                summary,
                label,
                name,
            )

            saved_assignments.append({
                "label": label,
                "name": name,
            })

        # Persist the modified summary in MongoDB.
        analysis_collection.update_one(
            {"_id": analysis["_id"]},
            {
                "$set": {
                    "summary": summary,
                }
            },
        )

        # Read the saved value back to verify the database update.
        updated_analysis = analysis_collection.find_one(
            {"_id": analysis["_id"]},
            {"summary": 1},
        )

        saved_summary = (
            updated_analysis.get("summary", "")
            if updated_analysis
            else summary
        )

        return Response({
            "message": "Speaker names and summary updated successfully.",
            "meetingId": meeting_id,
            "speakers": saved_assignments,
            "summary": saved_summary,
        }, status=status.HTTP_200_OK)


class SpeakerDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, speaker_id):
        """Fetch one speaker by MongoDB ID."""
        if not ObjectId.is_valid(speaker_id):
            return Response(
                {"error": "Invalid speaker ID."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        speaker = get_collection("speakers").find_one({
            "_id": ObjectId(speaker_id)
        })

        if not speaker:
            return Response(
                {"error": "Speaker not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        item = serialize_document(speaker)
        label = get_speaker_label(speaker)
        name = get_speaker_name(speaker)

        item["label"] = label
        item["speakerLabel"] = label
        item["name"] = name
        item["speakerName"] = name

        return Response(item)

    def patch(self, request, speaker_id):
        """Update a speaker's assigned name."""
        if not ObjectId.is_valid(speaker_id):
            return Response(
                {"error": "Invalid speaker ID."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        speakers_collection = get_collection("speakers")

        speaker = speakers_collection.find_one({
            "_id": ObjectId(speaker_id)
        })

        if not speaker:
            return Response(
                {"error": "Speaker not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        name = str(request.data.get("name", "")).strip()

        if not name:
            return Response(
                {"error": "A non-empty name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        speakers_collection.update_one(
            {"_id": speaker["_id"]},
            {
                "$set": {
                    "name": name,
                    "speakerName": name,
                }
            },
        )

        return Response({
            "message": "Speaker name updated successfully.",
            "id": str(speaker["_id"]),
            "label": get_speaker_label(speaker),
            "name": name,
        }, status=status.HTTP_200_OK)
