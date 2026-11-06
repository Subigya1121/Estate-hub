import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const OFFERINGS = [
  { title: "Buy property", text: "Browse houses, apartments, land and commercial properties for sale, and narrow them down by location, price, size and rooms.", to: "/buy", cta: "Browse properties for sale" },
  { title: "Rent property", text: "Find apartments, houses and commercial spaces to rent by the month.", to: "/rent", cta: "Browse rentals" },
  { title: "Land marketplace", text: "Residential plots priced per aana, with area and road access shown up front.", to: "/land", cta: "Browse land" },
  { title: "List your property", text: "Create an account, add your details and photos, and submit your listing for review.", to: "/list-property", cta: "List a property" },
];

const HOW = [
  { title: "Listings are reviewed", text: "Every submitted listing is checked by a reviewer before it appears publicly. Drafts and listings in review are visible only to their owner." },
  { title: "Inquiries go to the source", text: "Send an inquiry or request a visit from any listing. Your message is saved for the person who listed the property." },
  { title: "You stay in control", text: "Owners can edit, withdraw, archive or mark their listings as sold or rented from their dashboard at any time." },
];

export default function About() {
  return (
    <>
      <section className="border-b border-sand-200">
        <div className="container-x py-16 sm:py-24">
          <h1 className="font-display text-4xl font-light sm:text-5xl">About EstateHub</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-500">
            EstateHub is a property marketplace for Kathmandu Valley. It exists to make finding, comparing and listing property simpler, in one place and without the noise.
          </p>
        </div>
      </section>

      <section className="section" aria-labelledby="does-heading">
        <div className="container-x">
          <h2 id="does-heading" className="section-title">What EstateHub does</h2>
          <ul className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2">
            {OFFERINGS.map((o) => (
              <li key={o.title} className="border-t border-ink-900 pt-6">
                <h3 className="font-display text-2xl font-light">{o.title}</h3>
                <p className="mt-3 max-w-md leading-relaxed text-ink-500">{o.text}</p>
                <Link to={o.to} className="link-line mt-5">{o.cta} <ArrowRight className="h-4 w-4" strokeWidth={1.5} /></Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section border-t border-sand-200 bg-sand-100" aria-labelledby="how-heading">
        <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <h2 id="how-heading" className="section-title">How it works</h2>
          <ul className="divide-y divide-sand-300 border-y border-sand-300">
            {HOW.map((h) => (
              <li key={h.title} className="py-6">
                <h3 className="font-display text-xl font-normal">{h.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-500">{h.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="next-heading">
        <div className="container-x">
          <div className="max-w-3xl">
            <h2 id="next-heading" className="section-title">What's coming</h2>
            <p className="mt-5 leading-relaxed text-ink-500">
              We're planning AI-assisted tools, such as searching in plain language and drafting listing descriptions. They are not available yet, and EstateHub works fully without them.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-ink-900 text-sand-50">
        <div className="container-x py-16 text-center sm:py-20">
          <h2 className="font-display text-3xl font-light sm:text-4xl">Questions about EstateHub?</h2>
          <p className="mx-auto mt-4 max-w-md text-ink-300">Send us a message and we'll get back to you.</p>
          <Link to="/contact" className="btn mt-8 bg-sand-50 px-8 py-3.5 text-ink-900 hover:bg-white">Contact us</Link>
        </div>
      </section>
    </>
  );
}
