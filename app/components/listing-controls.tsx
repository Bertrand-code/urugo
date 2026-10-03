"use client";
import { useEffect, useState } from "react";
import { readJson } from "@/lib/http";
export function SaveHome({
  propertyId,
  recordView = false,
}: {
  propertyId: string;
  recordView?: boolean;
}) {
  const [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/saved")
      .then(readJson<{ preferences: { property_id: string; saved: number }[] }>)
      .then((r) =>
        setSaved(
          r.preferences.some(
            (p) => p.property_id === propertyId && p.saved === 1,
          ),
        ),
      )
      .catch(() => {});
    if (recordView)
      void fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });
  }, [propertyId, recordView]);
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, saved: !saved }),
      }).then(readJson);
      setSaved(!saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="save-home">
      <button
        type="button"
        className="button button-light"
        aria-pressed={saved}
        disabled={busy}
        onClick={() => void toggle()}
      >
        {saved ? "♥ Saved" : "♡ Save home"}
      </button>
      {error && (
        <small role="alert">
          {error}{" "}
          <a href="/signin-with-chatgpt?return_to=%2Fdiscover">Sign in</a>
        </small>
      )}
    </div>
  );
}
export function SavedHomes() {
  const [items, setItems] = useState<
    { property_id: string; saved: number; name: string; neighborhood: string }[]
  >([]);
  useEffect(() => {
    void fetch("/api/saved")
      .then(readJson<{ preferences: typeof items }>)
      .then((r) => setItems(r.preferences))
      .catch(() => {});
  }, []);
  return items.length ? (
    <section className="market-results">
      <p className="kicker">PICK UP WHERE YOU LEFT OFF</p>
      <h2>Saved & recently viewed</h2>
      <div className="recent-homes">
        {items.slice(0, 8).map((p) => (
          <a
            className="card"
            href={"/listings/" + p.property_id}
            key={p.property_id}
          >
            <strong>
              {p.saved ? "♥ " : ""}
              {p.name}
            </strong>
            <small>{p.neighborhood}</small>
          </a>
        ))}
      </div>
    </section>
  ) : null;
}
