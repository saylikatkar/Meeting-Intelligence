
import api from "./api";

// Get all available subscription plans.
export const getSubscriptionPlans = async () => {
  const response = await api.get("/subscriptions/plans/");
  return response.data;
};

// Get the current user's subscription.
export const getMySubscription = async () => {
  const response = await api.get("/subscriptions/my-subscription/");
  return response.data;
};

// Get the current user's plan limits and features.
export const getMyEntitlements = async () => {
  const response = await api.get("/subscriptions/entitlements/");
  return response.data;
};

// Create a Razorpay subscription.
export const createSubscription = async (plan, quantity = 1) => {
  const response = await api.post("/subscriptions/create/", {
    plan,
    quantity,
  });

  return response.data;
};

// Verify Razorpay Checkout payment.
export const verifySubscriptionPayment = async (paymentData) => {
  const response = await api.post(
    "/subscriptions/verify/",
    paymentData
  );

  return response.data;
};

// Load Razorpay Checkout script.
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");

    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;

    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
};


