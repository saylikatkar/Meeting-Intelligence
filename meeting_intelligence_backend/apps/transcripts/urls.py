from django.urls import path

from .views import (
    MeetingTranscriptView,
    TranscriptSegmentDetailView,
    TranscriptSearchView,
)

urlpatterns = [
    path(
        "<str:meeting_id>/transcript/",
        MeetingTranscriptView.as_view(),
        name="meeting-transcript",
    ),
    path(
        "<str:meeting_id>/transcript/search/",
        TranscriptSearchView.as_view(),
        name="meeting-transcript-search",
    ),
]