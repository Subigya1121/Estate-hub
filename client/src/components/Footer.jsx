import { Link } from "react-router-dom";
import { CONTACT } from "../data/site.js";
import Logo from "./Logo.jsx";

const columns = [
  {
    title: "Explore",
    links: [
      { label: "Buy", to: "/buy" },
      { label: "Rent", to: "/rent" },
      { label: "Land", to: "/land" },
      { label: "Commercial", to: "/commercial" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
    ],
  },
];

const YEAR = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="border-t border-sand-200 bg-sand-100">
      <div className="container-x grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1.4fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-500">Making property discovery simpler.</p>
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="caption">{col.title}</h3>
            <ul className="mt-5 space-y-3 text-sm">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-ink-700 transition-colors hover:text-bronze-600">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div>
          <h3 className="caption">Contact</h3>
          <ul className="mt-5 space-y-3 text-sm text-ink-700">
            <li><a href={`mailto:${CONTACT.email}`} className="transition-colors hover:text-bronze-600">{CONTACT.email}</a></li>
            <li><a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className="transition-colors hover:text-bronze-600">{CONTACT.phone}</a></li>
            <li>{CONTACT.location}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-sand-200">
        <p className="container-x py-6 text-xs text-ink-400">© {YEAR} EstateHub. All rights reserved.</p>
      </div>
    </footer>
  );
}
