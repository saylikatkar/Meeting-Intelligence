import { Link } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { getPlans } from "../../data/plans";
import PlanCard from "../../components/PlanCard";
import PublicLayout, { CallToAction, PageHeader, ctaPrimary } from "../../layouts/PublicLayout";

function Pricing() {
  const { settings } = useData();

  return (
    <PublicLayout title="Pricing">
      <PageHeader
        eyebrow="Pricing"
        title="Choose the plan that fits your team"
        text="Start free today and compare what each plan includes."
      />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid md:grid-cols-3 gap-5 items-start">
          {getPlans(settings).map((plan) => (
            <PlanCard key={plan.id} plan={plan}>
              <Link to="/register" className={`${ctaPrimary} w-full mt-4`}>
                Get started
              </Link>
            </PlanCard>
          ))}
        </div>
      </section>

      <CallToAction secondary={{ to: "/features", label: "See all features" }} />
    </PublicLayout>
  );
}

export default Pricing;
