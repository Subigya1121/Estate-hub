import { useState } from "react";
import { Sparkles } from "lucide-react";
import { LOCATION_META } from "../data/site.js";
import { AiError, generateDescription, isAiConfigured } from "../services/aiService.js";

// Only what the owner entered is sent: the AI never sees anything else about them or the listing.
function buildFacts(v, notes) {
  const other = v.location === "other";
  const facts = {
    listing_type: v.listingType,
    property_type: v.propertyType,
    location: other ? v.otherLocation.trim() : v.location,
    price_npr: Number(v.price),
    price_unit: v.listingType === "rent" ? "month" : v.priceUnit === "aana" && v.propertyType === "land" ? "aana" : "total",
    amenities: v.amenities,
  };
  const city = other ? v.otherCity.trim() : LOCATION_META[v.location]?.city;
  if (city) facts.city = city;
  if (v.category) facts.category = v.category;
  if (v.bedrooms !== "") facts.bedrooms = Number(v.bedrooms);
  if (v.bathrooms !== "") facts.bathrooms = Number(v.bathrooms);
  if (v.areaSqft !== "") facts.area_sqft = Number(v.areaSqft);
  if (v.landArea !== "") facts.land_area_aana = Number(v.landArea);
  if (v.roadAccess.trim()) facts.road_access = v.roadAccess.trim();
  if (notes.trim()) facts.additional_details = notes.trim();
  return facts;
}

function missing(v) {
  if (!(Number(v.price) > 0)) return "Enter the price first.";
  if (!v.location || (v.location === "other" && (v.otherLocation.trim().length < 2 || v.otherCity.trim().length < 2))) return "Choose the location first.";
  return "";
}

// Drafts a title and description from the owner's facts. Nothing is saved or published here: the owner
// edits the draft, chooses to use it, and then submits the form for review as usual.
export default function AiDescriptionAssistant({ values, onApply }) {
  const [notes, setNotes] = useState("");
  const [state, setState] = useState({ status: "idle", error: "" });
  const [draft, setDraft] = useState(null);
  const [addHighlights, setAddHighlights] = useState(false);
  if (!isAiConfigured) return null;

  const generate = async () => {
    const problem = missing(values);
    if (problem) return setState({ status: "error", error: problem });
    setState({ status: "loading", error: "" });
    try {
      const r = await generateDescription(buildFacts(values, notes));
      setDraft({ title: r.title, description: r.description, highlights: r.highlights.join("\n"), seo: r.seoDescription, warnings: r.warnings || [] });
      setState({ status: "ready", error: "" });
    } catch (err) {
      setState({ status: "error", error: err instanceof AiError ? err.message : "We couldn't generate a draft. You can write the description yourself." });
    }
  };

  const apply = () => {
    const lines = draft.highlights.split("\n").map((l) => l.trim()).filter(Boolean);
    const description = draft.description.trim() + (addHighlights && lines.length ? `\n\nHighlights:\n${lines.map((l) => `- ${l}`).join("\n")}` : "");
    onApply({ title: draft.title.trim(), description });
    setDraft(null);
    setState({ status: "applied", error: "" });
  };

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  return (
    <div className="rounded border border-sand-300 bg-sand-50 p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-ink-900"><Sparkles className="h-4 w-4 text-bronze-500" strokeWidth={1.75} /> Draft with AI</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">
        Creates a title and description from the details you entered above. It is told to use only those facts. AI drafts can still contain mistakes, so check every line before you use it. Nothing is saved or published from here.
      </p>

      {!draft && (
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="ai-notes" className="field-label">Anything else to mention (optional)</label>
            <textarea id="ai-notes" className="field resize-none" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Only facts you are sure about" />
          </div>
          <button type="button" onClick={generate} disabled={state.status === "loading"} className="btn-outline">
            {state.status === "loading" ? "Writing a draft…" : "Generate description with AI"}
          </button>
        </div>
      )}
      {state.status === "error" && <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>}
      {state.status === "applied" && <p role="status" className="mt-3 text-sm text-ink-700">Added to the form above. Review it, then submit for review as usual.</p>}

      {draft && (
        <div className="mt-4 space-y-4">
          {draft.warnings.map((w) => <p key={w} role="status" className="rounded border border-sand-300 bg-white px-3 py-2 text-xs text-ink-700">{w}</p>)}
          <div><label className="field-label">Title</label><input className="field" value={draft.title} maxLength={120} onChange={set("title")} /></div>
          <div><label className="field-label">Description</label><textarea className="field resize-y" rows={7} maxLength={3000} value={draft.description} onChange={set("description")} /></div>
          <div><label className="field-label">Key highlights (one per line)</label><textarea className="field resize-y" rows={4} value={draft.highlights} onChange={set("highlights")} /></div>
          <label className="flex items-center gap-3 text-sm text-ink-700">
            <input type="checkbox" checked={addHighlights} onChange={(e) => setAddHighlights(e.target.checked)} className="h-4 w-4 accent-ink-900" /> Add the highlights to the description
          </label>
          <div>
            <label className="field-label">Search-engine description (copy it if you need it)</label>
            <textarea className="field resize-none" rows={2} maxLength={200} value={draft.seo} onChange={set("seo")} />
            <p className="mt-1 text-xs text-ink-400">Not saved with the listing: EstateHub has no field for it yet.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={apply} className="btn-primary">Use title and description</button>
            <button type="button" onClick={generate} disabled={state.status === "loading"} className="btn-outline">{state.status === "loading" ? "Writing…" : "Write another draft"}</button>
            <button type="button" onClick={() => { setDraft(null); setState({ status: "idle", error: "" }); }} className="link-line">Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
