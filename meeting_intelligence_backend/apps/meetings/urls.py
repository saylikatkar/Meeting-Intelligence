
from django.urls import path

from .views import (
    MeetingListCreateView,
    MeetingDetailView,
    MeetingProcessView,
    MeetingStatusView,
)

from apps.speakers.views import (
    MeetingSpeakersView,
    SpeakerDetailView,
)

from apps.analysis.views import (
    MeetingAnalysisView,
    MeetingSummarizeView,
    AskMeetingAIView,
    MeetingChatHistoryView,
)

urlpatterns = [
    path("", MeetingListCreateView.as_view(), name="meeting-list-create"),

    # Speaker routes must appear before the generic meeting detail route.
    path(
        "<str:meeting_id>/speakers/assign/",
        MeetingSpeakersView.as_view(),
        name="meeting-speaker-assign",
    ),
    path(
        "<str:meeting_id>/speakers/",
        MeetingSpeakersView.as_view(),
        name="meeting-speakers",
    ),
    path(
        "speakers/<str:speaker_id>/",
        SpeakerDetailView.as_view(),
        name="speaker-detail",
    ),

    path(
        "<str:meeting_id>/process/",
        MeetingProcessView.as_view(),
        name="meeting-process",
    ),
    path(
        "<str:meeting_id>/status/",
        MeetingStatusView.as_view(),
        name="meeting-status",
    ),
    path(
        "<str:meeting_id>/analysis/",
        MeetingAnalysisView.as_view(),
        name="meeting-analysis",
    ),
    path(
        "<str:meeting_id>/analyze/",
        MeetingAnalysisView.as_view(),
        name="meeting-analyze",
    ),
    path(
        "<str:meeting_id>/summarize/",
        MeetingSummarizeView.as_view(),
        name="meeting-summarize",
    ),
    path(
        "<str:meeting_id>/ask/",
        AskMeetingAIView.as_view(),
        name="meeting-ask-ai",
    ),
    path(
        "<str:meeting_id>/chat/",
        MeetingChatHistoryView.as_view(),
        name="meeting-chat-history",
    ),
    path(
        "<str:meeting_id>/",
        MeetingDetailView.as_view(),
        name="meeting-detail",
    ),
]
