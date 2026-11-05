import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import Icon from "../components/Icon";
import Logo from "../components/Logo";

const publicLinks = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export const ctaPrimary =
  "inline-flex items-center justify-center gap-2 border border-transparent bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded px-5 py-2.5";
export const ctaSecondary =
  "inline-flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-sm font-semibold rounded px-5 py-2.5";

function linkClass({ isActive }) {
  return `text-sm font-medium ${isActive ? "text-blue-700" : "text-gray-600 hover:text-gray-900"}`;
}

// Page intro used at the top of every public page except the home page.
export function PageHeader({ eyebrow, title, text }) {
  return (
    <section className="bg-gray-100 border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-16 text-center">
        <p className="text-xs font-semibold tracking-widest text-blue-700 uppercase">{eyebrow}</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-3">{title}</h1>
        <p className="text-base text-gray-600 mt-4">{text}</p>
      </div>
    </section>
  );
}

// Main actions: public pages look the same to everyone and lead to sign-up.
export function PrimaryActions({ secondary }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Link to="/register" className={ctaPrimary}>
        Get started
        <Icon name="arrow" />
      </Link>
      {secondary && (
        <Link to={secondary.to} className={ctaSecondary}>
          {secondary.label}
        </Link>
      )}
    </div>
  );
}

export function CallToAction({ secondary = { to: "/contact", label: "Contact us" } }) {
  return (
    <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-14">
      <div className="bg-blue-50 rounded-2xl px-6 py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">Make your next meeting count</h2>
          <p className="text-sm text-gray-600 mt-2">Upload a recording and turn the conversation into work you can track.</p>
        </div>
        <div className="shrink-0">
          <PrimaryActions secondary={secondary} />
        </div>
      </div>
    </section>
  );
}

function PublicLayout({ title, children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // each public page mounts its own layout, so this runs on every page change
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = title ? `${title} | MeetingIntel` : "MeetingIntel | AI meeting intelligence";
    return () => {
      document.title = "MeetingIntel";
    };
  }, [title]);

  const accountLinks = (
    <>
      <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900 px-2 py-2.5 text-center">
        Sign in
      </Link>
      <Link to="/register" className={ctaPrimary}>
        Get started
      </Link>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-6">
          <Logo to="/" />

          <nav className="hidden lg:flex items-center gap-7" aria-label="Main">
            {publicLinks.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.to === "/"} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">{accountLinks}</div>

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="public-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="lg:hidden text-gray-700 rounded-md p-2 hover:bg-gray-100"
          >
            <Icon name={menuOpen ? "x" : "menu"} className="w-5 h-5" />
          </button>
        </div>

        {menuOpen && (
          <div id="public-menu" className="lg:hidden border-t border-gray-200 px-4 py-4 bg-white">
            <nav className="flex flex-col gap-4" aria-label="Mobile">
              {publicLinks.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.to === "/"} className={linkClass}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-gray-200">{accountLinks}</div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <div>
            <Logo to="/" />
            <p className="text-sm text-gray-500 mt-3 max-w-xs">Turn meeting recordings into transcripts, summaries and action items.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Footer">
            {publicLinks.map((link) => (
              <Link key={link.to} to={link.to} className="text-sm text-gray-600 hover:text-gray-900">
                {link.label}
              </Link>
            ))}
            <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Sign in
            </Link>
            <Link to="/register" className="text-sm text-gray-600 hover:text-gray-900">
              Create account
            </Link>
          </nav>
        </div>
        <p className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 text-xs text-gray-500">
          © {new Date().getFullYear()} MeetingIntel. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default PublicLayout;
