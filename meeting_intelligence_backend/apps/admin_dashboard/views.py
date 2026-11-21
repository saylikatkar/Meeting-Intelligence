
"""
Admin Dashboard API Views (Section 46-53, 67)
Provides Admin Analytics, User Management, Meeting Oversight, Job Queues, and System Audit Logs.
"""

from datetime import datetime, timedelta, timezone as dt_timezone

from django.utils import timezone as django_timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated

from services.storage.mongo import get_collection
from services.groq.usage_service import get_ai_requests_today


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "admin"
        )


def parse_utc_date(value):
    if not value:
        return None

    try:
        if isinstance(value, datetime):
            parsed = value
        else:
            parsed = datetime.fromisoformat(
                str(value).replace("Z", "+00:00")
            )

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt_timezone.utc)

        return parsed.astimezone(dt_timezone.utc).date()

    except (ValueError, TypeError):
        return None


def parse_duration(value):
    try:
        return max(float(value or 0), 0)
    except (ValueError, TypeError):
        return 0


class AdminDashboardStatsView(APIView):
    """
    GET /api/admin/dashboard/ -> Main admin overview.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        users_col = get_collection("users")
        meetings_col = get_collection("meetings")

        users = list(users_col.find({}))
        meetings = list(meetings_col.find({}))

        today = django_timezone.now().date()
        seven_days_ago = today - timedelta(days=6)

        total_users = len(users)
        active_users = sum(
            1 for user in users
            if user.get("status") == "active"
        )

        total_meetings = len(meetings)

        successful = sum(
            1 for meeting in meetings
            if meeting.get("status") == "completed"
        )

        failed = sum(
            1 for meeting in meetings
            if meeting.get("status") == "failed"
        )

        processing = sum(
            1 for meeting in meetings
            if meeting.get("status") in (
                "uploading",
                "processing",
            )
        )

        total_seconds = sum(
            parse_duration(meeting.get("duration"))
            for meeting in meetings
        )

        today_users = [
            user for user in users
            if parse_utc_date(user.get("createdAt")) == today
        ]

        today_meetings = [
            meeting for meeting in meetings
            if parse_utc_date(meeting.get("createdAt")) == today
        ]

        today_successful = sum(
            1 for meeting in today_meetings
            if meeting.get("status") == "completed"
        )

        today_failed = sum(
            1 for meeting in today_meetings
            if meeting.get("status") == "failed"
        )

        today_audio_seconds = sum(
            parse_duration(meeting.get("duration"))
            for meeting in today_meetings
        )

        daily_counts = {}

        for offset in range(7):
            day = seven_days_ago + timedelta(days=offset)
            daily_counts[day.isoformat()] = 0

        for meeting in meetings:
            meeting_date = parse_utc_date(
                meeting.get("createdAt")
            )

            if meeting_date and seven_days_ago <= meeting_date <= today:
                daily_counts[meeting_date.isoformat()] += 1

        meetings_per_day = [
            {
                "date": day,
                "day": datetime.fromisoformat(day).strftime("%a"),
                "count": count,
            }
            for day, count in daily_counts.items()
        ]

        user_names = {
            str(user.get("_id")): (
                user.get("name")
                or user.get("email")
                or "Unknown"
            )
            for user in users
        }

        failed_meetings = []

        for meeting in meetings:
            if meeting.get("status") != "failed":
                continue

            user_id = str(meeting.get("userId") or "")

            failed_meetings.append({
                "id": str(meeting.get("_id") or ""),
                "title": meeting.get("title") or "Untitled meeting",
                "owner": user_names.get(user_id, "Unknown"),
                "stage": meeting.get("failureStage") or "",
                "date": meeting.get("createdAt") or "",
                "error": meeting.get("failureReason") or "",
            })

        failed_meetings.sort(
            key=lambda item: item["date"],
            reverse=True,
        )

        return Response({
            "overview": {
                "totalUsers": total_users,
                "activeUsers": active_users,
                "totalMeetings": total_meetings,
                "successfulTranscriptions": successful,
                "failedTranscriptions": failed,
                "processing": processing,
                "totalAudioProcessedHours": round(
                    total_seconds / 3600, 1
                ),
            },
            "todayUsage": {
                "newUsers": len(today_users),
                "meetings": len(today_meetings),
                "successful": today_successful,
                "failed": today_failed,
                "audioHours": round(
                    today_audio_seconds / 3600, 1
                ),
                "aiRequests": get_ai_requests_today(),
            },
            "meetingsPerDay": meetings_per_day,
            "failedMeetings": failed_meetings,
        })


class AdminUsersView(APIView):
    """
    GET /api/admin/users/ -> User management table (Section 49)
    """
    permission_classes = [AllowAny]

    def get(self, request):
        users_col = get_collection("users")
        users = users_col.find({}, sort=[("createdAt", -1)])

        sanitized = []
        for u in users:
            u_copy = dict(u)
            u_copy.pop("passwordHash", None)
            sanitized.append(u_copy)

        return Response({
            "totalUsers": len(sanitized),
            "users": sanitized
        })


class AdminUserDetailView(APIView):
    """
    PATCH  /api/admin/users/:id/ -> Change status (active/disabled), role (member/manager/admin)
    DELETE /api/admin/users/:id/ -> Delete user account
    """
    permission_classes = [AllowAny]

    def patch(self, request, user_id):
        users_col = get_collection("users")
        user = users_col.find_one({"_id": user_id})
        if not user:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        updates = {}
        if "role" in request.data:
            updates["role"] = request.data["role"]
        if "status" in request.data:
            updates["status"] = request.data["status"]

        if updates:
            users_col.update_one({"_id": user_id}, {"$set": updates})

        updated = users_col.find_one({"_id": user_id})
        updated.pop("passwordHash", None)
        return Response(updated)

    def delete(self, request, user_id):
        users_col = get_collection("users")
        res = users_col.delete_one({"_id": user_id})
        if res.deleted_count == 0:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"message": "User deleted successfully."})


class AdminMeetingsView(APIView):
    """
    GET /api/admin/meetings/ -> Platform-wide meetings list
    """
    permission_classes = [AllowAny]

    def get(self, request):
        meetings_col = get_collection("meetings")
        meetings = meetings_col.find({}, sort=[("createdAt", -1)])
        return Response({
            "totalMeetings": len(meetings),
            "meetings": meetings
        })


class AdminAnalyticsView(APIView):
    """
    GET /api/admin/analytics/ -> Processing, user, and AI stats (Section 47-48)
    """
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "userAnalytics": {
                "totalRegistered": 2481,
                "newToday": 42,
                "newThisWeek": 280,
                "newThisMonth": 950,
                "activeUsers": 1827,
                "disabledUsers": 14
            },
            "processingAnalytics": {
                "totalMeetings": 6492,
                "successful": 6214,
                "failed": 278,
                "processing": 14,
                "averageProcessingTime": "1.8 min",
                "averageMeetingDuration": "38 min"
            },
            "aiAnalytics": {
                "whisperRequests": 6492,
                "groqRequests": 14380,
                "aiSummariesGenerated": 6214,
                "askMeetingQueries": 8940,
                "aiFailures": 18
            }
        })


class AdminJobsView(APIView):
    """
    GET /api/admin/jobs/ -> Processing job queues (Section 52)
    """
    permission_classes = [AllowAny]

    def get(self, request):
        jobs_col = get_collection("processing_jobs")
        jobs = jobs_col.find({}, sort=[("startedAt", -1)])
        return Response({
            "totalJobs": len(jobs),
            "jobs": jobs
        })


class AdminLogsView(APIView):
    """
    GET /api/admin/logs/ -> System audit event logs (Section 53)
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        logs_col = get_collection("system_logs")
        raw_logs = logs_col.find(
            {},
            sort=[("timestamp", -1)],
            limit=100,
        )

        logs = []

        event_messages = {
            "user_registered": "User registered an account",
            "login": "User signed in",
            "failed_login": "Failed sign-in attempt",
            "password_changed": "User changed their password",
        }

        for entry in raw_logs:
            event = entry.get("event", "system_event")

            if event == "failed_login":
                level = "warning"
            else:
                level = "info"

            logs.append({
                "id": str(entry.get("_id", "")),
                "time": entry.get("timestamp", ""),
                "level": level,
                "source": "auth",
                "actor": entry.get("email") or "Unknown",
                "message": event_messages.get(
                    event,
                    event.replace("_", " ").capitalize(),
                ),
            })

        return Response({
            "totalLogs": len(logs),
            "logs": logs,
        })
