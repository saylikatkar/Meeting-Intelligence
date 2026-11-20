
from django.contrib import admin
from django.urls import path, include

from meetings.views import dashboard_summary
from meetings.auth_views import login, logout, register
from meetings.settings_views import profile_settings, system_settings

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/auth/register/", register, name="auth-register"),
    path("api/auth/login/", login, name="auth-login"),
    path("api/auth/logout/", logout, name="auth-logout"),

    path("api/dashboard/", dashboard_summary, name="dashboard"),

    path("api/settings/profile/", profile_settings, name="profile-settings"),
    path("api/settings/system/", system_settings, name="system-settings"),

    path("api/meetings/", include("meetings.urls")),
]
