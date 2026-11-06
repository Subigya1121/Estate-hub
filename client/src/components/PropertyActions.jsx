import InquiryForm from "./InquiryForm.jsx";
import VisitRequestForm from "./VisitRequestForm.jsx";

const TABS = [
  { id: "inquiry", label: "Send Inquiry" },
  { id: "visit", label: "Schedule a Visit" },
  { id: "contact", label: "Contact Agent" },
];

function ContactPanel({ agent }) {
  const hasContact = Boolean(agent.phone || agent.email);
  return (
    <div>
      <p className="font-display text-xl">{agent.name}</p>
      {agent.role && <p className="mt-1 text-sm text-ink-500">{agent.role}</p>}
      {hasContact ? (
        <ul className="mt-6 space-y-4 border-t border-sand-200 pt-6 text-sm">
          {agent.phone && <li><span className="block text-xs text-ink-400">Phone</span><a href={`tel:${agent.phone.replace(/\s/g, "")}`} className="font-medium text-ink-900 hover:text-bronze-600">{agent.phone}</a></li>}
          {agent.email && <li><span className="block text-xs text-ink-400">Email</span><a href={`mailto:${agent.email}`} className="font-medium text-ink-900 hover:text-bronze-600">{agent.email}</a></li>}
        </ul>
      ) : (
        <p className="mt-6 border-t border-sand-200 pt-6 text-sm text-ink-500">No direct contact details were provided for this listing. Use Send Inquiry to reach the owner.</p>
      )}
      {agent.demo && <p className="mt-6 text-xs text-ink-400">Demo contact details for a sample listing.</p>}
    </div>
  );
}

// `tab` is controlled by the page so the header buttons can jump to a tab.
export default function PropertyActions({ property, tab, onTabChange }) {
  return (
    <div className="rounded border border-sand-300 bg-white">
      <div role="tablist" aria-label="Contact options" className="grid grid-cols-3 border-b border-sand-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="actions-panel"
            onClick={() => onTabChange(t.id)}
            className={`border-b-2 px-2 py-4 text-xs font-medium transition-colors sm:text-sm ${tab === t.id ? "border-bronze-500 text-ink-900" : "border-transparent text-ink-400 hover:text-ink-900"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="actions-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="p-6">
        {tab === "inquiry" && <InquiryForm key={property.id} property={property} />}
        {tab === "visit" && <VisitRequestForm key={property.id} property={property} />}
        {tab === "contact" && <ContactPanel agent={property.agent} />}
      </div>
    </div>
  );
}
