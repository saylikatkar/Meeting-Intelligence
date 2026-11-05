import Icon from "../../components/Icon";
import PublicLayout, { CallToAction, PageHeader } from "../../layouts/PublicLayout";
import { steps } from "../../data/siteContent";
import { processingStages } from "../../utils/meetingContent";

function HowItWorks() {
  return (
    <PublicLayout title="How it works">
      <PageHeader
        eyebrow="How it works"
        title="Four steps from recording to results"
        text="Upload a meeting once, then use the output to review what was said and follow up on what was agreed."
      />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <ol className="space-y-5">
          {steps.map((step, i) => (
            <li key={step.title} className="bg-white border border-gray-200 rounded-lg p-6 flex gap-4">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Icon name={step.icon} className="w-5 h-5" />
              </span>
              <div>
                <p className="text-xs font-bold text-blue-700">Step {i + 1}</p>
                <h2 className="text-lg font-bold text-gray-900 mt-1">{step.title}</h2>
                <p className="text-sm text-gray-600 mt-2">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          <h2 className="text-xl font-bold text-gray-900">What happens during processing</h2>
          <p className="text-sm text-gray-600 mt-2">Each meeting shows its current stage, and you can retry one if processing fails.</p>
          <ol className="flex flex-wrap gap-2 mt-4">
            {processingStages.map((stage, i) => (
              <li key={stage} className="text-sm font-medium text-gray-700 bg-gray-100 rounded-full px-3 py-1.5">
                {i + 1}. {stage}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CallToAction />
    </PublicLayout>
  );
}

export default HowItWorks;
