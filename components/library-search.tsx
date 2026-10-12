"use client";

import { useEffect, useState, useTransition } from "react";
import { addMemeTemplate, searchMemes } from "@/app/actions";
import type { MemeTemplate } from "@/lib/memegen";

const SUGGESTIONS = ["cat", "drake", "spongebob", "office", "dog", "kid"];

// Searches every memegen.link template by name. Picking one adds it to the
// meme library (AI describes it once) and opens its page to caption.
export function LibrarySearch() {
  const [query, setQuery] = useState("");
  const [gifsOnly, setGifsOnly] = useState(false);
  const [results, setResults] = useState<MemeTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  // Search as you type (after a short pause)
  useEffect(() => {
    const timer = setTimeout(() => {
      startSearch(async () => {
        const result = await searchMemes(query, gifsOnly);
        setResults(result.results ?? []);
        setError(result.error ?? null);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, gifsOnly]);

  async function add(id: string) {
    setAdding(id);
    setError(null);
    // On success the action redirects to the template's page
    const result = await addMemeTemplate(id);
    if (result?.error) setError(result.error);
    setAdding(null);
  }

  return (
    <section className="panel p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Find a meme template</h2>
        <p className="text-sm text-dim">
          Search our hand-picked classic templates. Pick one, then tell the AI what the
          joke should be about.
        </p>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        maxLength={100}
        placeholder="e.g. cat, drake, spongebob"
        aria-label="Search meme templates"
        className="field"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={gifsOnly}
          onClick={() => setGifsOnly(!gifsOnly)}
          className={`px-3 py-1 text-sm font-medium ${
            gifsOnly
              ? "tab-on"
              : "border border-line text-dim"
          }`}
        >
          GIFs only
        </button>
        <span className="mx-1 h-4 w-px bg-well" />
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setQuery(s)}
            className="border border-line px-3 py-1 text-xs tab-off"
          >
            {s}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {results?.length === 0 && !searching && (
        <p className="text-sm text-dim">
          No templates match. Search by meme name, and put the topic (like
          &ldquo;snow&rdquo;) in the caption box after you pick one.
        </p>
      )}
      {results && results.length > 0 && (
        <ul className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${searching ? "opacity-50" : ""}`}>
          {results.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => add(t.id)}
                disabled={Boolean(adding)}
                className="group relative block w-full overflow-hidden bg-well text-left disabled:cursor-wait"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- external search results */}
                <img src={t.thumbnail} alt={t.name} loading="lazy" className="aspect-square w-full object-cover" />
                {t.isGif && (
                  <span className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white">
                    GIF
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-xs px-2 py-1.5 truncate">
                  {adding === t.id ? "AI is looking…" : t.name}
                </span>
                {adding === t.id && <span className="absolute inset-0 bg-card/40 animate-pulse" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
