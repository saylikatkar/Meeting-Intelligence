import json
from pymongo.errors import DuplicateKeyError
from django.conf import settings
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .entitlements import get_user_entitlements
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from services.storage.mongo import get_collection
from .services import cancel_razorpay_subscription,fetch_razorpay_subscription

from .plans import PLANS
from .services import (
    RazorpayError,
    create_razorpay_subscription,
    verify_subscription_signature,
    verify_webhook_signature,
)


def current_user_id(request):
    return str(request.user.id)


def get_user_plan(user_id):
    users = get_collection("users")
    user = users.find_one({"_id": user_id}) or {}

    plan_key = user.get("plan", "free")
    if plan_key not in PLANS:
        plan_key = "free"

    return plan_key, user


class SubscriptionPlansView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        plan_key, user = get_user_plan(current_user_id(request))

        plans = []
        for key, plan in PLANS.items():
            plans.append({
                "key": key,
                "name": plan["name"],
                "amount": plan["amount"],
                "currency": plan["currency"],
                "interval": plan["interval"],
                "description": plan["description"],
            })

        return Response({
            "plans": plans,
            "currentPlan": plan_key,
            "subscriptionStatus": user.get("subscriptionStatus", "free"),
        })


class CreateSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan_key = request.data.get("plan")

        if plan_key not in ("pro", "team"):
            return Response(
                {"error": "Choose either the Pro or Team plan."},
                status=400,
            )

        plan = PLANS[plan_key]
        plan_id = plan.get("razorpay_plan_id")

        if not plan_id:
            return Response(
                {"error": f"The Razorpay Plan ID for {plan_key} is not configured."},
                status=500,
            )

        quantity = 1
        if plan_key == "team":
            try:
                quantity = int(request.data.get("quantity", 1))
            except (TypeError, ValueError):
                return Response({"error": "Invalid team quantity."}, status=400)

            if quantity < 1 or quantity > 100:
                return Response(
                    {"error": "Team quantity must be between 1 and 100."},
                    status=400,
                )

        user_id = current_user_id(request)

        try:
            razorpay_subscription = create_razorpay_subscription(
                plan_id=plan_id,
                user_id=user_id,
                quantity=quantity,
            )
        except RazorpayError as exc:
            return Response({"error": str(exc)}, status=502)

        subscription_doc = {
            "userId": user_id,
            "plan": plan_key,
            "quantity": quantity,
            "razorpaySubscriptionId": razorpay_subscription["id"],
            "razorpayPlanId": plan_id,
            "status": razorpay_subscription.get("status", "created"),
            "createdAt": timezone.now().isoformat(),
            "updatedAt": timezone.now().isoformat(),
        }

        get_collection("subscriptions").insert_one(subscription_doc)

        return Response({
            "subscriptionId": razorpay_subscription["id"],
            "razorpayKeyId": settings.RAZORPAY_KEY_ID,
            "plan": plan_key,
            "quantity": quantity,
            "status": razorpay_subscription.get("status", "created"),
        }, status=201)


class VerifySubscriptionPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        payment_id = request.data.get("razorpay_payment_id")
        subscription_id = request.data.get("razorpay_subscription_id")
        signature = request.data.get("razorpay_signature")

        if not payment_id or not subscription_id or not signature:
            return Response(
                {"error": "Payment verification details are incomplete."},
                status=400,
            )

        user_id = current_user_id(request)
        subscriptions = get_collection("subscriptions")

        subscription = subscriptions.find_one({
            "razorpaySubscriptionId": subscription_id,
            "userId": user_id,
        })

        if not subscription:
            return Response(
                {"error": "Subscription not found for this user."},
                status=404,
            )

        try:
            valid = verify_subscription_signature(
                payment_id,
                subscription_id,
                signature,
            )
        except RazorpayError as exc:
            return Response({"error": str(exc)}, status=500)

        if not valid:
            return Response(
                {"error": "Invalid Razorpay payment signature."},
                status=400,
            )

        subscriptions.update_one(
            {"razorpaySubscriptionId": subscription_id},
            {"$set": {
                "checkoutPaymentId": payment_id,
                "checkoutVerified": True,
                "updatedAt": timezone.now().isoformat(),
            }},
        )

        # Do not grant paid access here. Wait for a verified
        # subscription.activated or subscription.charged webhook.
        return Response({
            "message": "Checkout signature verified. Waiting for Razorpay subscription activation.",
            "subscriptionStatus": subscription.get("status", "created"),
        })


class MySubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_id = current_user_id(request)
        plan_key, user = get_user_plan(user_id)

        subscription = get_collection("subscriptions").find_one(
            {"userId": user_id},
        )

        return Response({
            "plan": plan_key,
            "subscriptionStatus": user.get("subscriptionStatus", "free"),
            "razorpaySubscriptionId": user.get("razorpaySubscriptionId"),
            "subscription": subscription,
        })

