
import logging
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from services.storage.mongo import get_collection
from services.groq.analysis_service import MeetingAnalysisService
from services.groq.ask_service import AskMeetingService

logger = logging.getLogger(__name__)


def serialize_document(document):
    """Convert MongoDB-specific values into JSON-safe values."""
    if isinstance(document, dict):
        return {
            str(key): serialize_document(value)
            for key, value in document.items()
            if key != "_id"
        }

    if isinstance(document, list):
        return [serialize_document(item) for item in document]

    if isinstance(document, ObjectId):
        return str(document)

    if isinstance(document, datetime):
        return document.isoformat()

    return document


class MeetingAnalysisView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, meeting_id):
        analysis = get_collection("meeting_analysis").find_one(
            {"meetingId": meeting_id}
        )

        if not analysis:
            return Response(
                {"error": "No analysis found for this meeting."},
                status=status.HTTP_404_NOT_FOUND,
            )

        result = serialize_document(analysis)
        result["_id"] = str(analysis.get("_id", ""))
        return Response(result)

    def post(self, request, meeting_id):
        meeting = get_collection("meetings").find_one(
            {"_id": meeting_id}
        )

        if not meeting:
            return Response(
                {"error": "Meeting not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        segments = list(
            get_collection("transcript_segments").find(
                {"meetingId": meeting_id},
                sort=[("startTime", 1)],
            )
        )

        if not segments:
            return Response(
                {"error": "No transcript segments found for this meeting."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lines = [
            "{}: {}".format(
                segment.get("speakerName")
                or segment.get("speakerLabel")
                or "Speaker",
                segment.get("text", ""),
            )
            for segment in segments
        ]

        try:
            analysis_data = MeetingAnalysisService.analyze_meeting(
                meeting_title=meeting.get("title", "Project Meeting"),
                transcript_text="\n".join(lines),
            )
        except Exception:
            logger.exception("Meeting analysis failed.")
            return Response(
                {"error": "Meeting analysis failed. Check the server logs."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        analysis_data["meetingId"] = meeting_id
        analysis_data["updatedAt"] = datetime.now(timezone.utc).isoformat()

        get_collection("meeting_analysis").update_one(
            {"meetingId": meeting_id},
            {"$set": analysis_data},
            upsert=True,
        )

        return Response({
            "message": "Meeting intelligence generated successfully.",
            "analysis": serialize_document(analysis_data),
        })


class MeetingSummarizeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, meeting_id):
        analysis = get_collection("meeting_analysis").find_one(
            {"meetingId": meeting_id}
        )

        if not analysis:
            return Response(
                {"error": "Analysis not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            "meetingId": meeting_id,
            "summary": analysis.get("summary", ""),
        })


class AskMeetingAIView(APIView):
    """
    POST /api/meetings/<meeting_id>/ask/
    Ask questions using the Groq LLM and the actual meeting transcript.
    """
    permission_classes = [AllowAny]

    def post(self, request, meeting_id):
        question = request.data.get("question", "")

        if not isinstance(question, str) or not question.strip():
            return Response(
                {"error": "Question is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        question = question.strip()

        meeting = get_collection("meetings").find_one(
            {"_id": meeting_id}
        )

        if not meeting:
            return Response(
                {"error": "Meeting not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Important: materialize the MongoDB cursor into a list.
        transcript_segments = list(
            get_collection("transcript_segments").find(
                {"meetingId": meeting_id},
                sort=[("startTime", 1)],
            )
        )

        if not transcript_segments:
            return Response(
                {"error": "No transcript is available for this meeting."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            answer_data = AskMeetingService.answer_question(
                question=question,
                transcript_segments=transcript_segments,
                meeting_metadata=meeting,
            )
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception(
                "Ask Meeting AI failed for meeting %s", meeting_id
            )
            return Response(
                {
                    "error": (
                        "Ask AI could not generate an answer. "
                        "Check the Groq API key, model access, and server logs."
                    )
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        created_at = datetime.now(timezone.utc).isoformat()
        message_id = str(ObjectId())

        # Avoid storing Django's AnonymousUser object as userId.
        user = request.user
        user_id = (
            str(user.pk)
            if user and user.is_authenticated
            else "demo_user"
        )

        message_doc = {
            "_id": message_id,
            "meetingId": meeting_id,
            "userId": user_id,
            "question": question,
            "answer": answer_data.get("answer", ""),
            "sourceTimestamp": answer_data.get("sourceTimestamp", ""),
            "citedSpeaker": answer_data.get("citedSpeaker", ""),
            "confidence": answer_data.get("confidence", "low"),
            "createdAt": created_at,
        }

        try:
            get_collection("chat_messages").insert_one(message_doc)
        except Exception:
            logger.exception("Failed to save Ask AI chat message.")
            return Response(
                {"error": "The answer was generated but could not be saved."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            "messageId": message_id,
            "meetingId": meeting_id,
            "question": question,
            "answer": message_doc["answer"],
            "sourceTimestamp": message_doc["sourceTimestamp"],
            "citedSpeaker": message_doc["citedSpeaker"],
            "confidence": message_doc["confidence"],
            "createdAt": created_at,
        }, status=status.HTTP_200_OK)


class MeetingChatHistoryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, meeting_id):
        cursor = get_collection("chat_messages").find(
            {"meetingId": meeting_id},
            sort=[("createdAt", 1)],
        )

        # Convert the cursor into a list before counting or returning it.
        documents = list(cursor)
        messages = []

        for document in documents:
            item = serialize_document(document)
            item["_id"] = str(document.get("_id", ""))
            messages.append(item)

        return Response({
            "meetingId": meeting_id,
            "totalMessages": len(messages),
            "messages": messages,
        })
