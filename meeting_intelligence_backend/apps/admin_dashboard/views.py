"""
Admin Dashboard API Views (Section 46-53, 67)
Provides Admin Analytics, User Management, Meeting Oversight, Job Queues, and System Audit Logs.
"""

from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from services.storage.mongo import get_collection

class AdminDashboardStatsView(APIView):
    """
    GET /api/admin/dashboard/ -> Main admin overview cards matching Section 46 & 47
    """
    permission_classes = [AllowAny]

    def get(self, request):
        users_col = get_collection("users")
        meetings_col = get_collection("meetings")
        jobs_col = get_collection("processing_jobs")

        total_users = users_col.count_documents({})
        active_users = users_col.count_documents({"status": "active"})

        total_meetings = meetings_col.count_documents({})
        successful = meetings_col.count_documents({"status": "completed"})
        failed = meetings_col.count_documents({"status": "failed"})
        processing = meetings_col.count_documents({"status": "processing"})

        # Calculate total audio processed
        all_meetings = meetings_col.find({})
        total_seconds = sum(m.get("duration", 0) for m in all_meetings)
        total_hours = round(total_seconds / 3600, 1)

        return Response({
            "overview": {
                "totalUsers": total_users,
                "activeUsers": active_users,
                "totalMeetings": total_meetings,
                "successfulTranscriptions": successful,
                "failedTranscriptions": failed,
                "processing": processing,
                "totalAudioProcessedHours": total_hours,
            },
            "todayUsage": {
                "newUsers": "+42",
                "meetings": "+128",
                "successful": 119,
                "failed": 9,
                "audioProcessedHours": 86,
                "aiRequests": "1,420"
            }
        })


class AdminUsersView(APIView):
    """
    GET /api/admin/users/ -> User management table (Section 49)
    """
    permission_classes = [AllowAny]

    def get(self, request):
        users_col = get_collection("users")
        users = users_col.find({}, sort=[("createdAt", -1)])

        # Strip password hashes
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
    permission_classes = [AllowAny]

    def get(self, request):
        logs_col = get_collection("system_logs")
        logs = logs_col.find({}, sort=[("timestamp", -1)], limit=100)
        return Response({
            "totalLogs": len(logs),
            "logs": logs
        })
