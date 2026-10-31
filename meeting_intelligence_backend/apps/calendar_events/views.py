import uuid
from datetime import datetime, timezone

from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from services.storage.mongo import get_collection


def current_user_id(request):
    return str(request.user.pk)


def parse_date(value):
    if not isinstance(value, str):
        return None
    result = parse_datetime(value)
    if result is None or result.tzinfo is None:
        return None
    return result


def clean_event(event):
    event = dict(event)
    event["_id"] = str(event["_id"])
    return event


class CalendarEventListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        collection = get_collection("calendar_events")
        events = list(collection.find({"userId": current_user_id(request)}))
        events.sort(key=lambda e: e.get("startAt", ""))
        return Response([clean_event(event) for event in events])

    def post(self, request):
        data = request.data
        title = data.get("title")
        start = parse_date(data.get("startAt"))
        end = parse_date(data.get("endAt"))

        if not isinstance(title, str) or not title.strip():
            return Response(
                {"error": "title is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not start or not end:
            return Response(
                {"error": "startAt and endAt must be ISO timestamps with a timezone."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if end <= start:
            return Response(
                {"error": "endAt must be after startAt."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = datetime.now(timezone.utc).isoformat()
        event = {
            "_id": uuid.uuid4().hex,
            "userId": current_user_id(request),
            "title": title.strip(),
            "description": str(data.get("description", "")),
            "startAt": start.isoformat(),
            "endAt": end.isoformat(),
            "location": str(data.get("location", "")),
            "meetingLink": str(data.get("meetingLink", "")),
            "meetingId": data.get("meetingId"),
            "createdAt": now,
            "updatedAt": now,
        }

        get_collection("calendar_events").insert_one(event)
        return Response(clean_event(event), status=status.HTTP_201_CREATED)


class CalendarEventDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_event(self, request, event_id):
        return get_collection("calendar_events").find_one({
            "_id": event_id,
            "userId": current_user_id(request),
        })

    def get(self, request, event_id):
        event = self.get_event(request, event_id)
        if not event:
            return Response(
                {"error": "Event not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(clean_event(event))

    def patch(self, request, event_id):
        collection = get_collection("calendar_events")
        event = self.get_event(request, event_id)

        if not event:
            return Response(
                {"error": "Event not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        allowed = {
            "title", "description", "startAt", "endAt",
            "location", "meetingLink", "meetingId",
        }
        updates = {
            key: request.data[key]
            for key in allowed
            if key in request.data
        }

        if not updates:
            return Response(
                {"error": "Provide at least one valid field to update."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "title" in updates:
            if not isinstance(updates["title"], str) or not updates["title"].strip():
                return Response(
                    {"error": "title cannot be empty."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updates["title"] = updates["title"].strip()

        for field in ("startAt", "endAt"):
            if field in updates:
                parsed = parse_date(updates[field])
                if not parsed:
                    return Response(
                        {"error": f"{field} must be an ISO timestamp with a timezone."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                updates[field] = parsed.isoformat()

        start = parse_date(updates.get("startAt", event.get("startAt")))
        end = parse_date(updates.get("endAt", event.get("endAt")))

        if not start or not end or end <= start:
            return Response(
                {"error": "endAt must be after startAt."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
        collection.update_one(
            {"_id": event_id, "userId": current_user_id(request)},
            {"$set": updates},
        )
        event.update(updates)
        return Response(clean_event(event))

    def delete(self, request, event_id):
        result = get_collection("calendar_events").delete_one({
            "_id": event_id,
            "userId": current_user_id(request),
        })

        if result.deleted_count == 0:
            return Response(
                {"error": "Event not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)
