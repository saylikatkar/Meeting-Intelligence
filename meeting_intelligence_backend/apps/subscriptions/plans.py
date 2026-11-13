
from django.conf import settings


PLANS = {
    "free": {
        "name": "Free",
        "amount": 0,
        "currency": "INR",
        "interval": "monthly",
        "description": "Free plan",
    },

    "pro": {
        "name": "Pro",
        "amount": 49900,
        "currency": "INR",
        "interval": "monthly",
        "description": "Athenura Pro monthly subscription",
        "razorpay_plan_id": settings.RAZORPAY_PLAN_ID_PRO,
    },

    "team": {
        "name": "Team",
        "amount": 149900,
        "currency": "INR",
        "interval": "monthly",
        "description": "Athenura Team monthly subscription",
        "razorpay_plan_id": settings.RAZORPAY_PLAN_ID_TEAM,
    },
}
