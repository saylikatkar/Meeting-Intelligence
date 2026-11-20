
import os
import jwt

from datetime import datetime, timezone
from bson import ObjectId
from rest_framework.decorators import api_view
from rest_framework.response import Response

from db import db


JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("DJANGO_SECRET_KEY")

DEFAULT_SETTINGS = {
    "monthlyLimit": 5,
    "maxMinutes": 60,
    "maxFileSizeMb": 500,
    "retentionDays": 90,
    "transcriptionModel": "whisper-large-v3",
    "summaryModel": "llama-3.3-70b",
    "maintenanceMode": False,
    "emailNotifications": True,
}

ALLOWED_MODELS = {
    "transcriptionModel": ["whisper-large-v3"],
    "summaryModel": ["llama-3.3-70b"],
}

NUMERIC_LIMITS = {
    "monthlyLimit": (1, 1000),
    "maxMinutes": (1, 1440),
    "maxFileSizeMb": (1, 5000),
    "retentionDays": (1, 3650),
}

BOOLEAN_FIELDS = [
    "maintenanceMode",
    "emailNotifications",
]


def get_admin(request):
    if not JWT_SECRET:
        return None, Response(
            {"error": "JWT secret is not configured."},
            status=500
        )

    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return None, Response(
            {"error": "Authentication required."},
            status=401
        )

    token = auth_header.split(" ", 1)[1].strip()

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"]
        )

        user_id = payload.get("sub")

        if not user_id:
            return None, Response(
                {"error": "Invalid authentication token."},
                status=401
            )

        if not ObjectId.is_valid(user_id):
            return None, Response(
                {"error": "Invalid user ID."},
                status=401
            )

        user = db.users.find_one({
            "_id": ObjectId(user_id)
        })

        if not user:
            return None, Response(
                {"error": "User not found."},
                status=404
            )

        if user.get("role") != "admin":
            return None, Response(
                {"error": "Admin access required."},
                status=403
            )

        return user, None

    except jwt.InvalidTokenError:
        return None, Response(
            {"error": "Invalid or expired authentication token."},
            status=401
        )

    except Exception:
        return None, Response(
            {"error": "Authentication failed."},
            status=401
        )


def get_settings_document():
    db.system_settings.update_one(
        {"_id": "global"},
        {"$setOnInsert": DEFAULT_SETTINGS.copy()},
        upsert=True
    )

    document = db.system_settings.find_one({
        "_id": "global"
    })

    settings = DEFAULT_SETTINGS.copy()

    if document:
        for key in DEFAULT_SETTINGS:
            if key in document:
                settings[key] = document[key]

    return settings


@api_view(["GET", "PATCH"])
def profile_settings(request):
    admin, error = get_admin(request)

    if error:
        return error

    if request.method == "GET":
        return Response({
            "name": admin.get("name", ""),
            "email": admin.get("email", ""),
            "role": admin.get("role", "admin")
        })

    name = request.data.get("name")

    if not isinstance(name, str) or len(name.strip()) < 2:
        return Response(
            {"error": "Name must contain at least 2 characters."},
            status=400
        )

    name = name.strip()

    db.users.update_one(
        {"_id": admin["_id"]},
        {
            "$set": {
                "name": name
            }
        }
    )

    return Response({
        "message": "Profile updated successfully.",
        "user": {
            "name": name,
            "email": admin.get("email", ""),
            "role": admin.get("role", "admin")
        }
    })


@api_view(["GET", "PATCH"])
def system_settings(request):
    admin, error = get_admin(request)

    if error:
        return error

    if request.method == "GET":
        return Response(get_settings_document())

    updates = {}

    for key, value in request.data.items():

        if key in NUMERIC_LIMITS:
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                return Response(
                    {"error": f"{key} must be a number."},
                    status=400
                )

            minimum, maximum = NUMERIC_LIMITS[key]

            if not minimum <= value <= maximum or int(value) != value:
                return Response(
                    {
                        "error": f"{key} must be between {minimum} and {maximum}."
                    },
                    status=400
                )

            updates[key] = int(value)

        elif key in ALLOWED_MODELS:
            if value not in ALLOWED_MODELS[key]:
                return Response(
                    {"error": f"Invalid value for {key}."},
                    status=400
                )

            updates[key] = value

        elif key in BOOLEAN_FIELDS:
            if not isinstance(value, bool):
                return Response(
                    {"error": f"{key} must be true or false."},
                    status=400
                )

            updates[key] = value

        else:
            return Response(
                {"error": f"Unknown setting: {key}."},
                status=400
            )

    if not updates:
        return Response(
            {"error": "No valid settings were provided."},
            status=400
        )

    updates["updated_at"] = datetime.now(timezone.utc)
    updates["updated_by"] = admin["_id"]

    db.system_settings.update_one(
        {"_id": "global"},
        {"$set": updates},
        upsert=True
    )

    return Response({
        "message": "Settings saved successfully.",
        "settings": get_settings_document()
    })