@method_decorator(csrf_exempt, name="dispatch")
class RazorpayWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        raw_body = request.body
        signature = request.headers.get("X-Razorpay-Signature", "")
        event_id = request.headers.get("x-razorpay-event-id")

        # Verify Razorpay signature first.
        if not verify_webhook_signature(raw_body, signature):
            return Response(
                {"error": "Invalid webhook signature."},
                status=400
            )

        if not event_id:
            return Response(
                {"error": "Missing Razorpay event ID."},
                status=400
            )

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return Response(
                {"error": "Invalid JSON payload."},
                status=400
            )

        event = payload.get("event", "")

        # Store each Razorpay event only once.
        processed_events = get_collection("razorpay_webhook_events")
        processed_events.create_index("eventId", unique=True)

        try:
            processed_events.insert_one({
                "eventId": event_id,
                "event": event,
                "status": "processing",
                "createdAt": timezone.now().isoformat(),
            })

        except DuplicateKeyError:
            existing = processed_events.find_one({
                "eventId": event_id
            })

            if existing and existing.get("status") == "processed":
                return Response({
                    "message": "Duplicate event ignored."
                })

            # An earlier attempt may have failed.
            # Continue processing the pending event.

        subscription_entity = (
            payload.get("payload", {})
            .get("subscription", {})
            .get("entity", {})
        )

        subscription_id = subscription_entity.get("id")

        if not subscription_id:
            processed_events.update_one(
                {"eventId": event_id},
                {"$set": {"status": "processed"}}
            )
            return Response({"message": "Event received."})

        subscriptions = get_collection("subscriptions")

        subscription = subscriptions.find_one({
            "razorpaySubscriptionId": subscription_id
        })

        if not subscription:
            # Allow Razorpay to retry if the local record is not found.
            return Response(
                {"error": "Subscription not found."},
                status=500
            )

        status_map = {
            "subscription.activated": "active",
            "subscription.charged": "active",
            "subscription.authenticated": "authenticated",
            "subscription.halted": "halted",
            "subscription.cancelled": "cancelled",
            "subscription.completed": "completed",
            "subscription.paused": "paused",
            "subscription.resumed": "active",
        }

        new_status = status_map.get(event)

        if not new_status:
            processed_events.update_one(
                {"eventId": event_id},
                {"$set": {"status": "processed"}}
            )
            return Response({
                "message": "Event received; no status change required."
            })

        now = timezone.now().isoformat()

        subscriptions.update_one(
            {"razorpaySubscriptionId": subscription_id},
            {"$set": {
                "status": new_status,
                "lastWebhookEvent": event,
                "updatedAt": now,
            }}
        )

        users = get_collection("users")
        user_id = subscription["userId"]

        if new_status == "active":
            users.update_one(
                {"_id": user_id},
                {"$set": {
                    "plan": subscription["plan"],
                    "subscriptionStatus": "active",
                    "razorpaySubscriptionId": subscription_id,
                }}
            )

        elif new_status in (
            "halted", "cancelled", "completed", "paused"
        ):
            users.update_one(
                {
                    "_id": user_id,
                    "razorpaySubscriptionId": subscription_id,
                },
                {"$set": {
                    "plan": "free",
                    "subscriptionStatus": new_status,
                    "razorpaySubscriptionId": None,
                }}
            )

        # Mark event completed only after processing succeeds.
        processed_events.update_one(
            {"eventId": event_id},
            {"$set": {
                "status": "processed",
                "processedAt": timezone.now().isoformat(),
            }}
        )

        return Response({"message": "Webhook processed."})


