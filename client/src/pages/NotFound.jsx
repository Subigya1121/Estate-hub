import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="container-x py-24 text-center sm:py-32">
      <h1 className="text-3xl font-semibold sm:text-4xl">Page not found</h1>
      <p className="mx-auto mt-3 max-w-md text-ink-500">The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.</p>
      <Link to="/" className="btn-primary mt-8">Go to the homepage</Link>
    </section>
  );
}
