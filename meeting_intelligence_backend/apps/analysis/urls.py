from django.urls import path
from .views import (
    MeetingAnalysisView,
    MeetingSummarizeView,
    AskMeetingAIView,
    MeetingChatHistoryView
)

urlpatterns = [
    path("<str:meeting_id>/analysis/", MeetingAnalysisView.as_view(), name="meeting-analysis"),
    path("<str:meeting_id>/analyze/", MeetingAnalysisView.as_view(), name="meeting-analyze"),
    path("<str:meeting_id>/summarize/", MeetingSummarizeView.as_view(), name="meeting-summarize"),
    path("<str:meeting_id>/ask/", AskMeetingAIView.as_view(), name="meeting-ask"),
    path("<str:meeting_id>/chat/", MeetingChatHistoryView.as_view(), name="meeting-chat"),
]
