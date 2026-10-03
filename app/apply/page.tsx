"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { readJson } from "@/lib/http";
const steps = [
  "Personal information",
  "Household",
  "Income & employment",
  "Rental history",
  "Review & submit",
];
type Profile = Record<string, string>;
type Listing = { id: string; name: string; neighborhood: string };
export default function ApplyPage() {
  const [properties, setProperties] = useState<Listing[]>([]),
    [propertyId, setPropertyId] = useState(""),
    [unitId, setUnitId] = useState(""),
    [id, setId] = useState(""),
    [profile, setProfile] = useState<Profile>({}),
    [email, setEmail] = useState(""),
    [size, setSize] = useState("1"),
    [moveIn, setMoveIn] = useState(""),
    [message, setMessage] = useState(""),
    [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [sent, setSent] = useState(false);
  const savingRef = useRef<Promise<unknown>>(Promise.resolve());
  const submittingRef = useRef(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setPropertyId(query.get("listing") || "");
    setUnitId(query.get("unit") || "");
    void Promise.all([
      fetch("/api/properties?public=1").then(
        readJson<{ properties: Listing[] }>,
      ),
      fetch("/api/profile").then(readJson<{ profile: Profile; email: string }>),
    ])
      .then(async ([list, me]) => {
        setProperties(list.properties);
        setProfile(me.profile);
        setEmail(me.email);
        const appId = query.get("application");
        if (appId) {
          const saved = await fetch("/api/applications/" + appId).then(
            readJson<{
              application: {
                property_id: string;
                unit_id: string;
                household_size: number;
                move_in_date: string;
                message: string;
                full_name: string;
                phone: string;
                stage: string;
              };
              profile: Profile;
            }>,
          );
          if (!["draft", "needs_information"].includes(saved.application.stage))
            throw Error(
              "This application is already submitted. Track it in My Applications.",
            );
          setId(appId);
          setPropertyId(saved.application.property_id);
          setUnitId(saved.application.unit_id || "");
          setProfile({
            ...saved.profile,
            fullName: saved.application.full_name,
            phone: saved.application.phone,
          });
          setSize(String(saved.application.household_size));
          setMoveIn(saved.application.move_in_date || "");
          setMessage(saved.application.message);
        }
        setReady(true);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!id || !ready || sent) return;
    setSaving("Unsaved changes");
    const timer = setTimeout(() => {
      if (submittingRef.current) return;
      setSaving("Saving…");
      const payload = {
        stage: "draft",
        fullName: profile.fullName,
        phone: profile.phone,
        householdSize: Number(size),
        moveInDate: moveIn,
        message,
        profile,
      };
      savingRef.current = savingRef.current
        .catch(() => {})
        .then(() =>
          fetch("/api/applications/" + id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).then(readJson),
        )
        .then(() => setSaving("Saved to your account"))
        .catch((e) => {
          setSaving("Save failed — try again");
          setError(e.message);
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [id, profile, size, moveIn, message, ready, sent]);
  async function start(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, unitId, draft: true, profile }),
      }).then(readJson<{ application: { id: string } }>);
      window.location.href = "/apply?application=" + result.application.id;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function submit() {
    submittingRef.current = true;
    setBusy(true);
    setError("");
    try {
      await savingRef.current;
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      }).then(readJson);
      await fetch("/api/applications/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "submitted",
          fullName: profile.fullName,
          phone: profile.phone,
          householdSize: Number(size),
          moveInDate: moveIn,
          message,
          profile,
        }),
      }).then(readJson);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }
  async function saveAndLeave() {
    submittingRef.current = true;
    setBusy(true);
    setError("");
    try {
      await savingRef.current;
      await fetch("/api/applications/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "draft",
          fullName: profile.fullName,
          phone: profile.phone,
          householdSize: Number(size),
          moveInDate: moveIn,
          message,
          profile,
        }),
      }).then(readJson);
      window.location.href = "/?mode=personal&tab=myApplications";
    } catch (error) {
      setError((error as Error).message);
      submittingRef.current = false;
      setBusy(false);
    }
  }
  const field = (key: string, name: string, multiline = false) => (
    <label key={key}>
      {name}
      {multiline ? (
        <textarea
          value={profile[key] || ""}
          onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
        />
      ) : (
        <input
          value={profile[key] || ""}
          onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
        />
      )}
    </label>
  );
  return (
    <main className="public-page">
      <header className="public-header">
        <a className="brand" href="/discover">
          urugo
        </a>
        <nav>
          <a href="/discover">Explore</a>
          <a href="/?mode=personal&tab=myApplications">My Applications</a>
          <a href="/contact">Help</a>
        </nav>
      </header>
      <section className="public-main">
        <header>
          <p className="kicker">YOUR NEXT CHAPTER</p>
          <h1>A little closer to home.</h1>
          <p>
            Your profile stays with you. Save your progress and come back when
            you’re ready.
          </p>
        </header>
        {error && (
          <p className="inline-error" role="alert">
            {error}{" "}
            <a href="/signin-with-chatgpt?return_to=%2Fapply">Sign in</a>
          </p>
        )}
        {!ready && !error && <p role="status">Loading your profile…</p>}
        {sent ? (
          <section className="card review-panel">
            <h2>Application submitted.</h2>
            <p>
              The property team can now review your application. Approval does
              not activate a tenancy; leasing and move-in come next.
            </p>
            <a
              className="button button-dark"
              href="/?mode=personal&tab=myApplications"
            >
              Track my application →
            </a>
          </section>
        ) : ready && !id ? (
          <form className="card public-form" onSubmit={start}>
            <h2>Choose your next home</h2>
            <label>
              Property
              <select
                required
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  setUnitId("");
                }}
              >
                <option value="">Choose a published property</option>
                {properties.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name} · {p.neighborhood}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Choose a specific unit from its property listing, or start a
              property-level application here.
            </p>
            <button className="button button-dark" disabled={busy}>
              Start saved application →
            </button>
          </form>
        ) : (
          id && (
            <div className="application-layout">
              <aside className="card application-progress">
                <p className="kicker">
                  {properties.find((p) => p.id === propertyId)?.name ||
                    "YOUR APPLICATION"}
                </p>
                <strong>
                  {Math.round(((step + 1) / steps.length) * 100)}% of steps
                  visited
                </strong>
                <progress value={step + 1} max={steps.length} />
                <ol>
                  {steps.map((name, index) => (
                    <li key={name}>
                      <button
                        aria-current={step === index ? "step" : undefined}
                        onClick={() => setStep(index)}
                      >
                        {index < step ? "✓" : index + 1} {name}
                      </button>
                    </li>
                  ))}
                </ol>
                <p role="status">{saving}</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveAndLeave()}
                >
                  Save and continue later
                </button>
              </aside>
              <section className="card public-form">
                <p className="kicker">
                  STEP {step + 1} OF {steps.length}
                </p>
                <h2>{steps[step]}</h2>
                {step === 0 && (
                  <>
                    {field("fullName", "Legal full name")}
                    {field("phone", "Phone number")}
                    <label>
                      Account email
                      <input readOnly value={email} />
                    </label>
                    <label>
                      Preferred move-in date
                      <input
                        type="date"
                        value={moveIn}
                        onChange={(e) => setMoveIn(e.target.value)}
                      />
                    </label>
                  </>
                )}
                {step === 1 && (
                  <>
                    <label>
                      Household size
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                      />
                    </label>
                    {field(
                      "household",
                      "Household members and relationships",
                      true,
                    )}
                    {field("pets", "Pets")}
                    {field("vehicles", "Vehicles")}
                  </>
                )}
                {step === 2 && (
                  <>
                    {field("employment", "Employment details", true)}
                    {field("income", "Income summary")}
                    <p className="form-hint">
                      Do not include bank account numbers, identity numbers, or
                      sensitive documents here.
                    </p>
                  </>
                )}
                {step === 3 && (
                  <>
                    {field("rentalHistory", "Rental history", true)}
                    {field("references", "References", true)}
                  </>
                )}
                {step === 4 && (
                  <>
                    <dl className="detail-dl">
                      {Object.entries(profile)
                        .filter(([, value]) => value)
                        .map(([key, value]) => (
                          <div key={key}>
                            <dt>{key}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                    </dl>
                    <label>
                      Questions for the property team
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                    </label>
                    <p>
                      Submitting shares this profile snapshot with this
                      property’s authorized leasing team. Screening and any
                      additional document requests are coordinated by that team.
                    </p>
                  </>
                )}
                <div className="form-actions">
                  <button
                    className="button button-light"
                    disabled={step === 0 || busy}
                    onClick={() => setStep(step - 1)}
                  >
                    Back
                  </button>
                  {step < steps.length - 1 ? (
                    <button
                      className="button button-dark"
                      onClick={() => setStep(step + 1)}
                    >
                      Continue →
                    </button>
                  ) : (
                    <button
                      className="button button-dark"
                      disabled={busy || !profile.fullName || !profile.phone}
                      onClick={() => void submit()}
                    >
                      {busy ? "Submitting…" : "Submit application"}
                    </button>
                  )}
                </div>
              </section>
            </div>
          )
        )}
      </section>
    </main>
  );
}
