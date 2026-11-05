import { useState } from "react";
import api from "../services/api";
import { primaryButton } from "./ui";

const HAS_API = Boolean(import.meta.env.VITE_API_URL);

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right break-all">{value}</span>
    </div>
  );
}

// Shows how much a plan costs, then sends the member to the payment page.
// The plan only changes after a payment is confirmed, never from this screen.
function PlanCheckout({ plan, account, onBack }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function goToPayment() {
    setError("");
    if (plan.paymentUrl) {
      window.location.href = plan.paymentUrl;
      return;
    }
    if (!HAS_API) {
      setError("Online payment isn't connected yet. You haven't been charged and your plan hasn't changed.");
      return;
    }

    setLoading(true);
    try {
      // expected endpoint: POST /api/payments/checkout/ { plan } returns { checkout_url }, the provider's payment page.
      const { data } = await api.post("/payments/checkout/", { plan: plan.id });
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(err.response?.data?.detail || "Could not open the payment page. You haven't been charged. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-6">
      <div className="border border-gray-200 rounded-lg p-5 space-y-3">
        <SummaryRow label="Plan" value={plan.name} />
        <SummaryRow label="Account" value={account.email} />
        <SummaryRow label="Price" value={`${plan.price}${plan.unit || "/month"}`} />
        <div className="border-t border-gray-200 pt-3 flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-gray-900">Total to pay</span>
          <span className="text-2xl font-extrabold text-gray-900">{plan.price}</span>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-4">
          {error}
        </p>
      )}

      <button type="button" onClick={goToPayment} disabled={loading} className={`${primaryButton} w-full mt-4`}>
        {loading ? "Opening payment..." : "Go to payment"}
      </button>
      <button type="button" onClick={onBack} className="block mx-auto text-sm text-gray-600 hover:text-gray-900 mt-3">
        Back to plans
      </button>
    </div>
  );
}

export default PlanCheckout;
