from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from services.storage.mongo import get_collection


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")

        if not current_password or not new_password:
            return Response(
                {"error": "Both current and new passwords are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user

        if not user.check_password(current_password):
            return Response(
                {"error": "Your current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"error": "Password must contain at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (
            not any(char.isalpha() for char in new_password)
            or not any(char.isdigit() for char in new_password)
        ):
            return Response(
                {"error": "Password must contain at least one letter and one number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if current_password == new_password:
            return Response(
                {"error": "New password must be different from the current password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()

        update_session_auth_hash(request, user)

        return Response(
            {"message": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )



DEFAULT_SETTINGS = {
    "theme": "light",
    "language": "en",
    "timezone": "Asia/Kolkata",
    "emailNotifications": True,
    "meetingReminders": True,
}


class UserSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get_or_create_settings(self, request):
        collection = get_collection("user_settings")
        uid = str(request.user.pk)
        settings = collection.find_one({"userId": uid})

        if settings is None:
            settings = {
                "_id": uid,
                "userId": uid,
                **DEFAULT_SETTINGS,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
            collection.insert_one(settings)
        else:
            missing = {
                key: value
                for key, value in DEFAULT_SETTINGS.items()
                if key not in settings
            }
            if missing:
                collection.update_one(
                    {"userId": uid},
                    {"$set": missing},
                )
                settings.update(missing)

        return collection, uid, settings

    def get(self, request):
        _, _, settings = self.get_or_create_settings(request)
        settings.pop("_id", None)
        return Response(settings)

    def patch(self, request):
        data = request.data
        allowed = set(DEFAULT_SETTINGS.keys())

        if not data:
            return Response(
                {"error": "Provide at least one setting to update."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        unknown = set(data.keys()) - allowed
        if unknown:
            return Response(
                {"error": "Unsupported settings: " + ", ".join(sorted(unknown))},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "theme" in data and data["theme"] not in ("light", "dark", "system"):
            return Response(
                {"error": "theme must be light, dark, or system."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "language" in data and data["language"] not in ("en", "hi", "mr"):
            return Response(
                {"error": "Unsupported language."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for field in ("emailNotifications", "meetingReminders"):
            if field in data and not isinstance(data[field], bool):
                return Response(
                    {"error": f"{field} must be true or false."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if "timezone" in data:
            value = data["timezone"]
            if not isinstance(value, str) or not value.strip():
                return Response(
                    {"error": "timezone must be a non-empty string."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                ZoneInfo(value)
            except (ZoneInfoNotFoundError, ValueError):
                return Response(
                    {"error": "Invalid timezone."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        collection, uid, _ = self.get_or_create_settings(request)

        updates = dict(data)
        updates["updatedAt"] = datetime.now(timezone.utc).isoformat()

        collection.update_one(
            {"userId": uid},
            {"$set": updates},
        )

        settings = collection.find_one({"userId": uid})
        settings.pop("_id", None)
        return Response(settings)

