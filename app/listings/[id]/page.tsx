"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { SaveHome } from "../../components/listing-controls";

type Unit = {
  id: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  price_amount: number;
  currency: string;
  available_date: string | null;
};
type Property = {
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
  year_built: number | null;
  address: string;
  city: string;
  description: string;
  amenities: string | null;
  pet_policy: string | null;
  parking: string | null;
  policies: string | null;
  images: { id: string; alt_text: string; url: string }[];
  units: Unit[];
};
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

export default function ListingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [property, setProperty] = useState<Property | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void params.then(({ id }) =>
      fetch("/api/listings/" + id)
        .then((response) =>
          response.json().then((result) => ({
            response,
            body: result as { error: string; property: Property },
          })),
        )
        .then(({ response, body }) => {
          if (!response.ok) throw new Error(body.error);
          setProperty(body.property);
        })
        .catch((reason) =>
          setError(
            reason instanceof Error ? reason.message : "Listing unavailable.",
          ),
        ),
    );
  }, [params]);
  if (error)
    return (
      <main className="marketplace">
        <MarketHeader />
        <section className="market-empty detail-empty">
          <strong>{error}</strong>
          <a className="button button-dark" href="/discover">
            Browse homes
          </a>
        </section>
      </main>
    );
  if (!property)
    return (
      <main className="marketplace">
        <MarketHeader />
        <section className="market-empty detail-empty">
          <strong>Loading listing…</strong>
        </section>
      </main>
    );
  const mainImage = property.images[0];
  return (
    <main className="marketplace">
      <MarketHeader />
      <section className="detail-hero">
        <div className="detail-image">
          {mainImage ? (
            <Image
              width={1000}
              height={750}
              unoptimized
              src={mainImage.url}
              alt={mainImage.alt_text || property.name}
            />
          ) : (
            <span className="listing-fallback">
              <i />
              <i />
              <i />
            </span>
          )}
        </div>
        <div className="detail-summary">
          <p className="kicker">
            {property.listing_type === "rent"
              ? "HOME FOR RENT"
              : "HOME FOR SALE"}
          </p>
          <h1>{property.name}</h1>
          <p className="detail-location">
            {property.address}, {property.neighborhood} · {property.city}
          </p>
          <strong>
            {property.price_amount
              ? money(property.price_amount, property.currency)
              : "Price on request"}
            {property.listing_type === "rent" && property.price_amount ? (
              <small> / month</small>
            ) : null}
          </strong>
          <div className="detail-specs">
            <span>
              {property.bedrooms || "—"}
              <small>Bedrooms</small>
            </span>
            <span>
              {property.bathrooms || "—"}
              <small>Bathrooms</small>
            </span>
            <span>
              {property.area_sqm || "—"}
              <small>m²</small>
            </span>
            {property.year_built && (
              <span>
                {property.year_built}
                <small>Built</small>
              </span>
            )}
          </div>
          <a
            className="button button-dark"
            href={"/apply?listing=" + property.id}
          >
            Apply for this home <span>→</span>
          </a>
          <SaveHome propertyId={property.id} recordView />
          <a
            className="text-button"
            href={
              "/contact?subject=" +
              encodeURIComponent("Question about " + property.name)
            }
          >
            Ask a question or request a tour →
          </a>
        </div>
      </section>
      <nav className="detail-nav">
        <a href="#overview">Overview</a>
        <a href="#units">Available units</a>
        <a href="#photos">Photos</a>
        <a href="#policies">Amenities & policies</a>
      </nav>
      <section className="listing-body" id="overview">
        <article>
          <p className="kicker">ABOUT THIS HOME</p>
          <h2>Made for everyday living.</h2>
          <p>
            {property.description ||
              "Contact the property team to learn more about this home and its available units."}
          </p>
        </article>
        <aside id="units">
          <p className="kicker">AVAILABLE UNITS</p>
          {property.units.length ? (
            property.units.map((unit) => (
              <div className="unit-row" key={unit.id}>
                <div>
                  <strong>{unit.name}</strong>
                  <span>
                    {unit.bedrooms} bd · {unit.bathrooms} ba
                    {unit.area_sqm ? " · " + unit.area_sqm + " m²" : ""}
                  </span>
                </div>
                <div>
                  <b>{money(unit.price_amount, unit.currency)}</b>
                  <small>
                    {unit.available_date
                      ? "Available " + unit.available_date
                      : "Available now"}
                  </small>
                  <a
                    className="button button-light"
                    href={"/apply?listing=" + property.id + "&unit=" + unit.id}
                  >
                    Apply for {unit.name}
                  </a>
                </div>
              </div>
            ))
          ) : (
            <p className="unit-empty">
              Contact the property team for current unit availability.
            </p>
          )}
        </aside>
      </section>
      <section
        className="market-results photo-gallery"
        id="photos"
        aria-label="Property photos"
      >
        {property.images.slice(1).map((image) => (
          <Image
            key={image.id}
            src={image.url}
            alt={image.alt_text || property.name}
            width={640}
            height={420}
            unoptimized
          />
        ))}
      </section>
      <section className="market-results card review-panel" id="policies">
        <h2>Amenities & policies</h2>
        <p>
          {property.amenities
            ? JSON.parse(property.amenities).join(" · ")
            : "Ask the property team about available amenities."}
        </p>
        <p>
          Pets:{" "}
          {property.pet_policy?.replaceAll("_", " ") || "Ask the property team"}{" "}
          · Parking: {property.parking || "Ask the property team"}
        </p>
        <p>
          {property.policies ||
            "Contact the property team to confirm lease terms and policies."}
        </p>
        <h3>Location</h3>
        <p>
          {property.address}, {property.city}
        </p>
        <a
          href={
            "https://www.openstreetmap.org/search?query=" +
            encodeURIComponent(property.address + " " + property.city)
          }
          target="_blank"
          rel="noreferrer"
        >
          View location on OpenStreetMap ↗
        </a>
      </section>
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
        <a href="/contact">Contact</a>
        <a className="button button-light" href="/">
          My Urugo
        </a>
      </nav>
    </header>
  );
}
