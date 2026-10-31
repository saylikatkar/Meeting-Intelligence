from django.urls import path

from .views import MeetingSpeakersView, SpeakerDetailView

urlpatterns = [
    path(
        "<str:meeting_id>/speakers/",
        MeetingSpeakersView.as_view(),
        name="meeting-speakers",
    ),
    path(
        "<str:meeting_id>/speakers/assign/",
        MeetingSpeakersView.as_view(),
        name="meeting-speakers-assign",
    ),
    path(
        "speaker/<str:speaker_id>/",
        SpeakerDetailView.as_view(),
        name="speaker-detail",
    ),
]