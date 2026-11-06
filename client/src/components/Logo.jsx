import { Link } from "react-router-dom";

export default function Logo() {
  return (
    <Link to="/" aria-label="EstateHub home" className="font-display text-lg font-medium uppercase tracking-[0.22em] text-ink-900">
      Estate<span className="text-bronze-500">Hub</span>
    </Link>
  );
}
