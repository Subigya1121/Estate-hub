import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { AiError, isAiConfigured, parseSearch } from "../services/aiService.js";
import { describeFilterTags, filtersToParams, pathForFilters } from "../utils/aiFilters.js";

// Plain-language search. The AI turns the sentence into filters; the existing listing pages then run
// the search against published listings. Hidden entirely when the AI service isn't configured.
export default function AiSearchBox() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ status: "idle", error: "" });
  if (!isAiConfigured) return null;

  const submit = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (state.status === "loading") return;
    if (q.length < 3) return setState({ status: "error", error: "Describe what you're looking for in a few words." });
    setState({ status: "loading", error: "" });
    try {
      const { filters, unsupported } = await parseSearch(q);
      if (unsupported.some((item) => /unclear location/i.test(item))) {
        return setState({ status: "error", error: "Please enter one clear district, city or locality so we can keep the search specific." });
      }
      if (describeFilterTags(filters).length === 0 && unsupported.length === 0) {
        return setState({ status: "error", error: "We couldn't find search details in that. Try mentioning a property type, an area or a budget." });
      }
      const qs = filtersToParams(filters).toString();
      navigate(`${pathForFilters(filters)}${qs ? `?${qs}` : ""}`, { state: { ai: { query: q, unsupported } } });
      setState({ status: "idle", error: "" });
    } catch (err) {
      setState({ status: "error", error: err instanceof AiError ? err.message : "AI search isn't available right now. You can still use the filters below." });
    }
  };

  const busy = state.status === "loading";
  return (
    <form onSubmit={submit} className="mt-8 max-w-2xl" aria-label="Search in plain language">
      <label htmlFor="ai-search" className="field-label flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-bronze-500" strokeWidth={1.75} /> Or describe what you're looking for
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="ai-search"
          className="field"
          value={query}
          maxLength={500}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. a two-bedroom apartment in Kathmandu under 1 crore"
        />
        <button type="submit" disabled={busy} className="btn-outline shrink-0">{busy ? "Searching…" : "Search"}</button>
      </div>
      <p className="mt-2 text-xs text-ink-400">Results come only from published listings.</p>
      {state.status === "error" && <p role="alert" className="mt-2 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
