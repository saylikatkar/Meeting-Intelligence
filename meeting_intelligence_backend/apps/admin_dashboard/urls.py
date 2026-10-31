from django.urls import path
from .views import (
    AdminDashboardStatsView,
    AdminUsersView,
    AdminUserDetailView,
    AdminMeetingsView,
    AdminAnalyticsView,
    AdminJobsView,
    AdminLogsView
)

urlpatterns = [
    path("dashboard/", AdminDashboardStatsView.as_view(), name="admin-dashboard"),
    path("users/", AdminUsersView.as_view(), name="admin-users"),
    path("users/<str:user_id>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("meetings/", AdminMeetingsView.as_view(), name="admin-meetings"),
    path("analytics/", AdminAnalyticsView.as_view(), name="admin-analytics"),
    path("jobs/", AdminJobsView.as_view(), name="admin-jobs"),
    path("logs/", AdminLogsView.as_view(), name="admin-logs"),
]
