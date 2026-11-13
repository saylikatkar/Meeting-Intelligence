
from django.urls import path

from .views import (
    SubscriptionPlansView,
    CreateSubscriptionView,
    VerifySubscriptionPaymentView,
    MySubscriptionView,
    RazorpayWebhookView,
    MyEntitlementsView,
    CancelSubscriptionView,
    RefreshSubscriptionView,
)


urlpatterns = [
    path("plans/", SubscriptionPlansView.as_view(), name="subscription-plans"),
    path("create/", CreateSubscriptionView.as_view(), name="subscription-create"),
    path("verify/", VerifySubscriptionPaymentView.as_view(), name="subscription-verify"),
    path("my-subscription/", MySubscriptionView.as_view(), name="my-subscription"),
    path("webhook/", RazorpayWebhookView.as_view(), name="razorpay-webhook"),
    path("entitlements/", MyEntitlementsView.as_view(), name="my-entitlements"),
    path("cancel/",CancelSubscriptionView.as_view(),name="subscription-cancel"),
    path("refresh/",RefreshSubscriptionView.as_view(),name="subscription-refresh"),
]
