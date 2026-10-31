from django.urls import path
from .views import (
    CalendarEventListCreateView,
    CalendarEventDetailView,
)

urlpatterns = [
    path("", CalendarEventListCreateView.as_view(), name="calendar-events"),
    path("<str:event_id>/", CalendarEventDetailView.as_view(), name="calendar-event-detail"),
]
