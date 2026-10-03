"use client";
import { useRef, useState, useEffect, type FormEvent } from "react";
import { readJson } from "@/lib/http";
export function WorkspaceSearch() {
  const input = useRef<HTMLInputElement>(null),
    [q, setQ] = useState(""),
    [results, setResults] = useState<
      {
        id: string;
        property_id: string;
        title: string;
        subtitle: string;
        tab: string;
      }[]
    >([]),
    [error, setError] = useState(""),
    [searched, setSearched] = useState(false);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        input.current?.focus();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  async function search(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await fetch("/api/search?q=" + encodeURIComponent(q)).then(
        readJson<{ results: typeof results }>,
      );
      setResults(result.results);
      setSearched(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="workspace-search">
      <form onSubmit={search}>
        <label>
          <span className="sr-only">Search your portfolio</span>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your portfolio… ⌘K"
            minLength={2}
          />
        </label>
        <button type="submit" aria-label="Search">
          Search
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {searched && (
        <div className="search-results">
          <button className="text-button" onClick={() => setSearched(false)}>
            Close results
          </button>
          <ul>
            {results.map((r) => (
              <li key={r.tab + r.id}>
                <a
                  href={
                    "/?mode=manage&tab=" +
                    r.tab +
                    "&property=" +
                    r.property_id +
                    "&record=" +
                    r.id
                  }
                >
                  <strong>{r.title}</strong>
                  <small>
                    {r.subtitle} · {r.tab}
                  </small>
                </a>
              </li>
            ))}
          </ul>
          {!results.length && (
            <p>No matching records in your accessible properties.</p>
          )}
        </div>
      )}
    </div>
  );
}
