import { useState } from "react";
import { createPortal } from "react-dom";
import { useData, useMember } from "../context/DataContext";
import { getPlans } from "../data/plans";
import PlanCard from "./PlanCard";
import PlanCheckout from "./PlanCheckout";
import { primaryButton } from "./ui";

// plan ids stored on each user; anyone without one is on Free
export const planNames = { free: "Free", pro: "Pro", team: "Team" };

// Plans & usage window. Members can pay for a plan; admins can set any member's plan.
function PlansModal({ onClose }) {
  const { settings } = useData();
  const { account } = useMember();
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const currentPlan = account?.plan || "free";
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);

  // rendered on <body> so the backdrop also covers the sidebar
  return createPortal(
    <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white border border-gray-200 rounded-lg p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-widest text-blue-700">PLANS & USAGE</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-1">
              {checkoutPlan ? `Pay for ${checkoutPlan.name}` : "Choose the plan that fits your team"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              You're on the {planNames[currentPlan]} plan.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 p-1" aria-label="Close">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {checkoutPlan ? (
          <PlanCheckout plan={checkoutPlan} account={account} onBack={() => setCheckoutPlan(null)} />
        ) : (
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {getPlans(settings).map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                current={plan.id === currentPlan}
                selected={plan.id === selectedPlan}
                onSelect={() => setSelectedPlan(plan.id)}
              >
                {plan.id !== "free" && (
                  <button type="button" onClick={() => setCheckoutPlan(plan)} className={`${primaryButton} w-full mt-4`}>
                    Pay {plan.price}
                  </button>
                )}
              </PlanCard>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default PlansModal;
