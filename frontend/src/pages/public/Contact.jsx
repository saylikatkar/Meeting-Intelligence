import { companyContact } from "../../data/siteContent";
import PublicLayout, { PageHeader } from "../../layouts/PublicLayout";
import Icon from "../../components/Icon";

function ContactBox({ icon, label, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 flex gap-4">
      <span className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500">{label}</p>
        <div className="text-sm font-medium text-gray-900 mt-1 break-words">{children}</div>
      </div>
    </div>
  );
}

function ContactDetails() {
  const { phone, email, address, hours, socials } = companyContact;
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Contact details</h2>
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <ContactBox icon="phone" label="Phone">
          <a href={phone.href} className="hover:text-blue-700 hover:underline">
            {phone.label}
          </a>
        </ContactBox>
        <ContactBox icon="mail" label="Email">
          <a href={email.href} className="hover:text-blue-700 hover:underline">
            {email.label}
          </a>
        </ContactBox>
        <ContactBox icon="pin" label="Office">
          {address}
        </ContactBox>
        <ContactBox icon="clock" label="Support hours">
          {hours}
        </ContactBox>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 mt-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Follow us</h3>
        <div className="flex gap-2">
          {socials.map((social) => (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noreferrer"
              aria-label={social.name}
              title={social.name}
              className="w-10 h-10 rounded-lg border border-gray-200 text-gray-700 hover:text-blue-700 hover:bg-blue-50 flex items-center justify-center"
            >
              <Icon name={social.icon} className="w-5 h-5" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Contact() {
  return (
    <PublicLayout title="Contact">
      <PageHeader eyebrow="Contact" title="Get in touch" text="Have a question about MeetingIntel? Call or email us." />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <ContactDetails />
      </section>
    </PublicLayout>
  );
}

export default Contact;
