import Icon from "../../components/Icon";
import PublicLayout, { CallToAction, PageHeader } from "../../layouts/PublicLayout";

const principles = [
  {
    icon: "check",
    title: "Built for follow-through",
    text: "A meeting only pays off when the work gets done, so action items have owners, priorities and due dates.",
  },
  {
    icon: "file",
    title: "The transcript stays close",
    text: "Answers lead back to the transcript, so you can check what was actually said in the conversation.",
  },
  {
    icon: "user",
    title: "You stay in control",
    text: "Correct transcript lines, rename speakers, change tasks and export your meeting in the format you need.",
  },
];

function About() {
  return (
    <PublicLayout title="About">
      <PageHeader
        eyebrow="About"
        title="Meetings should lead somewhere"
        text="MeetingIntel helps people remember what was said in a meeting and act on what was agreed."
      />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="text-2xl font-extrabold text-gray-900">Why MeetingIntel</h2>
        <p className="text-base text-gray-600 mt-4">
          Important details are easy to lose after a meeting. Notes are incomplete, recordings take too long to replay, and tasks end up
          scattered or forgotten.
        </p>
        <p className="text-base text-gray-600 mt-4">
          MeetingIntel brings the transcript, summary and action items for each meeting into one workspace. Individuals can use it to keep
          track of their own meetings, and administrators get a portal to manage users and review activity.
        </p>
      </section>

      <section className="bg-white border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-2xl font-extrabold text-gray-900">What we care about</h2>
          <div className="grid md:grid-cols-3 gap-8 mt-8">
            {principles.map((principle) => (
              <article key={principle.title}>
                <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Icon name={principle.icon} className="w-5 h-5" />
                </span>
                <h3 className="text-base font-bold text-gray-900 mt-4">{principle.title}</h3>
                <p className="text-sm text-gray-600 mt-2">{principle.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CallToAction />
    </PublicLayout>
  );
}

export default About;
