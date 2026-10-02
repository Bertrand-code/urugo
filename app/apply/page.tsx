"use client";

import { FormEvent, useEffect, useState } from "react";

type Property = { id: string; name: string; neighborhood: string; kind: string; homes: number; occupied: number };

export default function ApplyPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [householdSize, setHouseholdSize] = useState("1");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch("/api/properties?public=1").then((response) => response.json()).then((result) => {
      const available = (result.properties ?? []).filter((property: Property) => property.homes > property.occupied);
      setProperties(available);
      if (available[0]) setPropertyId(available[0].id);
    }).catch(() => setError("We could not load available properties. Please try again."));
  }, []);

  const selected = properties.find((property) => property.id === propertyId);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, fullName, email, phone, moveInDate, householdSize: Number(householdSize), message }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "We could not send your application.");
      setSent(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not send your application."); }
    finally { setBusy(false); }
  }

  return <main className="public-page">
    <header className="public-header"><a className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>urugo</span></a><nav><a href="/contact">Contact us</a><a className="button button-light" href="/">Workspace</a></nav></header>
    <section className="public-main">
      <header><p className="kicker">RENTAL APPLICATION</p><h1>Find a place that feels like home.</h1><p>Choose an available property and share the details that help its property team get to know you. There is no fee to submit an application.</p></header>
      <div className="public-layout">
        <aside className="public-aside"><p className="kicker">YOUR NEXT STEP</p><h2>{selected ? selected.name : "Choose a home"}</h2><p>{selected ? selected.neighborhood + " · " + selected.kind : "Available homes are shown here when their property teams publish them."}</p>{selected && <dl><div><dt>AVAILABLE HOMES</dt><dd>{selected.homes - selected.occupied} of {selected.homes}</dd></div><div><dt>WHAT HAPPENS NEXT</dt><dd>The property team reviews your application.</dd></div><div><dt>NEED HELP?</dt><dd><a href="/contact">Contact Urugo</a></dd></div></dl>}</aside>
        {sent ? <section className="card form-success"><span>✓</span><p className="kicker">APPLICATION RECEIVED</p><h2>Thank you, {fullName.split(" ")[0]}.</h2><p>Your application for {selected?.name} is with the property team. They will contact you at {email} after review.</p><a className="button button-dark" href="/">Return to Urugo</a></section> : <form className="card public-form" onSubmit={submit}><p className="kicker">YOUR APPLICATION</p><h2>Tell us about yourself</h2><label>Property<select required value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="">Choose a property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name} · {property.neighborhood}</option>)}</select></label>{!properties.length && !error && <p className="form-hint">There are no published homes available to apply for today.</p>}<label>Your full name<input required autoFocus value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" /></label><div className="form-grid"><label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Phone number<input required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+257 …" /></label></div><div className="form-grid"><label>Preferred move-in<input type="date" value={moveInDate} onChange={(event) => setMoveInDate(event.target.value)} /></label><label>Household size<input required min="1" max="30" type="number" value={householdSize} onChange={(event) => setHouseholdSize(event.target.value)} /></label></div><label>Anything else we should know?<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Your preferred unit, work details, or questions for the property team…" /></label>{error && <p className="inline-error">{error}</p>}<button className="button button-dark" disabled={busy || !propertyId || !properties.length}>{busy ? "Sending…" : "Submit application"} <span>→</span></button></form>}
      </div>
    </section>
  </main>;
}