class MyEntitlementsView(APIView):
    """
    GET /api/subscriptions/entitlements/
    Returns the logged-in user's subscription limits and features.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_id = str(request.user.id)

        entitlements = get_user_entitlements(user_id)

        return Response({
            "plan": entitlements["plan"],
            "limits": {
                "monthlyMeetings": entitlements["monthly_meetings"],
                "maxDurationMinutes": entitlements["max_duration_minutes"],
                "maxUploadSizeMB": entitlements["max_upload_size_mb"],
            },
            "features": {
                "speakerAnalytics": entitlements["speaker_analytics"],
                "advancedExports": entitlements["advanced_exports"],
                "priorityProcessing": entitlements["priority_processing"],
                "teamWorkspace": entitlements["team_workspace"],
            },
        })

class MyEntitlementsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_id = str(request.user.id)
        entitlements = get_user_entitlements(user_id)

        return Response({
            "plan": entitlements["plan"],
            "limits": {
                "monthlyMeetings": entitlements["monthly_meetings"],
                "maxDurationMinutes": entitlements["max_duration_minutes"],
                "maxUploadSizeMB": entitlements["max_upload_size_mb"],
            },
            "features": {
                "speakerAnalytics": entitlements["speaker_analytics"],
                "advancedExports": entitlements["advanced_exports"],
                "priorityProcessing": entitlements["priority_processing"],
                "teamWorkspace": entitlements["team_workspace"],
            },
        })


class CancelSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_id = current_user_id(request)

        cancel_at_cycle_end = request.data.get(
            "cancel_at_cycle_end", True
        )

        if not isinstance(cancel_at_cycle_end, bool):
            return Response(
                {"error": "cancel_at_cycle_end must be true or false."},
                status=400
            )

        users = get_collection("users")
        subscriptions = get_collection("subscriptions")

        user = users.find_one({"_id": user_id})

        if not user:
            return Response(
                {"error": "User not found."},
                status=404
            )

        subscription_id = user.get("razorpaySubscriptionId")

        if not subscription_id:
            return Response(
                {"error": "No active paid subscription found."},
                status=404
            )

        subscription = subscriptions.find_one({
            "razorpaySubscriptionId": subscription_id,
            "userId": user_id,
        })

        if not subscription:
            return Response(
                {"error": "Subscription record not found."},
                status=404
            )

        if subscription.get("status") not in (
            "active", "authenticated"
        ):
            return Response(
                {"error": "This subscription cannot be cancelled in its current state."},
                status=400
            )

        try:
            result = cancel_razorpay_subscription(
                subscription_id,
                cancel_at_cycle_end
            )
        except RazorpayError as exc:
            return Response({"error": str(exc)}, status=502)

        now = timezone.now().isoformat()
        razorpay_status = result.get("status", subscription.get("status"))

        subscriptions.update_one(
            {"razorpaySubscriptionId": subscription_id},
            {"$set": {
                "status": razorpay_status,
                "cancelAtCycleEnd": cancel_at_cycle_end,
                "cancellationRequestedAt": now,
                "updatedAt": now,
            }}
        )

        # Only downgrade immediately if Razorpay confirms
        # immediate cancellation.
        if not cancel_at_cycle_end and razorpay_status == "cancelled":
            users.update_one(
                {
                    "_id": user_id,
                    "razorpaySubscriptionId": subscription_id,
                },
                {"$set": {
                    "plan": "free",
                    "subscriptionStatus": "cancelled",
                    "razorpaySubscriptionId": None,
                }}
            )

        return Response({
            "message": (
                "Subscription cancellation scheduled for the end of the billing cycle."
                if cancel_at_cycle_end
                else "Subscription cancellation requested."
            ),
            "subscriptionStatus": razorpay_status,
            "cancelAtCycleEnd": cancel_at_cycle_end,
        })


class RefreshSubscriptionView(APIView):
    """
    Refresh the logged-in user's subscription status from Razorpay.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_id = current_user_id(request)

        users = get_collection("users")
        subscriptions = get_collection("subscriptions")

        user = users.find_one({"_id": user_id})

        if not user:
            return Response(
                {"error": "User not found."},
                status=404
            )

        subscription_id = user.get("razorpaySubscriptionId")

        if not subscription_id:
            return Response({
                "plan": "free",
                "subscriptionStatus": user.get(
                    "subscriptionStatus", "free"
                ),
                "message": "No active paid subscription."
            })

        subscription = subscriptions.find_one({
            "razorpaySubscriptionId": subscription_id,
            "userId": user_id,
        })

        if not subscription:
            return Response(
                {"error": "Subscription record not found."},
                status=404
            )

        try:
            razorpay_data = fetch_razorpay_subscription(
                subscription_id
            )
        except RazorpayError as exc:
            return Response({"error": str(exc)}, status=502)

        status_value = razorpay_data.get(
            "status",
            subscription.get("status", "created")
        )

        now = timezone.now().isoformat()

        subscriptions.update_one(
            {"razorpaySubscriptionId": subscription_id},
            {"$set": {
                "status": status_value,
                "currentStart": razorpay_data.get("current_start"),
                "currentEnd": razorpay_data.get("current_end"),
                "endedAt": razorpay_data.get("ended_at"),
                "updatedAt": now,
            }}
        )

        if status_value == "active":
            users.update_one(
                {
                    "_id": user_id,
                    "razorpaySubscriptionId": subscription_id,
                },
                {"$set": {
                    "plan": subscription["plan"],
                    "subscriptionStatus": "active",
                }}
            )

        elif status_value in (
            "cancelled", "completed", "halted", "expired"
        ):
            users.update_one(
                {
                    "_id": user_id,
                    "razorpaySubscriptionId": subscription_id,
                },
                {"$set": {
                    "plan": "free",
                    "subscriptionStatus": status_value,
                    "razorpaySubscriptionId": None,
                }}
            )

        return Response({
            "plan": (
                "free"
                if status_value in (
                    "cancelled", "completed", "halted", "expired"
                )
                else subscription["plan"]
            ),
            "subscriptionStatus": status_value,
            "currentEnd": razorpay_data.get("current_end"),
            "message": "Subscription status refreshed."
        })

