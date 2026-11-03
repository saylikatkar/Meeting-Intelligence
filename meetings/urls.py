
from django.urls import path
from .auth_views import register, login
from . import views

urlpatterns = [
    path("register/", register, name="register"),
    path("login/", login, name="login"),
    path("", views.meetings_list, name="meetings-list"),
    path("dashboard/", views.dashboard_summary, name="dashboard-summary"),
    path("upload/", views.upload_meeting, name="upload-meeting"),
    path("logs/", views.admin_logs, name="admin-logs"),
    path(
        "<str:meeting_id>/transcript/",
        views.meeting_transcript,
        name="meeting-transcript",
    ),
    
    path(
        "<str:meeting_id>/transcribe/",
        views.transcribe_meeting,
        name="transcribe-meeting",
    ),
    path(
        "<str:meeting_id>/summarize/",
        views.summarize_meeting,
        name="summarize-meeting",
    ),
    path(
        "<str:meeting_id>/summary/",
        views.meeting_summary,
        name="meeting-summary",
    ),
    path("<str:meeting_id>/", views.meeting_detail, name="meeting-detail"),
]
