from django.urls import path
from .views  import (meetings_list, meeting_delete, meeting_detail, meeting_reprocess, ai_request)
from .views import admin_stats, today_usage ,meetings_per_day,   monthly_stats, top_users, failure_reasons

urlpatterns = [
    path("meetings/",meetings_list),
    path("meetings/<str:meeting_id>/delete/",meeting_delete),
    path("meetings/<str:meeting_id>/",meeting_detail),
    path("meetings/<str:meeting_id>/reprocess/",meeting_reprocess),
    path("analytics/admin-stats/",admin_stats),
    path("analytics/today-usage/",today_usage),
    path("analytics/meetings-per-day/",meetings_per_day),
    path("analytics/monthly-stats/", monthly_stats),
    path("analytics/top-users/", top_users),
    path("analytics/failure-reasons/", failure_reasons),
    path("analytics/ai-request/", ai_request),

] 