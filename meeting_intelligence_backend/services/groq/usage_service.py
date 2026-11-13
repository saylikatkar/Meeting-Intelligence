
import logging
from datetime import datetime, timedelta, time as dt_time, timezone as dt_timezone

from django.utils import timezone as django_timezone

from services.storage.mongo import get_collection

logger = logging.getLogger(__name__)


def record_ai_request(service_name):
    try:
        logs = get_collection("ai_request_logs")

        logs.insert_one({
            "service": service_name,
            "createdAt": datetime.now(dt_timezone.utc),
        })

    except Exception:
        logger.exception("Failed to record AI request usage.")


def get_ai_requests_today():
    try:
        logs = get_collection("ai_request_logs")

        now = django_timezone.localtime(django_timezone.now())
        current_timezone = django_timezone.get_current_timezone()

        start_of_day = datetime.combine(
            now.date(),
            dt_time.min
        ).replace(tzinfo=current_timezone)

        start_of_tomorrow = start_of_day + timedelta(days=1)

        return logs.count_documents({
            "createdAt": {
                "$gte": start_of_day.astimezone(dt_timezone.utc),
                "$lt": start_of_tomorrow.astimezone(dt_timezone.utc),
            },
            "service": {"$ne": "test_request"},
        })

    except Exception:
        logger.exception("Failed to fetch today's AI request count.")
        return 0
