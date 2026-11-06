import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { AI_SUGGESTIONS, CONCIERGE_EXAMPLE } from "../data/site.js";
import { listProperties } from "../services/propertyService.js";
import { describeFilters, parsePrompt } from "../utils/parsePrompt.js";
import { formatLocation, formatPrice } from "../utils/format.js";
import PropertyImage from "./PropertyImage.jsx";

export default function AIPropertyConcierge() {
  const [text, setText] = useState("");
  const [state, setState] = useState({ status: "idle" }); // idle | thinking | done
  const timer = useRef();

  useEffect(() => () => clearTimeout(timer.current), []);

  const ask = (prompt) => {
    const query = prompt.trim();
    if (!query) return;
    setText(query);
    setState({ status: "thinking" });
    clearTimeout(timer.current);
    // Mock delay. This becomes a call to the Node API -> FastAPI AI service in a later stage.
    timer.current = setTimeout(async () => {
      const filters = parsePrompt(query);
      const tags = describeFilters(filters);
      try {
        const matches = tags.length ? (await listProperties(filters, { limit: 20 })).items : [];
        setState({ status: "done", tags, matches });
      } catch {
        setState({ status: "error" });
      }
    }, 700);
  };

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
            <label htmlFor="concierge-prompt" className="sr-only">Describe the property you want</label>
            <textarea
              id="concierge-prompt"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={CONCIERGE_EXAMPLE}
              className="block w-full resize-none rounded-t bg-transparent px-6 pb-3 pt-6 font-display text-lg font-light leading-relaxed text-ink-900 placeholder:text-sand-500 focus:outline-none sm:text-xl"
            />
            <div className="flex flex-col gap-4 border-t border-sand-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-400">Demo concierge. Matches come from sample listings.</p>
              <button type="submit" disabled={!text.trim() || state.status === "thinking"} className="btn-primary shrink-0">
                Find My Property
              </button>
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
            {state.status === "thinking" && <p className="text-center text-sm text-ink-500">Searching listings&hellip;</p>}

            {state.status === "error" && <p className="text-center text-sm text-red-700">We couldn’t search right now. Please try again.</p>}

            {state.status === "done" && (
              <div>
                <p className="text-center text-sm text-ink-700">
                  {state.tags.length === 0
                    ? "We couldn’t find a property type, area or budget in that. Try “a 3-bedroom house in Lalitpur under 2 crore”."
                    : state.matches.length === 0
                      ? "No properties found matching your search. Try a higher budget or a nearby area."
                      : `${state.matches.length} matching ${state.matches.length === 1 ? "property" : "properties"}`}
                </p>
                {state.tags.length > 0 && (
                  <p className="mt-2 text-center text-xs text-ink-400">{state.tags.join("  /  ")}</p>
                )}

                {state.matches.length > 0 && (
                  <ul className="mt-6 divide-y divide-sand-200 rounded border border-sand-300 bg-white">
                    {state.matches.slice(0, 3).map((p) => (
                      <li key={p.id}>
                        <Link to={`/properties/${p.id}`} className="group flex items-center gap-5 p-3 pr-5 transition-colors hover:bg-sand-50">
                          <div className="h-20 w-28 shrink-0 overflow-hidden rounded bg-sand-200">
                            <PropertyImage property={p} width={400} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-display text-lg text-ink-900 group-hover:text-bronze-600">{p.title}</p>
                            <p className="mt-0.5 truncate text-sm text-ink-500">{formatLocation(p)}</p>
                          </div>
                          <p className="hidden shrink-0 text-sm font-medium text-ink-900 sm:block">{formatPrice(p)}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
