from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .entitlements import get_user_entitlements
from .permissions import get_monthly_meeting_count


class MyEntitlementsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_id = str(request.user.id)

        entitlements = get_user_entitlements(user_id)
        meetings_used = get_monthly_meeting_count(user_id)

        return Response({
            "plan": entitlements["plan"],
            "limits": {
                "monthlyMeetings": entitlements["monthly_meetings"],
                "maxDurationMinutes": entitlements["max_duration_minutes"],
                "maxUploadSizeMB": entitlements["max_upload_size_mb"],
            },
            "usage": {
                "meetingsUsed": meetings_used,
            },
            "features": {
                "speakerAnalytics": entitlements["speaker_analytics"],
                "advancedExports": entitlements["advanced_exports"],
                "priorityProcessing": entitlements["priority_processing"],
                "teamWorkspace": entitlements["team_workspace"],
            },
        })