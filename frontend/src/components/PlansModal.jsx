
import { createPortal } from "react-dom";
import { useState } from "react";
import { useData, useMember } from "../context/DataContext";
import Icon from "./Icon";

import {
  createSubscription,
  verifySubscriptionPayment,
  loadRazorpayScript,
  getMySubscription,
} from "../services/subscriptionApi";

export const planNames = {
  free: "Free",
  pro: "Pro",
  team: "Team",
};

function PlansModal({ onClose }) {
  const { settings } = useData();
  const { account } = useMember();

  const currentPlan = account?.plan || "free";

  const [quantity, setQuantity] = useState(1);
  const [loadingPlan, setLoadingPlan] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const plans = [
    {
      id: "free",
      name: "Free",
      price: 0,
      period: "forever",
      description: "Get started with essential meeting intelligence.",
      features: [
        "Limited monthly meetings",
        "Basic transcription",
        "Meeting summaries",
        "Basic action items",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      price: 499,
      period: "month",
      description: "For individuals who want more from every meeting.",
      features: [
        "More monthly meetings",
        "AI-powered transcription",
        "Detailed meeting summaries",
        "Advanced action items",
        "Meeting insights",
      ],
    },
    {
      id: "team",
      name: "Team",
      price: 1499,
      period: "user/month",
      description: "For teams collaborating across meetings.",
      features: [
        "All Pro features",
        "Team collaboration",
        "Shared meeting workspace",
        "Team member management",
        "Centralized meeting insights",
      ],
    },
  ];

  const handleSubscribe = async (plan) => {
    setError("");
    setSuccess("");

    if (plan === "free") {
      setError("You are already using the Free plan.");
      return;
    }

    try {
      setLoadingPlan(plan);

      // Load Razorpay Checkout
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded) {
        throw new Error(
          "Unable to load Razorpay Checkout. Please check your internet connection."
        );
      }

      // Create subscription on backend
      const subscription = await createSubscription(
        plan,
        plan === "team" ? quantity : 1
      );

      const subscriptionId = subscription.subscriptionId;
      const razorpayKey =
        subscription.razorpayKeyId ||
        subscription.key ||
        subscription.keyId ||
        subscription.key_id;

      if (!subscriptionId || !razorpayKey) {
        throw new Error(
          "Subscription details were not returned by the backend."
        );
      }

      // Razorpay Checkout configuration
      const options = {
        key: razorpayKey,
        subscription_id: subscriptionId,
        name: "Athenura",
        description:
          plan === "pro"
            ? "Athenura Pro Monthly Subscription"
            : "Athenura Team Monthly Subscription",

        prefill: {
          name: account?.name || "",
          email: account?.email || "",
          contact: account?.phone || "",
        },

        theme: {
          color: "#6366f1",
        },

        handler: async function (paymentResponse) {
          try {
            setError("");
            setSuccess("Payment received. Verifying your subscription...");

            // Verify payment signature through backend
            await verifySubscriptionPayment(paymentResponse);

            setSuccess(
              "Payment verification submitted successfully. Your plan will update once Razorpay confirms the subscription."
            );

            // Refresh subscription information
            try {
              await getMySubscription();
            } catch (refreshError) {
              console.error(
                "Subscription refresh failed:",
                refreshError
              );
            }
          } catch (verificationError) {
            console.error(
              "Payment verification error:",
              verificationError
            );

            setSuccess("");
            setError(
              verificationError.response?.data?.error ||
              verificationError.response?.data?.message ||
              "Payment verification failed. Please contact support before attempting another payment."
            );
          } finally {
            setLoadingPlan("");
          }
        },

        modal: {
          ondismiss: function () {
            setLoadingPlan("");
          },
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on("payment.failed", function (response) {
        setLoadingPlan("");
        setError(
          response.error?.description ||
          "Payment failed. Please try again."
        );
      });

      razorpay.open();
    } catch (err) {
      console.error("Subscription error:", err);

      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Unable to start subscription. Please try again."
      );

      setLoadingPlan("");
    }
  };

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Choose your plan
            </h2>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              You are currently on the{" "}
              <span className="font-semibold text-indigo-500">
                {planNames[currentPlan] || "Free"}
              </span>{" "}
              plan.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close plans"
          >
            <Icon name="x" />
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
            {success}
          </div>
        )}

        {/* Plans */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const isLoading = loadingPlan === plan.id;

            const displayedPrice =
              plan.id === "team"
                ? plan.price * quantity
                : plan.price;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  isCurrent
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                }`}
              >
                {isCurrent && (
                  <span className="absolute right-4 top-4 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
                    CURRENT PLAN
                  </span>
                )}

                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {plan.name}
                </h3>

                <p className="mt-2 min-h-12 text-sm text-slate-500 dark:text-slate-400">
                  {plan.description}
                </p>

                <div className="my-5">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">
                    ₹{displayedPrice.toLocaleString("en-IN")}
                  </span>

                  <span className="ml-1 text-sm text-slate-500 dark:text-slate-400">
                    /{plan.period}
                  </span>
                </div>

                {/* Team quantity */}
                {plan.id === "team" && (
                  <div className="mb-5">
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Number of team members
                    </label>

                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={quantity}
                      onChange={(event) => {
                        const value = Number(event.target.value);

                        if (value >= 1 && value <= 100) {
                          setQuantity(value);
                        } else if (event.target.value === "") {
                          setQuantity("");
                        }
                      }}
                      onBlur={() => {
                        if (!quantity || quantity < 1) {
                          setQuantity(1);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      ₹1,499 per member per month.
                    </p>
                  </div>
                )}

                {/* Features */}
                <div className="mb-7 flex-1 space-y-3">
                  {plan.features.map((feature, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      <span className="mt-0.5 text-green-500">
                        <Icon name="check" />
                      </span>

                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Action */}
                <button
                  disabled={
                    isCurrent ||
                    Boolean(loadingPlan) ||
                    (plan.id === "team" &&
                      (!quantity || quantity < 1 || quantity > 100))
                  }
                  onClick={() => handleSubscribe(plan.id)}
                  className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    isCurrent
                      ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  }`}
                >
                  {isLoading
                    ? "Processing..."
                    : isCurrent
                      ? "Current Plan"
                      : plan.id === "free"
                        ? "Free Plan"
                        : `Subscribe to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Payments are processed securely through Razorpay.
          Subscription activation is confirmed by the backend webhook.
        </p>
      </div>
    </div>,
    document.body
  );
}

export default PlansModal;
