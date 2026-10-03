"use client";
import { useState, type FormEvent } from "react";
import {
  CarCard,
  type Car,
  Empty,
  ErrorNotice,
  Loading,
  useResource,
} from "../components/products";
export default function Cars() {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const { data, error, loading, reload } = useResource<{
    vehicles: Car[];
    hasMore: boolean;
  }>(`/api/cars?${query}&page=${page}`);
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPage(1);
    setQuery(
      new URLSearchParams(
        new FormData(e.currentTarget) as unknown as Record<string, string>,
      ).toString(),
    );
  }
  return (
    <main className="product-main">
      <section className="product-hero">
        <div>
          <div className="product-eyebrow">URUGO CARS · BURUNDI</div>
          <h1>
            A new chapter.
            <br />A different set of keys.
          </h1>
          <p>
            Find a car that fits your everyday. Explore local listings, compare
            the details, and talk directly with the seller.
          </p>
        </div>
        <aside className="product-hero-note">
          <strong>Ready for your next move?</strong>
          <p>
            Give your car a proper introduction. Add its story, specifications,
            and real photos.
          </p>
          <a className="product-text-link" href="/cars/manage">
            List your car ↗
          </a>
        </aside>
      </section>
      <form className="product-search" onSubmit={search}>
        <label>
          Make, model, or location
          <input
            name="q"
            placeholder="Try Toyota or Bujumbura"
            maxLength={100}
          />
        </label>
        <label>
          Maximum price
          <input
            name="maxPrice"
            type="number"
            min="1"
            placeholder="Any budget"
          />
        </label>
        <label>
          Currency
          <select name="currency">
            <option value="BIF">BIF</option>
            <option value="USD">USD</option>
            <option value="">All currencies</option>
          </select>
        </label>
        <label>
          Transmission
          <select name="transmission">
            <option value="">Any</option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <button className="product-button">Find a car</button>
        <details className="full-width">
          <summary>Year, mileage & fuel</summary>
          <div className="product-form-grid">
            <label>
              Year from
              <input type="number" name="minYear" min="1900" />
            </label>
            <label>
              Maximum kilometres
              <input type="number" name="maxMileage" min="0" />
            </label>
            <label>
              Fuel
              <select name="fuel">
                <option value="">Any</option>
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
                <option value="hybrid">Hybrid</option>
                <option value="electric">Electric</option>
              </select>
            </label>
          </div>
        </details>
      </form>
      <div className="product-toolbar">
        <h2>Find your next car</h2>
        <p>Real listings. Direct conversations.</p>
      </div>
      {error ? (
        <ErrorNotice message={error} retry={reload} />
      ) : loading ? (
        <Loading />
      ) : data?.vehicles.length ? (
        <>
          <div className="product-grid">
            {data.vehicles.map((car) => (
              <CarCard key={car.id} car={car} />
            ))}
          </div>
          <div className="product-pagination">
            {page > 1 && (
              <button
                className="product-button secondary"
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
            )}
            {data.hasMore && (
              <button
                className="product-button secondary"
                onClick={() => setPage(page + 1)}
              >
                Next page
              </button>
            )}
          </div>
        </>
      ) : (
        <Empty
          title={
            query
              ? "No cars match this search"
              : "The first listings start with you"
          }
        >
          <p>
            {query
              ? "Try another make, location, or price range."
              : "Urugo Cars is opening its doors. Published vehicles will appear here after review."}
          </p>
          <a className="product-button" href="/cars/manage">
            List a vehicle
          </a>
        </Empty>
      )}
      <section className="product-health-banner">
        <strong>A good purchase starts with a careful check.</strong>
        <span>
          Listing review is not a vehicle inspection or ownership guarantee.
          Inspect the car and documents in person before paying. Urugo does not
          collect vehicle deposits.
        </span>
      </section>
    </main>
  );
}
