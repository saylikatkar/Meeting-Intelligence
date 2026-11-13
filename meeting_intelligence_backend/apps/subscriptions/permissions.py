
from datetime import datetime, timezone

from services.storage.mongo import get_collection
from .entitlements import get_user_entitlements


def get_monthly_meeting_count(user_id):
    """
    Count successfully uploaded meetings created during the current month.

    Failed uploads with duration 0 are not counted.
    Meetings that fail during processing are still counted if their
    recordings were successfully uploaded and validated.
    """

    meetings = get_collection("meetings")
    user_meetings = meetings.find({"userId": str(user_id)})

    now = datetime.now(timezone.utc)

    month_start = now.replace(
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    count = 0

    for meeting in user_meetings:

        # Ignore recordings that did not pass upload validation.
        duration = meeting.get("duration", 0)

        try:
            if float(duration) <= 0:
                continue
        except (TypeError, ValueError):
            continue

        created_at = meeting.get("createdAt")

        if not created_at:
            continue

        try:
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(
                    created_at.replace("Z", "+00:00")
                )

            if created_at.tzinfo is None:
                created_at = created_at.replace(
                    tzinfo=timezone.utc
                )

            if month_start <= created_at < now:
                count += 1

        except (ValueError, TypeError):
            continue

    return count


def check_meeting_limit(user_id):
    """Check whether the user can upload another meeting."""

    entitlements = get_user_entitlements(user_id)
    limit = entitlements["monthly_meetings"]

    # None means unlimited meetings.
    if limit is None:
        return True, None

    used = get_monthly_meeting_count(user_id)

    if used >= limit:
        return False, {
            "error": "Monthly meeting limit reached.",
            "plan": entitlements["plan"],
            "monthlyLimit": limit,
            "meetingsUsed": used,
            "upgradeRequired": True,
        }

    return True, None


def check_duration_limit(user_id, duration_minutes):
    """Check whether the recording duration is within the plan limit."""

    entitlements = get_user_entitlements(user_id)
    limit = entitlements["max_duration_minutes"]

    if limit is None:
        return True, None

    if duration_minutes > limit:
        return False, {
            "error": "Recording duration exceeds your plan limit.",
            "plan": entitlements["plan"],
            "maximumDurationMinutes": limit,
            "uploadedDurationMinutes": duration_minutes,
            "upgradeRequired": True,
        }

    return True, None


def check_upload_size(user_id, file_size_bytes):
    """Check whether the uploaded file size is within the plan limit."""

    entitlements = get_user_entitlements(user_id)
    limit_mb = entitlements["max_upload_size_mb"]

    if limit_mb is None:
        return True, None

    uploaded_mb = file_size_bytes / (1024 * 1024)

    if uploaded_mb > limit_mb:
        return False, {
            "error": "Uploaded file exceeds your plan's maximum file size.",
            "plan": entitlements["plan"],
            "maximumUploadSizeMB": limit_mb,
            "uploadedSizeMB": round(uploaded_mb, 2),
            "upgradeRequired": True,
        }

    return True, None
