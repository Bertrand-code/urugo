"use client";
import { useState, type FormEvent } from "react";
import {
  ActionButton,
  dateTime,
  Empty,
  ErrorNotice,
  Loading,
  Pill,
  useResource,
} from "../components/products";
import type { Facility, Medicine, Slot } from "./types";
export default function Health() {
  const [tab, setTab] = useState("medicines"),
    [query, setQuery] = useState(""),
    [notice, setNotice] = useState("");
  const { data, error, loading, reload } = useResource<{
    facilities: Facility[];
    inventory: Medicine[];
    slots: Slot[];
  }>("/api/health/search?" + query);
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setQuery(
      new URLSearchParams(
        new FormData(e.currentTarget) as unknown as Record<string, string>,
      ).toString(),
    );
    setNotice("");
  }
  const count =
    tab === "medicines"
      ? data?.inventory.length
      : tab === "appointments"
        ? data?.slots.length
        : data?.facilities.length;
  return (
    <main className="product-main">
      <section className="product-hero">
        <div>
          <div className="product-eyebrow">URUGO HEALTH · BURUNDI</div>
          <h1>
            A little certainty.
            <br />
            Before the journey.
          </h1>
          <p>
            Check with a pharmacy before you travel. Find a clinic and request
            an appointment. Keep your next step clear.
          </p>
        </div>
        <aside className="product-hero-note">
          <strong>Ask first. Get confirmation.</strong>
          <p>
            Stock listings can change. A request is not a reservation or an
            appointment until the provider confirms it.
          </p>
          <a className="product-text-link" href="/health/requests">
            Track my requests ↗
          </a>
        </aside>
      </section>
      <div className="product-tabs" aria-label="Search type">
        {[
          ["medicines", "Find medicine"],
          ["appointments", "Find an appointment"],
          ["providers", "Pharmacies & clinics"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id);
              setQuery("");
              setNotice("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <form key={tab} className="product-search" onSubmit={search}>
        <label>
          {tab === "medicines"
            ? "Medicine, strength, or form"
            : tab === "appointments"
              ? "Service, practitioner, or clinic"
              : "Pharmacy or clinic name"}
          <input
            name={tab === "providers" ? "provider" : "q"}
            maxLength={100}
            placeholder={
              tab === "medicines"
                ? "Enter the exact medicine on your prescription"
                : tab === "appointments"
                  ? "Search published services"
                  : "Provider name"
            }
          />
        </label>
        <label>
          City / town
          <input name="city" maxLength={100} placeholder="Bujumbura, Gitega…" />
        </label>
        <button className="product-button">Search</button>
      </form>
      {notice && (
        <div className="product-notice" role="status">
          {notice}{" "}
          <a href="/health/requests" className="product-text-link">
            View my requests
          </a>
        </div>
      )}
      <div className="product-toolbar">
        <h2>
          {tab === "medicines"
            ? "Pharmacy availability"
            : tab === "appointments"
              ? "Available appointment times"
              : "Participating providers"}
        </h2>
        <p>
          {count !== undefined
            ? `${count} result${count === 1 ? "" : "s"}${count === 100 ? " · Refine your search for more" : ""}`
            : ""}
        </p>
      </div>
      {error ? (
        <ErrorNotice message={error} retry={reload} />
      ) : loading ? (
        <Loading />
      ) : !count ? (
        <Empty
          title={
            tab === "medicines"
              ? "No matching pharmacy listings yet"
              : tab === "appointments"
                ? "No appointment times found"
                : "No matching providers yet"
          }
        >
          <p>
            Try a different search or check back as providers join.
            <br />
            We only show participating providers approved for publication.
          </p>
          <a href="/health/manage" className="product-button secondary">
            Register a pharmacy or clinic
          </a>
        </Empty>
      ) : (
        <div className="product-grid">
          {tab === "medicines" &&
            data?.inventory.map((i) => (
              <article key={i.id} className="product-card">
                <div className="product-heading-row">
                  <span className="product-eyebrow">{i.city}</span>
                  <Pill value={i.stale ? "stale" : i.availability} />
                </div>
                <h3>{i.name}</h3>
                <p>
                  <strong>
                    {i.strength} · {i.form}
                  </strong>
                  {i.generic_name && (
                    <>
                      <br />
                      Generic: {i.generic_name}
                    </>
                  )}
                </p>
                <p>
                  <strong>{i.facility_name}</strong>
                  <br />
                  {i.address}
                  <br />
                  {i.hours}
                </p>
                <p className="product-help">
                  Provider updated: {dateTime(i.updated_at)}
                  <br />
                  {i.stale
                    ? "More than 24 hours old. Availability needs checking."
                    : "Provider-reported stock. Not a live inventory guarantee."}
                </p>
                <ActionButton
                  method="POST"
                  url="/api/health/requests"
                  body={{ inventory_id: i.id }}
                  confirm={`Ask ${i.facility_name} to confirm ${i.name}, ${i.strength}, ${i.form}? Your account name and selected medicine will be shared with this pharmacy.`}
                  onDone={() =>
                    setNotice(
                      "Request sent. Wait for the pharmacy to confirm before travelling.",
                    )
                  }
                >
                  Ask pharmacy to confirm
                </ActionButton>
                <p className="product-help">
                  <a href={"tel:" + i.phone}>Call pharmacy: {i.phone}</a>
                </p>
              </article>
            ))}
          {tab === "appointments" &&
            data?.slots.map((s) => (
              <article key={s.id} className="product-card">
                <span className="product-eyebrow">{s.city} · CLINIC</span>
                <h3>{s.service}</h3>
                <p>
                  <strong>{s.practitioner}</strong>
                  <br />
                  {s.facility_name}
                  <br />
                  {s.address}
                </p>
                <div className="product-notice">
                  {dateTime(s.starts_at)}
                  <br />
                  Ends {dateTime(s.ends_at)}
                </div>
                <ActionButton
                  method="POST"
                  url="/api/health/appointments"
                  body={{ slot_id: s.id }}
                  confirm={`Request ${s.service} at ${s.facility_name} on ${dateTime(s.starts_at)}? Your account name will be shared with the clinic. This is not confirmed until the clinic accepts.`}
                  onDone={() => {
                    setNotice(
                      "Appointment requested. The clinic must confirm it before you travel.",
                    );
                    void reload();
                  }}
                >
                  Request appointment
                </ActionButton>
                <p className="product-help">
                  All times shown in Burundi time (CAT, UTC+2).
                  <br />
                  <a href={"tel:" + s.phone}>Contact clinic: {s.phone}</a>
                </p>
              </article>
            ))}
          {tab === "providers" &&
            data?.facilities.map((f) => (
              <article key={f.id} className="product-card">
                <div className="product-heading-row">
                  <span className="product-eyebrow">
                    {f.kind} · {f.city}
                  </span>
                  <Pill value="verified" />
                </div>
                <h3>{f.name}</h3>
                <p>
                  {f.address}
                  <br />
                  {f.hours}
                </p>
                <a className="product-button secondary" href={"tel:" + f.phone}>
                  Call {f.phone}
                </a>
                <p className="product-help">
                  Business details reviewed by Urugo. This is not an endorsement
                  of clinical quality.
                </p>
              </article>
            ))}
        </div>
      )}
      <section className="product-health-banner">
        <strong>Coordination, not medical advice.</strong>
        <span>
          Urugo does not prescribe, recommend substitutions, sell medicines, or
          provide emergency care. Contact a qualified professional for medical
          advice. For urgent care, contact local emergency services or a nearby
          medical facility directly.
        </span>
      </section>
      <section className="product-panel">
        <div className="product-heading-row">
          <div>
            <div className="product-eyebrow">FOR PHARMACIES & CLINICS</div>
            <h3>Help people arrive informed.</h3>
            <p>
              Keep availability current, respond to requests, and publish
              appointment times from a separate provider workspace.
            </p>
          </div>
          <a className="product-button secondary" href="/health/manage">
            Join as a provider
          </a>
        </div>
      </section>
    </main>
  );
}
