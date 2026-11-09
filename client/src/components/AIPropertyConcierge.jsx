import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { AI_SUGGESTIONS, CONCIERGE_EXAMPLE } from "../data/site.js";
import { listProperties } from "../services/propertyService.js";
import { AiError, askConcierge, isAiConfigured } from "../services/aiService.js";
import { describeFilterTags, explainMatch, filtersToParams, pathForFilters } from "../utils/aiFilters.js";
import { describeFilters, parsePrompt } from "../utils/parsePrompt.js";
import { formatLocation, formatPrice } from "../utils/format.js";
import PropertyImage from "./PropertyImage.jsx";

// With the AI service configured, the concierge holds a short conversation: it can ask a follow-up question,
// then searches published listings with the filters it understood. The listings, their prices and the
// "why it matches" reasons always come from the database, never from the AI. Without the AI service (or if it
// fails) it falls back to the original keyword search, so the section always works.
export default function AIPropertyConcierge() {
  const [text, setText] = useState("");
  const [thread, setThread] = useState([]); // what has been said so far: [{ role, content }]
  const [state, setState] = useState({ status: "idle" }); // idle | thinking | done | error
  const timer = useRef();

  useEffect(() => () => clearTimeout(timer.current), []);

  const basicSearch = async (query, notice) => {
    const filters = parsePrompt(query);
    const tags = describeFilters(filters);
    const matches = tags.length ? (await listProperties(filters, { limit: 20 })).items : [];
    setState({ status: "done", mode: "basic", tags, matches, filters, notice });
  };

  const askWithAi = async (query) => {
    const next = [...thread, { role: "user", content: query }].slice(-10);
    setThread(next);
    setText("");
    setState({ status: "thinking" });
    try {
      const r = await askConcierge(next);
      let matches = [];
      let total = 0;
      if (r.ready) {
        const found = await listProperties(r.filters, { limit: 5 });
        matches = found.items;
        total = found.total;
      }
      setThread((t) => [...t, { role: "assistant", content: r.ready ? r.reply : r.followUpQuestion || r.reply }]);
      setState({ status: "done", mode: "ai", query, reply: r.reply, followUp: r.followUpQuestion, ready: r.ready, filters: r.filters, tags: describeFilterTags(r.filters), unsupported: r.unsupported, matches, total });
    } catch (err) {
      const why = err instanceof AiError ? err.message : "The AI assistant is unavailable right now.";
      setThread([]);
      try {
        await basicSearch(query, `${why} Showing basic keyword search results instead.`);
      } catch {
        setState({ status: "error" });
      }
    }
  };

  const ask = (prompt) => {
    const query = prompt.trim();
    if (!query) return;
    if (isAiConfigured) return void askWithAi(query);
    setText(query);
    setState({ status: "thinking" });
    clearTimeout(timer.current);
    // short pause so the "searching" state is visible
    timer.current = setTimeout(async () => {
      try {
        await basicSearch(query);
      } catch {
        setState({ status: "error" });
      }
    }, 700);
  };

  const reset = () => {
    setThread([]);
    setText("");
    setState({ status: "idle" });
  };

  const waitingForAnswer = state.status === "done" && state.mode === "ai" && !state.ready;
  const seeAll = state.status === "done" && state.mode === "ai" && state.ready && state.total > state.matches.length;

  return (
    <section className="section bg-sand-100" aria-labelledby="concierge-heading">
      <div className="container-x">
        <div className="mx-auto max-w-3xl text-center">
          <p className="caption inline-flex items-center gap-2 text-bronze-600">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
            Property Concierge
          </p>
          <h2 id="concierge-heading" className="section-title mt-5">Tell us what you&rsquo;re looking for.</h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-500">Describe your ideal property in your own words and we&rsquo;ll match it to current listings.</p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(text);
            }}
            className="rounded border border-sand-300 bg-white shadow-search"
          >
            <label htmlFor="concierge-prompt" className="sr-only">{waitingForAnswer ? "Your answer" : "Describe the property you want"}</label>
            <textarea
              id="concierge-prompt"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={waitingForAnswer ? "Type your answer…" : CONCIERGE_EXAMPLE}
              className="block w-full resize-none rounded-t bg-transparent px-6 pb-3 pt-6 font-display text-lg font-light leading-relaxed text-ink-900 placeholder:text-sand-500 focus:outline-none sm:text-xl"
            />
            <div className="flex flex-col gap-4 border-t border-sand-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-400">
                {isAiConfigured ? "AI-assisted. Results come only from published listings." : "Demo concierge. Matches come from sample listings."}
              </p>
              <div className="flex shrink-0 items-center gap-4">
                {thread.length > 0 && <button type="button" onClick={reset} className="text-sm text-ink-500 underline underline-offset-4 hover:text-bronze-600">Start over</button>}
                <button type="submit" disabled={!text.trim() || state.status === "thinking"} className="btn-primary">
                  {waitingForAnswer ? "Send" : "Find My Property"}
                </button>
              </div>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-500">
            <span>Try</span>
            {AI_SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => ask(s)} className="text-left underline decoration-sand-400 underline-offset-4 transition-colors hover:text-bronze-600 hover:decoration-bronze-500">
                {s}
              </button>
            ))}
          </div>

          <div className="mt-10" aria-live="polite">
            {state.status === "thinking" && <p className="text-center text-sm text-ink-500">{isAiConfigured ? "Thinking…" : "Searching listings…"}</p>}

            {state.status === "error" && <p className="text-center text-sm text-red-700">We couldn’t search right now. Please try again.</p>}

            {state.status === "done" && (
              <div>
                {state.notice && <p className="mb-3 text-center text-xs text-ink-500">{state.notice}</p>}

                {state.mode === "ai" ? (
                  <div className="space-y-2 text-center text-sm text-ink-700">
                    <p>{state.reply}</p>
                    {state.followUp && <p className="font-display text-lg font-light text-ink-900">{state.followUp}</p>}
                    {state.ready && state.matches.length === 0 && <p>No published properties match all of that right now. Try a different budget or area.</p>}
                    {state.ready && state.matches.length > 0 && <p className="text-ink-500">{state.total} matching {state.total === 1 ? "property" : "properties"}</p>}
                  </div>
                ) : (
                  <p className="text-center text-sm text-ink-700">
                    {state.tags.length === 0
                      ? "We couldn’t find a property type, area or budget in that. Try “a 3-bedroom house in Lalitpur under 2 crore”."
                      : state.matches.length === 0
                        ? "No properties found matching your search. Try a higher budget or a nearby area."
                        : `${state.matches.length} matching ${state.matches.length === 1 ? "property" : "properties"}`}
                  </p>
                )}

                {state.tags.length > 0 && <p className="mt-2 text-center text-xs text-ink-400">{state.tags.join("  /  ")}</p>}
                {state.mode === "ai" && state.unsupported?.length > 0 && (
                  <p className="mt-2 text-center text-xs text-ink-500">I can’t filter by {state.unsupported.join(", ")}, so these results don’t take that into account.</p>
                )}

                {state.matches.length > 0 && (
                  <ul className="mt-6 divide-y divide-sand-200 rounded border border-sand-300 bg-white">
                    {state.matches.slice(0, state.mode === "ai" ? 5 : 3).map((p) => (
                      <li key={p.id}>
                        <Link to={`/properties/${p.id}`} className="group flex items-center gap-5 p-3 pr-5 transition-colors hover:bg-sand-50">
                          <div className="h-20 w-28 shrink-0 overflow-hidden rounded bg-sand-200">
                            <PropertyImage property={p} width={400} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-display text-lg text-ink-900 group-hover:text-bronze-600">{p.title}</p>
                            <p className="mt-0.5 truncate text-sm text-ink-500">{formatLocation(p)}</p>
                            <p className="mt-1 text-xs leading-relaxed text-ink-500">
                              <span className="text-ink-700">Why it matches:</span> {explainMatch(p, state.filters).join(" · ")}
                            </p>
                          </div>
                          <p className="hidden shrink-0 text-sm font-medium text-ink-900 sm:block">{formatPrice(p)}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {seeAll && (
                  <p className="mt-4 text-center">
                    <Link to={`${pathForFilters(state.filters)}?${filtersToParams(state.filters).toString()}`} state={{ ai: { query: state.query, unsupported: state.unsupported } }} className="link-line">
                      See all {state.total} results
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}


