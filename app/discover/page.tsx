"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import Image from "next/image";
import { SaveHome, SavedHomes } from "../components/listing-controls";
type Listing = {
  id: string;
  name: string;
  neighborhood: string;
  kind: string;
  listing_type: "rent" | "sale";
  price_amount: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  address: string;
  city: string;
  image_url: string | null;
  available_units: number;
  featured: number;
  amenities: string | null;
  pet_policy: string | null;
  parking: string | null;
};

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

export default function DiscoverPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [view, setView] = useState("grid");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (filters?: {
      q?: string;
      type?: string;
      bedrooms?: string;
      [key: string]: string | undefined;
    }) => {
      setBusy(true);
      setError("");
      const value = filters ?? {};
      const params = new URLSearchParams();
      Object.entries(value).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      try {
        const response = await fetch("/api/marketplace?" + params.toString());
        const result = (await response.json()) as {
          error?: string;
          listings: Listing[];
        };
        if (!response.ok)
          throw new Error(result.error ?? "We could not load listings.");
        setListings(result.listings);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "We could not load listings.",
        );
      } finally {
        setBusy(false);
      }
    },
    [],
  );
  useEffect(() => {
    void load({});
  }, [load]);
  function submit(event: FormEvent) {
    event.preventDefault();
    void load({ ...filters, q: search, type, bedrooms });
  }

  return (
    <main className="marketplace">
      <MarketHeader />
      <section className="market-hero">
        <div>
          <p className="kicker">FIND YOUR NEXT PLACE</p>
          <h1>Find a place that feels like home.</h1>
          <p>
            Explore homes for rent or sale in Burundi, then connect directly
            with the property team.
          </p>
        </div>
        <form className="market-search" onSubmit={submit}>
          <label>
            Where are you looking?
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Neighborhood or address"
            />
          </label>
          <label>
            Looking for
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="">Rent or buy</option>
              <option value="rent">For rent</option>
              <option value="sale">For sale</option>
            </select>
          </label>
          <label>
            Bedrooms
            <select
              value={bedrooms}
              onChange={(event) => setBedrooms(event.target.value)}
            >
              <option value="">Any size</option>
              <option value="1">1+ bedroom</option>
              <option value="2">2+ bedrooms</option>
              <option value="3">3+ bedrooms</option>
            </select>
          </label>
          <button className="button button-dark" disabled={busy}>
            {busy ? "Searching…" : "Search homes"}
          </button>
        </form>
      </section>
      <details className="market-filters">
        <summary>Price, move-in & more filters</summary>
        <div className="form-grid">
          {[
            ["minPrice", "Minimum price", "number"],
            ["maxPrice", "Maximum price", "number"],
            ["bathrooms", "Minimum bathrooms", "number"],
            ["moveIn", "Move-in by", "date"],
            ["amenities", "Amenities (comma-separated)", "text"],
          ].map(([key, name, type]) => (
            <label key={key}>
              {name}
              <input
                type={type}
                min="0"
                value={filters[key] || ""}
                onChange={(e) =>
                  setFilters({ ...filters, [key]: e.target.value })
                }
              />
            </label>
          ))}
          <label>
            Currency
            <select
              value={filters.currency || ""}
              onChange={(e) =>
                setFilters({ ...filters, currency: e.target.value })
              }
            >
              <option value="">All currencies</option>
              <option>BIF</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.pets === "allowed"}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  pets: e.target.checked ? "allowed" : "",
                })
              }
            />{" "}
            Pet friendly
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.parking === "available"}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  parking: e.target.checked ? "available" : "",
                })
              }
            />{" "}
            Parking
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.available === "1"}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  available: e.target.checked ? "1" : "",
                })
              }
            />{" "}
            Available units only
          </label>
        </div>
        <button
          className="button button-dark"
          onClick={() => void load({ ...filters, q: search, type, bedrooms })}
        >
          Apply filters
        </button>
      </details>
      <section className="market-results">
        <header>
          <div>
            <p className="kicker">AVAILABLE LISTINGS</p>
            <h2>
              {busy ? "Finding homes…" : listings.length + " homes to explore"}
            </h2>
          </div>
          <a href="/apply">
            Already found a home? Apply <span>→</span>
          </a>
        </header>
        {error && <p className="inline-error">{error}</p>}
        {!busy && listings.length === 0 && (
          <div className="market-empty">
            <strong>No homes match that search.</strong>
            <p>
              Try a broader neighborhood or check back as property teams publish
              new listings.
            </p>
            <button
              className="text-button"
              onClick={() => {
                setSearch("");
                setType("");
                setBedrooms("");
                setFilters({});
                void load({});
              }}
            >
              Clear search
            </button>
          </div>
        )}
        <div className="filter-chips">
          <button
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            Grid view
          </button>
          <button
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            List view
          </button>
        </div>
        <div
          className={view === "grid" ? "market-grid" : "market-grid list-view"}
        >
          {listings.map((listing) => (
            <article className="listing-card" key={listing.id}>
              <div className="listing-image">
                {listing.image_url ? (
                  <Image
                    src={listing.image_url}
                    alt={listing.name}
                    width={640}
                    height={420}
                    unoptimized
                  />
                ) : (
                  <span className="listing-fallback">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
                {listing.featured ? <em>Featured</em> : null}
                <b>
                  {listing.listing_type === "rent" ? "For rent" : "For sale"}
                </b>
              </div>
              <div className="listing-copy">
                <p>
                  {listing.city} · {listing.neighborhood}
                </p>
                <h3>
                  <a href={"/listings/" + listing.id}>{listing.name}</a>
                </h3>
                <strong>
                  {listing.price_amount
                    ? money(listing.price_amount, listing.currency)
                    : "Price on request"}
                  {listing.listing_type === "rent" && listing.price_amount ? (
                    <small> / month</small>
                  ) : null}
                </strong>
                <span>
                  {listing.bedrooms || "—"} bd · {listing.bathrooms || "—"} ba{" "}
                  {listing.area_sqm ? "· " + listing.area_sqm + " m²" : ""}
                </span>
                <p>
                  {listing.available_units} units available
                  {listing.pet_policy === "allowed" ? " · Pet friendly" : ""}
                  {listing.parking === "available" ? " · Parking" : ""}
                </p>
                <div className="listing-actions">
                  <a className="text-button" href={"/listings/" + listing.id}>
                    View property →
                  </a>
                  <SaveHome propertyId={listing.id} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <SavedHomes />
    </main>
  );
}

function MarketHeader() {
  return (
    <header className="market-header">
      <a className="brand" href="/">
        <span className="brand-mark">
          <i />
          <i />
          <i />
        </span>
        <span>urugo</span>
      </a>
      <nav>
        <a className="nav-active-link" href="/discover">
          Explore homes
        </a>
        <a href="/apply">Apply</a>
        <a href="/cars">Cars</a>
        <a href="/health">Health</a>
        <a href="/contact">Contact</a>
        <a className="button button-light" href="/">
          My Urugo
        </a>
      </nav>
    </header>
  );
}
