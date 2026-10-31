"""
Action Items API Views
Powers the All Action Items page with status toggling, filtering,
assignee tracking, deadline detection, and statistics.
"""

from datetime import datetime

from bson import ObjectId
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from services.storage.mongo import get_collection


def make_json_safe(value):
    """Convert MongoDB values into values that can be returned as JSON."""
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

    return value


class ActionItemListCreateView(APIView):
    """
    GET  /api/actions/ -> List action items, statistics, and filters
    POST /api/actions/ -> Create a new action item
    """

    permission_classes = [AllowAny]

    def get(self, request):
        actions_col = get_collection("action_items")

        query = {}

        status_param = request.query_params.get("status")
        if status_param and status_param.lower() != "all":
            query["status"] = status_param.lower()

        meeting_id = request.query_params.get("meetingId")
        if meeting_id:
            query["meetingId"] = meeting_id

        assignee = request.query_params.get("assignee")
        if assignee:
            query["assignee"] = {
                "$regex": assignee,
                "$options": "i",
            }

        search = request.query_params.get("search")
        if search:
            query["task"] = {
                "$regex": search,
                "$options": "i",
            }

        # Convert the cursor to a list before returning the results.
        items = list(
            actions_col.find(query).sort("createdAt", -1)
        )

        # Calculate statistics across all action items.
        all_items = list(actions_col.find({}))

        total = len(all_items)
        pending = sum(
            1 for item in all_items
            if str(item.get("status", "")).lower() == "pending"
        )
        in_progress = sum(
            1 for item in all_items
            if str(item.get("status", "")).lower()
            in ("in_progress", "in progress")
        )
        completed = sum(
            1 for item in all_items
            if str(item.get("status", "")).lower() == "completed"
        )

        return Response({
            "stats": {
                "total": total,
                "pending": pending,
                "inProgress": in_progress,
                "completed": completed,
            },
            "items": [make_json_safe(item) for item in items],
        })

    def post(self, request):
        data = request.data

        task = str(data.get("task", "")).strip()
        assignee = str(data.get("assignee", "")).strip() or "Unassigned"
        deadline = data.get("deadline", "TBD")
        calendar_date = data.get("calendarDate", "")
        meeting_id = data.get("meetingId", "")
        meeting_title = data.get("meetingTitle", "General Meeting")
        item_status = data.get("status", "pending")

        if not task:
            return Response(
                {"error": "Task title is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if meeting_id and not data.get("meetingTitle"):
            meetings_col = get_collection("meetings")
            meeting = meetings_col.find_one({"_id": meeting_id})

            if meeting:
                meeting_title = meeting.get("title", meeting_title)

        action_id = str(ObjectId())
        now = datetime.utcnow().isoformat()

        action_doc = {
            "_id": action_id,
            "meetingId": meeting_id,
            "meetingTitle": meeting_title,
            "userId": str(getattr(request.user, "id", "demo_user")),
            "task": task,
            "assignee": assignee,
            "deadline": deadline,
            "calendarDate": calendar_date,
            "isInferred": data.get("isInferred", False),
            "status": item_status,
            "createdAt": now,
            "updatedAt": now,
        }

        actions_col = get_collection("action_items")
        actions_col.insert_one(action_doc)

        return Response(
            {
                "message": "Action item created successfully.",
                "item": make_json_safe(action_doc),
            },
            status=status.HTTP_201_CREATED,
        )


class ActionItemDetailView(APIView):
    """
    GET    /api/actions/<id>/ -> Retrieve action item
    PATCH  /api/actions/<id>/ -> Update action item
    DELETE /api/actions/<id>/ -> Delete action item
    """

    permission_classes = [AllowAny]

    def get(self, request, action_id):
        actions_col = get_collection("action_items")
        item = actions_col.find_one({"_id": action_id})

        if not item:
            return Response(
                {"error": "Action item not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(make_json_safe(item))

    def patch(self, request, action_id):
        actions_col = get_collection("action_items")
        item = actions_col.find_one({"_id": action_id})

        if not item:
            return Response(
                {"error": "Action item not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        updates = {"updatedAt": datetime.utcnow().isoformat()}
        allowed_fields = [
            "status",
            "task",
            "assignee",
            "deadline",
            "calendarDate",
            "isInferred",
        ]

        for field in allowed_fields:
            if field in request.data:
                updates[field] = request.data[field]

        actions_col.update_one(
            {"_id": action_id},
            {"$set": updates},
        )

        updated_item = actions_col.find_one({"_id": action_id})

        return Response({
            "message": "Action item updated successfully.",
            "item": make_json_safe(updated_item),
        })

    def delete(self, request, action_id):
        actions_col = get_collection("action_items")
        result = actions_col.delete_one({"_id": action_id})

        if result.deleted_count == 0:
            return Response(
                {"error": "Action item not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            "message": "Action item deleted successfully."
        })