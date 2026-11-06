import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// Temporary stand-in for routes that are built in later stages.
export default function ComingSoon({ title }) {
  const { search } = useLocation();
  return (
    <section className="container-x py-24 sm:py-32">
      <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-xl text-ink-500">This page is built in an upcoming stage of the project. The route and navigation already work.</p>
      {search && <p className="mt-2 text-sm text-ink-400">Search filters received: {decodeURIComponent(search.slice(1))}</p>}
      <Link to="/" className="btn-outline mt-8">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>
    </section>
  );
}
