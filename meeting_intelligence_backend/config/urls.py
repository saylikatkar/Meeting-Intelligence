"""
Main URL Configuration for Meeting Intelligence Platform
Wires all apps, API routes, and static media serving.
"""

from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

from apps.transcripts.views import TranscriptSegmentDetailView
from apps.speakers.views import SpeakerDetailView

def api_health(request):
    return JsonResponse({
        "status": "healthy",
        "service": "AI Meeting Intelligence Platform API",
        "version": "1.0.0",
        "groqConfigured": bool(getattr(settings, "GROQ_API_KEY", "")),
        "mongoConnected": bool(getattr(settings, "MONGO_URI", ""))
    })

urlpatterns = [
    # Health check
    path("", api_health, name="api-root"),
    path("api/health/", api_health, name="api-health"),

    # Authentication
    path("api/auth/", include("apps.authentication.urls")),

    # Dedicated All Actions Page endpoints (/api/actions/)
    path("api/actions/", include("apps.actions.urls")),

    # Direct individual entity updates as per section 66
    path("api/transcript/<str:segment_id>/", TranscriptSegmentDetailView.as_view(), name="transcript-segment-detail"),
    path("api/speakers/<str:speaker_id>/", SpeakerDetailView.as_view(), name="speaker-detail"),

    # Meeting endpoints & nested resources
    # (/api/meetings/, /api/meetings/:id/, /api/meetings/:id/transcript/, /api/meetings/:id/speakers/, etc.)
    path("api/meetings/", include("apps.meetings.urls")),
    path("api/meetings/", include("apps.transcripts.urls")),
    path("api/meetings/", include("apps.speakers.urls")),
    path("api/meetings/", include("apps.analysis.urls")),
    path("api/meetings/", include("apps.exports.urls")),
    path(
    "transcript/<str:segment_id>/",
    TranscriptSegmentDetailView.as_view(),
    name="transcript-segment-detail",
),

    # Admin Dashboard
    path("api/admin/", include("apps.admin_dashboard.urls")),
    
    path("api/calendar/", include("apps.calendar_events.urls")),
    path("api/settings/", include("apps.user_settings.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
