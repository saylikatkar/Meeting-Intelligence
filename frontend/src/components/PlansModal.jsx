import { createPortal } from "react-dom";
import { useData, useMember } from "../context/DataContext";
import Icon from "./Icon";

// plan ids stored on each user; anyone without one is on Free
export const planNames = { free: "Free", pro: "Pro", team: "Team" };

// Plans & usage window. Admins set each member's plan; Pro and Team are marked "coming soon".
function PlansModal({ onClose }) {
  const { settings } = useData();
  const { account } = useMember();
  const currentPlan = account?.plan || "free";

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "₹0",
      tagline: "Perfect for individuals getting started",
      features: [
        [true, `Up to ${settings.monthlyLimit} meetings per month`],
        [true, `${settings.maxMinutes}-minute max per recording`],
        [true, "Executive summary"],
        [true, "Interactive transcript"],
        [true, "Action item detection"],
        [true, "TXT & PDF export"],
        [false, "Advanced exports (DOCX, CSV, SRT)"],
        [false, "Speaker analytics"],
        [false, "Priority processing"],
        [false, "Team workspace"],
      ],
    },
    {
      id: "pro",
      name: "Pro",
      price: "₹499",
      comingSoon: true,
      tagline: "For power users who need more",
      features: [
        [true, "Unlimited meetings"],
        [true, "Up to 3-hour recordings"],
        [true, "Full executive summary & decisions"],
        [true, "Interactive transcript + inline edit"],
        [true, "Automated action items & board"],
        [true, "All export formats"],
        [true, "Speaker participation analytics"],
        [true, "Meeting comparison"],
        [true, "Priority processing"],
        [false, "Team workspace & admin panel"],
      ],
    },
    {
      id: "team",
      name: "Team",
      price: "₹1,499",
      unit: "/user/month",
      comingSoon: true,
      tagline: "Built for entire teams",
      features: [
        [true, "Everything in Pro"],
        [true, "Shared team meeting library"],
        [true, "Role-based access (Member / Admin)"],
        [true, "Team analytics dashboard"],
        [true, "Central action item tracking"],
        [true, "SSO / enterprise sign-in"],
        [true, "Dedicated support"],
        [true, "Custom data retention"],
      ],
    },
  ].map((plan) => ({ ...plan, current: plan.id === currentPlan, comingSoon: plan.comingSoon && plan.id !== currentPlan }));

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
            <h2 className="text-2xl font-semibold text-gray-900 mt-1">Choose the plan that fits your team</h2>
            <p className="text-sm text-gray-500 mt-1">
              You're on the {planNames[currentPlan]} plan.{currentPlan === "free" && " Pro and Team are coming soon."}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 p-1" aria-label="Close">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-5 ${plan.current ? "border-blue-700 ring-1 ring-blue-700" : "border-gray-200"}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                {plan.current && (
                  <span className="text-[11px] font-bold tracking-wide bg-green-50 text-green-700 rounded-full px-2.5 py-0.5">
                    CURRENT
                  </span>
                )}
                {plan.comingSoon && (
                  <span className="text-[11px] font-bold tracking-wide bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5">
                    COMING SOON
                  </span>
                )}
              </div>

              <p className="mt-3 text-gray-900">
                <span className="text-3xl font-extrabold">{plan.price}</span>
                <span className="text-sm text-gray-500">{plan.unit || "/month"}</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">{plan.tagline}</p>

              <ul className="mt-5 pt-5 border-t border-gray-200 space-y-2.5">
                {plan.features.map(([included, text]) => (
                  <li key={text} className={`flex gap-2.5 text-sm ${included ? "text-gray-700" : "text-gray-400"}`}>
                    {included ? (
                      <Icon name="check" className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    )}
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default PlansModal;
