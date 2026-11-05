import Icon from "../../components/Icon";
import PublicLayout, { CallToAction, PageHeader } from "../../layouts/PublicLayout";
import { features } from "../../data/siteContent";

function Features() {
  return (
    <PublicLayout title="Features">
      <PageHeader
        eyebrow="Features"
        title="From recording to follow-through"
        text="MeetingIntel keeps your transcripts, summaries and tasks together, so nothing agreed in a meeting gets lost."
      />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid sm:grid-cols-2 gap-5">
          {features.map((feature) => (
            <article key={feature.title} className="bg-white border border-gray-200 rounded-lg p-6 flex gap-4">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Icon name={feature.icon} className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-gray-900">{feature.title}</h2>
                <p className="text-sm text-gray-600 mt-2">{feature.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <CallToAction secondary={{ to: "/how-it-works", label: "See how it works" }} />
    </PublicLayout>
  );
}

export default Features;
