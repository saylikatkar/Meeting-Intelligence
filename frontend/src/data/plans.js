// Plan details shown in the dashboard plans window and on the public pricing page.
// Free plan limits come from the admin settings.
export function getPlans(settings) {
  return [
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
      paymentUrl: import.meta.env.VITE_PAYMENT_URL_PRO,
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
      paymentUrl: import.meta.env.VITE_PAYMENT_URL_TEAM,
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
  ];
}
