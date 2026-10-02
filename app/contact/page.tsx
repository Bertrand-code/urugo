"use client";

import { FormEvent, useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("General question");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, subject, message }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "We could not send your message.");
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not send your message.");
    } finally { setBusy(false); }
  }

  return <main className="public-page">
    <header className="public-header"><a className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>urugo</span></a><nav><a href="/apply">Apply for a home</a><a className="button button-light" href="/">Workspace</a></nav></header>
    <section className="public-main">
      <header><p className="kicker">CONTACT URUGO</p><h1>Let’s make renting feel more straightforward.</h1><p>Ask a question about a property, getting started, or your tenancy. Our team will get back to you as soon as possible.</p></header>
      <div className="public-layout">
        <aside className="public-aside"><p className="kicker">HOW TO REACH US</p><h2>A helpful answer starts here.</h2><p>Tell us a little about what you need. Your message is sent directly to the Urugo team and kept with your inquiry record.</p><dl><div><dt>EMAIL</dt><dd><a href="mailto:btuyisenge40@gmail.com">btuyisenge40@gmail.com</a></dd></div><div><dt>LOCATION</dt><dd>Bujumbura, Burundi</dd></div><div><dt>RESPONSE TIME</dt><dd>Within one business day</dd></div></dl></aside>
        {sent ? <section className="card form-success"><span>✓</span><p className="kicker">MESSAGE SENT</p><h2>Thank you, {name.split(" ")[0]}.</h2><p>Your inquiry has reached our team. We will reply to {email} as soon as possible.</p><a className="button button-dark" href="/">Return to Urugo</a></section> : <form className="card public-form" onSubmit={submit}><p className="kicker">SEND A MESSAGE</p><h2>How can we help?</h2><label>Your name<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" /></label><div className="form-grid"><label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Phone number <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+257 …" /></label></div><label>Topic<select value={subject} onChange={(event) => setSubject(event.target.value)}><option>General question</option><option>Property management</option><option>Rental application</option><option>Resident support</option><option>Partnership</option></select></label><label>Your message<textarea required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us what you need…" /></label>{error && <p className="inline-error">{error}</p>}<button className="button button-dark" disabled={busy}>{busy ? "Sending…" : "Send message"} <span>→</span></button></form>}
      </div>
    </section>
  </main>;
}
