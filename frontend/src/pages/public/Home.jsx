import { Link } from "react-router-dom";
import Icon from "../../components/Icon";
import PublicLayout, { CallToAction, PrimaryActions } from "../../layouts/PublicLayout";
import { features, steps } from "../../data/siteContent";

const previewTasks = [
  { task: "Finish the final review and share notes", owner: "Speaker 2", priority: "High" },
  { task: "Get budget approval for the next phase", owner: "Speaker 1", priority: "Medium" },
];

// Illustration of a processed meeting, labelled as an example.
function MeetingPreview() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-5 sm:p-6 text-left">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <Icon name="mic" className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">Project kickoff</p>
            <p className="text-xs text-gray-500">34 min · 4 speakers</p>
          </div>
        </div>
        <span className="text-xs font-medium text-gray-500 border border-gray-200 rounded-full px-2.5 py-1">Example</span>
      </div>

      <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase mt-5">Summary</p>
      <p className="text-sm text-gray-600 mt-1.5">
        The team kept the current scope and agreed to finish the final review by Thursday. The budget for the next phase is still open.
      </p>

      <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase mt-5">Action items</p>
      <ul className="mt-2 space-y-2">
        {previewTasks.map((item) => (
          <li key={item.task} className="flex items-start gap-3 border border-gray-200 rounded-xl p-3">
            <span className="text-blue-700 mt-0.5">
              <Icon name="list" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{item.task}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.owner} · {item.priority} priority
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Home() {
  return (
    <PublicLayout>
      <section className="bg-gray-100 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-semibold tracking-widest text-blue-700 uppercase">AI meeting intelligence</p>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mt-4 leading-tight">
              Turn every meeting into clear next steps
            </h1>
            <p className="text-lg text-gray-600 mt-5 max-w-xl">
              Upload a recording and get a searchable transcript, a short summary and action items your team can track to completion.
            </p>
            <div className="mt-8">
              <PrimaryActions secondary={{ to: "/how-it-works", label: "See how it works" }} />
            </div>
          </div>
          <MeetingPreview />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold text-gray-900">Everything after the meeting, in one place</h2>
          <p className="text-base text-gray-600 mt-3">Go from recording to follow-up without digging through notes or replaying audio.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          {features.slice(0, 6).map((feature) => (
            <article key={feature.title} className="bg-white border border-gray-200 rounded-lg p-6">
              <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Icon name={feature.icon} className="w-5 h-5" />
              </span>
              <h3 className="text-base font-bold text-gray-900 mt-4">{feature.title}</h3>
              <p className="text-sm text-gray-600 mt-2">{feature.text}</p>
            </article>
          ))}
        </div>
        <Link to="/features" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800 mt-6">
          See all features
          <Icon name="arrow" />
        </Link>
      </section>

      <section className="bg-white border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <h2 className="text-3xl font-extrabold text-gray-900">How it works</h2>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-8">
            {steps.map((step, i) => (
              <li key={step.title}>
                <span className="text-sm font-bold text-blue-700">Step {i + 1}</span>
                <h3 className="text-base font-bold text-gray-900 mt-2">{step.title}</h3>
                <p className="text-sm text-gray-600 mt-2">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CallToAction />
    </PublicLayout>
  );
}

export default Home;
