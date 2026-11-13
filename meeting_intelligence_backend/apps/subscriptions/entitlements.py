
from django.conf import settings

from services.storage.mongo import get_collection


# Central configuration for all subscription plans.
# None means there is no limit.

PLAN_ENTITLEMENTS = {
    "free": {
        "monthly_meetings": getattr(
            settings, "FREE_MEMBER_MONTHLY_MEETINGS", 5
        ),
        "max_duration_minutes": getattr(
            settings, "FREE_MEMBER_MAX_DURATION_MINUTES", 60
        ),
        "max_upload_size_mb": getattr(
            settings, "MAX_UPLOAD_SIZE_MB", 100
        ),
        "speaker_analytics": False,
        "advanced_exports": False,
        "priority_processing": False,
        "team_workspace": False,
    },

    "pro": {
        "monthly_meetings": None,
        "max_duration_minutes": 180,
        "max_upload_size_mb": 200,
        "speaker_analytics": True,
        "advanced_exports": True,
        "priority_processing": True,
        "team_workspace": False,
    },

    "team": {
        "monthly_meetings": None,
        "max_duration_minutes": 180,
        "max_upload_size_mb": 200,
        "speaker_analytics": True,
        "advanced_exports": True,
        "priority_processing": True,
        "team_workspace": True,
    },
}


def get_user_entitlements(user_id):
    """
    Return the effective plan and permissions for a user.

    Paid access is granted only when the subscription status is active.
    Otherwise, the user receives Free-plan entitlements.
    """

    users = get_collection("users")

    user = users.find_one({"_id": str(user_id)})

    if not user:
        return {
            "plan": "free",
            **PLAN_ENTITLEMENTS["free"],
        }

    requested_plan = str(user.get("plan", "free")).lower()
    subscription_status = str(
        user.get("subscriptionStatus", "free")
    ).lower()

    # Do not grant paid features for pending, cancelled,
    # halted, expired, or otherwise inactive subscriptions.
    if (
        requested_plan not in ("pro", "team")
        or subscription_status != "active"
    ):
        requested_plan = "free"

    return {
        "plan": requested_plan,
        **PLAN_ENTITLEMENTS[requested_plan],
    }


def has_feature(user_id, feature_name):
    """
    Check whether a user has access to a particular feature.
    """

    entitlements = get_user_entitlements(user_id)

    return bool(entitlements.get(feature_name, False))
