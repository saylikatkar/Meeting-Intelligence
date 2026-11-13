import hashlib
import hmac
import requests

from django.conf import settings


RAZORPAY_API_URL = "https://api.razorpay.com/v1"


class RazorpayError(Exception):
    pass


def get_razorpay_auth():
    key_id = settings.RAZORPAY_KEY_ID
    key_secret = settings.RAZORPAY_KEY_SECRET

    if not key_id or not key_secret:
        raise RazorpayError("Razorpay API credentials are not configured.")

    return (key_id, key_secret)


def create_razorpay_subscription(plan_id, user_id, quantity=1):
    """
    Create a monthly Razorpay subscription.
    total_count=120 means 120 monthly billing cycles (10 years).
    """

    if not plan_id:
        raise RazorpayError("Razorpay plan ID is missing.")

    if not isinstance(quantity, int) or quantity < 1 or quantity > 100:
        raise RazorpayError("Quantity must be between 1 and 100.")

    payload = {
        "plan_id": plan_id,
        "total_count": 120,
        "quantity": quantity,
        "customer_notify": 1,
        "notes": {
            "user_id": str(user_id),
        },
    }

    try:
        response = requests.post(
            f"{RAZORPAY_API_URL}/subscriptions",
            json=payload,
            auth=get_razorpay_auth(),
            timeout=20,
        )

        response.raise_for_status()
        return response.json()

    except requests.exceptions.HTTPError as exc:
        try:
            error_data = response.json()
            error_message = error_data.get("error", {}).get(
                "description", "Razorpay rejected the request."
            )
        except ValueError:
            error_message = "Razorpay rejected the request."

        raise RazorpayError(error_message) from exc

    except requests.exceptions.RequestException as exc:
        raise RazorpayError(
            "Could not connect to Razorpay. Please try again."
        ) from exc


def verify_subscription_signature(
    payment_id,
    subscription_id,
    received_signature,
):
    """
    Verify the signature returned by Razorpay Checkout.
    """

    secret = settings.RAZORPAY_KEY_SECRET

    if not secret:
        raise RazorpayError("Razorpay secret is not configured.")

    message = f"{payment_id}|{subscription_id}"

    expected_signature = hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(
        expected_signature,
        received_signature,
    )


def verify_webhook_signature(request_body, received_signature):
    """
    Verify the original, unmodified webhook request body.
    """

    secret = settings.RAZORPAY_WEBHOOK_SECRET

    if not secret or not received_signature:
        return False

    expected_signature = hmac.new(
        secret.encode("utf-8"),
        request_body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(
        expected_signature,
        received_signature,
    )


def cancel_razorpay_subscription(subscription_id, cancel_at_cycle_end=True):
    """
    Cancel an existing Razorpay subscription.

    True: Cancel at the end of the current billing cycle.
    False: Cancel immediately.
    """

    if not subscription_id:
        raise RazorpayError("Subscription ID is required.")

    try:
        response = requests.post(
            f"{RAZORPAY_API_URL}/subscriptions/{subscription_id}/cancel",
            json={
                "cancel_at_cycle_end": cancel_at_cycle_end
            },
            auth=get_razorpay_auth(),
            timeout=20,
        )

        response.raise_for_status()
        return response.json()

    except requests.exceptions.HTTPError as exc:
        try:
            error_data = response.json()
            error_message = error_data.get("error", {}).get(
                "description",
                "Unable to cancel Razorpay subscription."
            )
        except ValueError:
            error_message = "Unable to cancel Razorpay subscription."

        raise RazorpayError(error_message) from exc

    except requests.exceptions.RequestException as exc:
        raise RazorpayError(
            "Could not connect to Razorpay."
        ) from exc


def fetch_razorpay_subscription(subscription_id):
    """
    Fetch the latest subscription details from Razorpay.
    """
    if not subscription_id:
        raise RazorpayError("Subscription ID is required.")

    try:
        response = requests.get(
            f"{RAZORPAY_API_URL}/subscriptions/{subscription_id}",
            auth=get_razorpay_auth(),
            timeout=20,
        )

        response.raise_for_status()
        return response.json()

    except requests.exceptions.HTTPError as exc:
        try:
            error_data = response.json()
            error_message = error_data.get("error", {}).get(
                "description",
                "Unable to fetch subscription details."
            )
        except ValueError:
            error_message = "Unable to fetch subscription details."

        raise RazorpayError(error_message) from exc

    except requests.exceptions.RequestException as exc:
        raise RazorpayError(
            "Could not connect to Razorpay."
        ) from exc
