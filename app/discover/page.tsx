"use client";

import { FormEvent, useEffect, useState } from "react";

type Listing = {
  id: string; name: string; neighborhood: string; kind: string; listing_type: "rent" | "sale"; price_amount: number;
  currency: string; bedrooms: number; bathrooms: number; area_sqm: number | null; address: string; city: string;
  image_url: string | null; available_units: number;
};

const money = (amount: number, currency: string) => new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

export default function DiscoverPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function load(filters?: { q?: string; type?: string; bedrooms?: string }) {
    setBusy(true); setError("");
    const value = filters ?? { q: search, type, bedrooms };
    const params = new URLSearchParams();
    if (value.q) params.set("q", value.q);
    if (value.type) params.set("type", value.type);
    if (value.bedrooms) params.set("bedrooms", value.bedrooms);
    try {
      const response = await fetch("/api/marketplace?" + params.toString());
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "We could not load listings.");
      setListings(result.listings);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not load listings."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load({}); }, []);
  function submit(event: FormEvent) { event.preventDefault(); void load(); }

  return <main className="marketplace">
    <MarketHeader />
    <section className="market-hero"><div><p className="kicker">FIND YOUR NEXT PLACE</p><h1>Good homes begin with a better search.</h1><p>Explore verified homes for rent or sale in Burundi, then connect directly with the property team.</p></div><form className="market-search" onSubmit={submit}><label>Where are you looking?<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Neighborhood or address" /></label><label>Looking for<select value={type} onChange={(event) => setType(event.target.value)}><option value="">Rent or buy</option><option value="rent">For rent</option><option value="sale">For sale</option></select></label><label>Bedrooms<select value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}><option value="">Any size</option><option value="1">1+ bedroom</option><option value="2">2+ bedrooms</option><option value="3">3+ bedrooms</option></select></label><button className="button button-dark" disabled={busy}>{busy ? "Searching…" : "Search homes"}</button></form></section>
    <section className="market-results"><header><div><p className="kicker">AVAILABLE LISTINGS</p><h2>{busy ? "Finding homes…" : listings.length + " homes to explore"}</h2></div><a href="/apply">Already found a home? Apply <span>→</span></a></header>{error && <p className="inline-error">{error}</p>}{!busy && listings.length === 0 && <div className="market-empty"><strong>No homes match that search.</strong><p>Try a broader neighborhood or check back as property teams publish new listings.</p><button className="text-button" onClick={() => { setSearch(""); setType(""); setBedrooms(""); void load({}); }}>Clear search</button></div>}<div className="market-grid">{listings.map((listing) => <a className="listing-card" href={"/listings/" + listing.id} key={listing.id}><div className="listing-image">{listing.image_url ? <img src={listing.image_url} alt={listing.name} /> : <span className="listing-fallback"><i /><i /><i /></span>}<b>{listing.listing_type === "rent" ? "For rent" : "For sale"}</b></div><div className="listing-copy"><p>{listing.city} · {listing.neighborhood}</p><h3>{listing.name}</h3><strong>{listing.price_amount ? money(listing.price_amount, listing.currency) : "Price on request"}{listing.listing_type === "rent" && listing.price_amount ? <small> / month</small> : null}</strong><span>{listing.bedrooms || "—"} bd · {listing.bathrooms || "—"} ba {listing.area_sqm ? "· " + listing.area_sqm + " m²" : ""}</span></div></a>)}</div></section>
  </main>;
}

function MarketHeader() {
  return <header className="market-header"><a className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>urugo</span></a><nav><a className="nav-active-link" href="/discover">Explore homes</a><a href="/apply">Apply</a><a href="/contact">Contact</a><a className="button button-light" href="/">Sign in</a></nav></header>;
}
