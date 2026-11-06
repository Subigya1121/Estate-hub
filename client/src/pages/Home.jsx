import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, MessagesSquare, SlidersHorizontal } from "lucide-react";
import { getCategoryCounts, getFeatured } from "../services/propertyService.js";
import useAsync from "../hooks/useAsync.js";
import { SITE_IMAGES } from "../data/images.js";
import { formatLocation } from "../utils/format.js";
import SearchBar from "../components/SearchBar.jsx";
import PropertyCard from "../components/PropertyCard.jsx";
import PropertyImage from "../components/PropertyImage.jsx";
import AIPropertyConcierge from "../components/AIPropertyConcierge.jsx";

const CATEGORIES = [
  { title: "Homes", to: "/properties?type=house", image: SITE_IMAGES.categories.homes, count: (c) => c.house, span: "lg:col-span-7", shape: "aspect-[4/3] lg:aspect-[16/10]" },
  { title: "Apartments", to: "/properties?type=apartment", image: SITE_IMAGES.categories.apartments, count: (c) => c.apartment, span: "lg:col-span-5", shape: "aspect-[4/3] lg:aspect-auto" },
  { title: "Land", to: "/land", image: SITE_IMAGES.categories.land, count: (c) => c.land, span: "lg:col-span-4", shape: "aspect-[4/3]" },
  { title: "Rentals", to: "/rent", image: SITE_IMAGES.categories.rentals, count: (c) => c.rent, span: "lg:col-span-4", shape: "aspect-[4/3]" },
  { title: "Commercial", to: "/commercial", image: SITE_IMAGES.categories.commercial, count: (c) => c.commercial, span: "lg:col-span-4", shape: "aspect-[4/3]" },
];

const POINTS = [
  { title: "Verified Listings", text: "Every property is reviewed before it is published.", Icon: BadgeCheck },
  { title: "Direct Inquiries", text: "Message the owner or agent without a middleman.", Icon: MessagesSquare },
  { title: "Smart Property Search", text: "Filter by price, location, size and rooms, or just describe what you want.", Icon: SlidersHorizontal },
];

function Hero({ spotlight }) {
  return (
    <section className="pb-6 pt-14 sm:pt-20 lg:pt-24">
      <div className="container-x">
        <div className="animate-fade-in text-center">
          <h1 className="font-display text-[2rem] font-light uppercase leading-[1.2] tracking-[0.1em] text-ink-900 sm:text-5xl sm:tracking-[0.12em] lg:text-6xl">
            Find your place.
            <br />
            Live your way.
          </h1>
          <p className="mx-auto mt-6 max-w-md text-base text-ink-500 sm:text-lg">Exceptional properties, thoughtfully selected.</p>
        </div>

        <div className="mt-12 sm:mt-14">
          <SearchBar />
        </div>

        <div className="mt-12 sm:mt-16">
          <div className="h-[46vh] min-h-[300px] overflow-hidden rounded bg-sand-200 lg:h-[62vh] lg:max-h-[700px]">
            <PropertyImage src={SITE_IMAGES.hero} alt="Contemporary home with a pool at dusk" priority width={2000} />
          </div>
          {spotlight && (
            <p className="mt-3 text-right text-xs text-ink-400">
              Featured:{" "}
              <Link to={`/properties/${spotlight.id}`} className="underline decoration-sand-400 underline-offset-4 hover:text-bronze-600">
                {spotlight.title}, {formatLocation(spotlight)}
              </Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Featured({ items, loading }) {
  const [lead, ...rest] = items;
  return (
    <section className="section" aria-labelledby="featured-heading">
      <div className="container-x">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="featured-heading" className="section-title">Featured Properties</h2>
            <p className="section-lead">Explore a selection of distinctive properties currently available.</p>
          </div>
          <Link to="/properties" className="link-line self-start sm:self-auto">
            View all properties <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        </div>

        {loading ? (
          <div className="mt-14 grid gap-8 lg:grid-cols-12" aria-busy="true"><p className="sr-only">Loading featured properties…</p><div className="aspect-square animate-pulse rounded bg-sand-200 lg:col-span-7" /><div className="aspect-[16/10] animate-pulse rounded bg-sand-200 lg:col-span-5" /></div>
        ) : !lead ? (
          <p className="mt-14 text-ink-500">New properties are added regularly. Check back soon.</p>
        ) : (
          <div className="mt-14 grid gap-x-8 gap-y-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <PropertyCard property={lead} variant="feature" />
            </div>
            <div className="grid gap-12 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
              {rest.map((p) => <PropertyCard key={p.id} property={p} variant="compact" />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Categories({ counts }) {
  return (
    <section className="section border-t border-sand-200" aria-labelledby="types-heading">
      <div className="container-x">
        <h2 id="types-heading" className="section-title">Explore by Property Type</h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-5">
          {CATEGORIES.map((c) => (
            <Link key={c.title} to={c.to} className={`group relative block overflow-hidden rounded bg-sand-200 ${c.span} ${c.shape}`}>
              <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.04]">
                <PropertyImage src={c.image} alt="" width={1200} />
              </div>
              <div className="absolute inset-0 bg-ink-950/30 transition-colors duration-500 group-hover:bg-ink-950/15" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6 text-white">
                <h3 className="font-display text-2xl font-light tracking-wide sm:text-3xl">{c.title}</h3>
                {counts && <span className="text-sm text-white/85">{c.count(counts)} {c.count(counts) === 1 ? "property" : "properties"}</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="section" aria-labelledby="trust-heading">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="aspect-[4/5] overflow-hidden rounded bg-sand-200">
          <PropertyImage src={SITE_IMAGES.trust} alt="Modern villa with large glass windows" width={1400} />
        </div>
        <div>
          <h2 id="trust-heading" className="section-title">Property discovery, made simpler.</h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-500">
            EstateHub helps you discover, compare and inquire about properties across Kathmandu Valley, all in one place and without the noise.
          </p>
          <ul className="mt-12 divide-y divide-sand-300 border-y border-sand-300">
            {POINTS.map(({ title, text, Icon }) => (
              <li key={title} className="flex gap-5 py-6">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-bronze-500" strokeWidth={1.5} />
                <div>
                  <h3 className="font-display text-lg font-normal">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-500">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ListCta() {
  return (
    <section className="bg-ink-900 text-sand-50" aria-labelledby="list-cta-heading">
      <div className="container-x py-20 text-center sm:py-24">
        <h2 id="list-cta-heading" className="font-display text-3xl font-light sm:text-4xl">Have a property to sell or rent?</h2>
        <p className="mx-auto mt-4 max-w-md text-ink-300">Put your property in front of the right people.</p>
        <Link to="/list-property" className="btn mt-9 bg-sand-50 px-8 py-3.5 text-ink-900 hover:bg-white">List Your Property</Link>
      </div>
    </section>
  );
}

export default function Home() {
  const { data: featured, loading } = useAsync(() => getFeatured(3), "featured");
  const { data: counts } = useAsync(() => getCategoryCounts(), "counts");
  return (
    <>
      <Hero spotlight={featured?.[0]} />
      <Featured items={featured || []} loading={loading} />
      <Categories counts={counts} />
      <AIPropertyConcierge />
      <Trust />
      <ListCta />
    </>
  );
}
