export default function EmptyState({ title, text, action }) {
  return (
    <div className="rounded border border-dashed border-sand-400 bg-white px-6 py-20 text-center">
      <h2 className="font-display text-2xl font-light text-ink-900">{title}</h2>
      {text && <p className="mx-auto mt-3 max-w-sm text-sm text-ink-500">{text}</p>}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}
