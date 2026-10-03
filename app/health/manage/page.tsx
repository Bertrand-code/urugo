"use client";
import { useState } from "react";
import {
  ActionButton,
  ActionForm,
  burundiTime,
  dateTime,
  Empty,
  ErrorNotice,
  Input,
  Loading,
  mutate,
  Pill,
  Select,
  Textarea,
  useResource,
} from "../../components/products";
import type { HealthWorkspace, Facility } from "../types";
function FacilitySelect({
  facilities,
  kind,
}: {
  facilities: Facility[];
  kind?: string;
}) {
  return (
    <Select
      name="facility_id"
      label={
        kind === "pharmacy"
          ? "Pharmacy"
          : kind === "clinic"
            ? "Clinic"
            : "Provider"
      }
      values={facilities
        .filter((f) => !kind || f.kind === kind)
        .map((f) => [f.id, f.name])}
    />
  );
}
export default function Providers() {
  const { data, error, loading, reload } =
      useResource<HealthWorkspace>("/api/health/me"),
    [selected, setSelected] = useState("");
  const scope = <T extends { facility_id: string }>(records: T[]) =>
    records.filter((r) => !selected || r.facility_id === selected);
  const pharmacies =
      data?.facilities.filter((f) => f.kind === "pharmacy") || [],
    clinics = data?.facilities.filter((f) => f.kind === "clinic") || [],
    owners = data?.facilities.filter((f) => f.can_manage_team) || [];
  return (
    <main className="product-main">
      <section className="product-hero">
        <div>
          <div className="product-eyebrow">PROVIDER WORKSPACE</div>
          <h1>
            Help people plan
            <br />
            their next step.
          </h1>
          <p>
            Keep medicine availability current, confirm requests, and manage
            appointment times. Only your explicitly assigned team can see
            patient requests.
          </p>
        </div>
        <aside className="product-hero-note">
          <strong>Current information matters.</strong>
          <p>
            Availability older than 24 hours is marked stale. Confirm only stock
            you have checked and appointments your clinic can honour.
          </p>
          <button
            className="product-button secondary"
            onClick={reload}
            disabled={loading}
          >
            Refresh workspace
          </button>
        </aside>
      </section>
      {error ? (
        <ErrorNotice message={error} retry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            <details className="product-details">
              <summary>+ Register a pharmacy or clinic</summary>
              <div>
                <p className="product-help">
                  Register only a business you are authorized to represent.
                  Urugo must independently check its licence and business
                  contact before it becomes public. Registration alone does not
                  verify a provider.
                </p>
                <ActionForm
                  submit="Submit provider for review"
                  success="Registration saved. Prepare inventory or slots while your provider is reviewed."
                  reset
                  onSubmit={async (body) => {
                    await mutate("/api/health/facilities", body);
                    await reload();
                  }}
                >
                  <div className="product-form-grid">
                    <Input
                      name="name"
                      label="Registered business name"
                      maxLength={150}
                    />
                    <Select
                      name="kind"
                      label="Provider type"
                      values={[
                        ["pharmacy", "Pharmacy"],
                        ["clinic", "Clinic"],
                      ]}
                    />
                    <Input name="city" label="City / town" maxLength={100} />
                    <Input
                      name="address"
                      label="Public address"
                      maxLength={250}
                    />
                    <Input
                      name="phone"
                      label="Public business phone"
                      type="tel"
                      maxLength={50}
                    />
                    <Input
                      name="license"
                      label="Professional / facility licence reference"
                      maxLength={150}
                    />
                    <Input
                      name="hours"
                      label="Opening hours (Burundi time)"
                      maxLength={300}
                      placeholder="Mon–Fri 08:00–18:00; Sat 08:00–13:00"
                    />
                    <label className="product-check">
                      <input name="authorized" type="checkbox" required />I am
                      authorized to represent this provider and agree to
                      independent verification.
                    </label>
                  </div>
                </ActionForm>
              </div>
            </details>
            <section className="product-section">
              <h2>Your providers</h2>
              {!data.facilities.length ? (
                <Empty title="A dedicated space for your team">
                  <p>
                    Register a pharmacy or clinic above. Home ownership,
                    property roles, and car listings never grant access to
                    health requests.
                  </p>
                </Empty>
              ) : (
                <>
                  <label>
                    Active provider context
                    <select
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      <option value="">All my providers</option>
                      {data.facilities.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {data.facilities
                    .filter((f) => !selected || f.id === selected)
                    .map((f) => (
                      <article className="product-panel" key={f.id}>
                        <div className="product-heading-row">
                          <div>
                            <h3>{f.name}</h3>
                            <p>
                              {f.kind} · {f.address}, {f.city}
                              <br />
                              {f.phone} · {f.hours}
                            </p>
                          </div>
                          <Pill value={f.status} />
                        </div>
                        {f.status !== "verified" && (
                          <div className="product-notice">
                            Not publicly listed.{" "}
                            {f.status === "pending"
                              ? "Prepare your catalog while verification is pending."
                              : "Contact Urugo to resolve this provider’s suspension."}
                          </div>
                        )}
                        {f.review_note && (
                          <p>Verification feedback: {f.review_note}</p>
                        )}
                        {f.can_manage_team === 1 && (
                          <details className="product-details">
                            <summary>Update opening hours</summary>
                            <div>
                              <ActionForm
                                onSubmit={async (body) => {
                                  await mutate(
                                    "/api/health/facilities/" + f.id,
                                    { ...body, action: "contact" },
                                    "PATCH",
                                  );
                                  await reload();
                                }}
                              >
                                <Input
                                  name="hours"
                                  label="Opening hours (Burundi time)"
                                  defaultValue={f.hours}
                                  maxLength={300}
                                />
                              </ActionForm>
                              <p className="product-help">
                                Contact Urugo to change verified identity,
                                address, or licence details.
                              </p>
                            </div>
                          </details>
                        )}
                      </article>
                    ))}
                </>
              )}
            </section>
            {pharmacies.length > 0 && (
              <>
                <section className="product-section">
                  <h2>Medicine catalog & stock checks</h2>
                  <details className="product-details">
                    <summary>+ Add a medicine listing</summary>
                    <div>
                      <ActionForm
                        submit="Add medicine"
                        reset
                        onSubmit={async (body) => {
                          await mutate("/api/health/inventory", body);
                          await reload();
                        }}
                      >
                        <div className="product-form-grid">
                          <FacilitySelect facilities={pharmacies} />
                          <Input
                            label="Medicine / brand name"
                            name="name"
                            maxLength={150}
                          />
                          <Input
                            label="Generic name (optional)"
                            name="generic_name"
                            required={false}
                            maxLength={150}
                          />
                          <Input
                            label="Exact strength"
                            name="strength"
                            maxLength={80}
                            placeholder="As printed on the packaging"
                          />
                          <Input
                            label="Dosage form"
                            name="form"
                            maxLength={80}
                            placeholder="Tablet, capsule, solution…"
                          />
                          <Select
                            label="Current availability"
                            name="availability"
                            values={[
                              ["unknown", "Not checked"],
                              ["available", "Available — checked by provider"],
                              ["unavailable", "Unavailable"],
                            ]}
                          />
                        </div>
                      </ActionForm>
                    </div>
                  </details>
                  {!scope(data.inventory).length ? (
                    <Empty title="Start with the medicines you can keep current">
                      <p>
                        Add exact names, strengths, and forms. Patients will ask
                        you to confirm before making a trip.
                      </p>
                    </Empty>
                  ) : (
                    scope(data.inventory).map((i) => (
                      <div className="product-panel" key={i.id}>
                        <div className="product-heading-row">
                          <div>
                            <h3>
                              {i.name} · {i.strength} · {i.form}
                            </h3>
                            <p>
                              {i.facility_name}
                              {i.generic_name ? " · " + i.generic_name : ""}
                              <br />
                              Last checked {dateTime(i.updated_at)}
                            </p>
                          </div>
                          <Pill value={i.availability} />
                        </div>
                        <div className="product-actions">
                          {[
                            ["available", "Checked: available"],
                            ["unavailable", "Checked: unavailable"],
                            ["unknown", "Not sure"],
                          ].map(([status, label]) => (
                            <ActionButton
                              key={status}
                              url={"/api/health/inventory/" + i.id}
                              body={{ availability: status }}
                              onDone={reload}
                            >
                              {label}
                            </ActionButton>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </section>
                <section className="product-section">
                  <h2>Pharmacy requests</h2>
                  {!scope(data.requests).length ? (
                    <Empty title="No pharmacy requests yet">
                      <p>
                        When people request an availability check, respond here.
                        Confirmed holds are separate from public stock status.
                      </p>
                    </Empty>
                  ) : (
                    scope(data.requests).map((r) => (
                      <article className="product-panel" key={r.id}>
                        <div className="product-heading-row">
                          <div>
                            <h3>
                              {r.name} · {r.strength} · {r.form}
                            </h3>
                            <p>
                              {r.patient_name} · {r.facility_name}
                              <br />
                              Requested {dateTime(r.created_at)}
                            </p>
                          </div>
                          <Pill value={r.status} />
                        </div>
                        {r.status === "requested" && (
                          <ActionForm
                            submit="Confirm stock & collection window"
                            success="The patient can now see your confirmation."
                            onSubmit={async (body) => {
                              await mutate(
                                "/api/health/requests/" + r.id,
                                {
                                  status: "confirmed",
                                  hold_until: burundiTime(body.hold_until),
                                },
                                "PATCH",
                              );
                              await reload();
                            }}
                          >
                            <Input
                              type="datetime-local"
                              name="hold_until"
                              label="Hold until (Burundi time, within 48 hours)"
                            />
                            <p className="product-help">
                              Confirm only after checking the exact product.
                              This hold does not replace prescription checks or
                              dispensing requirements.
                            </p>
                          </ActionForm>
                        )}
                        {r.status === "confirmed" && r.hold_until && (
                          <div className="product-notice">
                            Hold until {dateTime(r.hold_until)}
                          </div>
                        )}
                        <div className="product-actions">
                          {r.status === "confirmed" && (
                            <ActionButton
                              url={"/api/health/requests/" + r.id}
                              body={{ status: "collected" }}
                              confirm="Has the patient collected this item?"
                              onDone={reload}
                            >
                              Mark collected
                            </ActionButton>
                          )}
                          {["requested", "confirmed"].includes(r.status) && (
                            <>
                              <ActionButton
                                url={"/api/health/requests/" + r.id}
                                body={{ status: "unavailable" }}
                                onDone={reload}
                              >
                                Cannot supply
                              </ActionButton>
                              <ActionButton
                                url={"/api/health/requests/" + r.id}
                                body={{ status: "cancelled" }}
                                confirm="Cancel this request? The patient will see the cancellation."
                                onDone={reload}
                              >
                                Cancel
                              </ActionButton>
                            </>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </section>
              </>
            )}
            {clinics.length > 0 && (
              <>
                <section className="product-section">
                  <h2>Clinic schedule</h2>
                  <details className="product-details">
                    <summary>+ Publish an appointment time</summary>
                    <div>
                      <ActionForm
                        submit="Add appointment slot"
                        reset
                        onSubmit={async (body) => {
                          await mutate("/api/health/slots", {
                            ...body,
                            starts_at: burundiTime(body.starts_at),
                            ends_at: burundiTime(body.ends_at),
                          });
                          await reload();
                        }}
                      >
                        <div className="product-form-grid">
                          <FacilitySelect facilities={clinics} />
                          <Input
                            name="service"
                            label="Service / consultation type"
                            maxLength={120}
                          />
                          <Input
                            name="practitioner"
                            label="Practitioner name"
                            maxLength={120}
                          />
                          <Input
                            name="starts_at"
                            label="Starts (Burundi time, CAT)"
                            type="datetime-local"
                          />
                          <Input
                            name="ends_at"
                            label="Ends (Burundi time, CAT)"
                            type="datetime-local"
                          />
                        </div>
                        <p className="product-help">
                          Each slot accepts one request at a time. Slots become
                          publicly available only when the clinic is verified.
                          All times use UTC+2, regardless of your device
                          timezone.
                        </p>
                      </ActionForm>
                    </div>
                  </details>
                  {!scope(data.slots).length ? (
                    <Empty title="Open your first appointment time">
                      <p>
                        Publish the times your practitioners can honour. You
                        will still review each patient request.
                      </p>
                    </Empty>
                  ) : (
                    scope(data.slots).map((s) => (
                      <div className="product-list-row" key={s.id}>
                        <div>
                          <h3>
                            {s.service} · {s.practitioner}
                          </h3>
                          <p className="product-help">
                            {s.facility_name} · {dateTime(s.starts_at)} —{" "}
                            {dateTime(s.ends_at)}
                          </p>
                        </div>
                        <div className="product-actions">
                          <Pill value={s.status} />
                          {s.status === "open" && (
                            <ActionButton
                              url={"/api/health/slots/" + s.id}
                              body={{ status: "closed" }}
                              onDone={reload}
                              confirm="Close this slot? Any active appointment request or confirmation for this time will be cancelled."
                            >
                              Close slot
                            </ActionButton>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </section>
                <section className="product-section">
                  <h2>Appointment requests</h2>
                  {!scope(data.appointments).length ? (
                    <Empty title="No appointments to review">
                      <p>
                        Patient requests appear here when someone selects a
                        published time.
                      </p>
                    </Empty>
                  ) : (
                    scope(data.appointments).map((r) => (
                      <article className="product-panel" key={r.id}>
                        <div className="product-heading-row">
                          <div>
                            <h3>
                              {r.patient_name} · {r.service}
                            </h3>
                            <p>
                              {r.facility_name} · {r.practitioner}
                              <br />
                              {dateTime(r.starts_at)} — {dateTime(r.ends_at)}
                            </p>
                          </div>
                          <Pill value={r.status} />
                        </div>
                        <div className="product-actions">
                          {r.status === "requested" && (
                            <>
                              <ActionButton
                                url={"/api/health/appointments/" + r.id}
                                body={{ status: "confirmed" }}
                                onDone={reload}
                              >
                                Confirm appointment
                              </ActionButton>
                              <ActionButton
                                url={"/api/health/appointments/" + r.id}
                                body={{ status: "declined" }}
                                onDone={reload}
                              >
                                Decline
                              </ActionButton>
                            </>
                          )}
                          {r.status === "confirmed" && (
                            <ActionButton
                              url={"/api/health/appointments/" + r.id}
                              body={{ status: "completed" }}
                              onDone={reload}
                            >
                              Mark completed
                            </ActionButton>
                          )}
                          {["requested", "confirmed"].includes(r.status) && (
                            <ActionButton
                              url={"/api/health/appointments/" + r.id}
                              body={{ status: "cancelled" }}
                              confirm="Cancel this appointment? The patient will see the cancellation."
                              onDone={reload}
                            >
                              Cancel
                            </ActionButton>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </section>
              </>
            )}
            {owners.length > 0 && (
              <section className="product-section">
                <h2>Provider team & access</h2>
                <p className="product-help">
                  Add only authorized staff. This grants access to that
                  provider’s catalog, appointments, and patient requests. Staff
                  cannot verify providers or manage team access. Accounts must
                  already exist; no email invitation is sent.
                </p>
                <details className="product-details">
                  <summary>+ Add authorized team member</summary>
                  <div>
                    <ActionForm
                      submit="Grant provider access"
                      reset
                      onSubmit={async (body) => {
                        await mutate("/api/health/team", body);
                        await reload();
                      }}
                    >
                      <div className="product-form-grid">
                        <FacilitySelect facilities={owners} />
                        <Input
                          label="Existing Urugo account email"
                          name="email"
                          type="email"
                          maxLength={254}
                        />
                        <label className="product-check full-width">
                          <input type="checkbox" required />I have confirmed
                          that this person is authorized to access this
                          provider’s patient requests.
                        </label>
                      </div>
                    </ActionForm>
                  </div>
                </details>
                {scope(data.staff).map((m) => (
                  <div className="product-list-row" key={m.id}>
                    <div>
                      <h3>{m.display_name}</h3>
                      <p className="product-help">
                        {m.email} ·{" "}
                        {owners.find((f) => f.id === m.facility_id)?.name}
                      </p>
                    </div>
                    <div className="product-actions">
                      <Pill value={m.status} />
                      <ActionButton
                        url={"/api/health/team/" + m.id}
                        body={{
                          status: m.status === "active" ? "revoked" : "active",
                        }}
                        onDone={reload}
                        confirm={
                          m.status === "active"
                            ? "Revoke access immediately?"
                            : "Restore this person’s access to this provider?"
                        }
                      >
                        {m.status === "active"
                          ? "Revoke access"
                          : "Restore access"}
                      </ActionButton>
                    </div>
                  </div>
                ))}
              </section>
            )}
            {data.isAdmin && (
              <section className="product-section">
                <h2>Provider verification desk</h2>
                <div className="product-notice">
                  Platform review access includes business registration details,
                  not unrelated patient requests. Verify the licence and the
                  organization’s contact independently before approving. Never
                  verify a provider just to populate the marketplace.
                </div>
                {!data.review.length ? (
                  <Empty title="No providers awaiting review">
                    <p>
                      New registrations appear here for a manual licence and
                      business-contact check.
                    </p>
                  </Empty>
                ) : (
                  data.review.map((f) => (
                    <article className="product-panel" key={f.id}>
                      <div className="product-heading-row">
                        <div>
                          <h3>{f.name}</h3>
                          <p>
                            {f.kind} · {f.address}, {f.city}
                            <br />
                            {f.phone}
                            <br />
                            Licence reference: {f.license}
                          </p>
                        </div>
                        <Pill value={f.status} />
                      </div>
                      {f.review_note && <p>Previous review: {f.review_note}</p>}
                      <details className="product-details">
                        <summary>
                          {f.status === "verified"
                            ? "Suspend publication"
                            : "Review provider"}
                        </summary>
                        <div>
                          <ActionForm
                            submit="Save verification decision"
                            onSubmit={async (body) => {
                              await mutate(
                                "/api/health/facilities/" + f.id,
                                {
                                  ...body,
                                  action: "review",
                                  attested: body.attested === "on",
                                },
                                "PATCH",
                              );
                              await reload();
                            }}
                          >
                            <Select
                              label="Decision"
                              name="status"
                              values={
                                f.status === "verified"
                                  ? [["suspended", "Suspend publication"]]
                                  : [
                                      ["verified", "Verify for publication"],
                                      ["suspended", "Do not publish / suspend"],
                                    ]
                              }
                            />
                            <Textarea
                              label="Verification evidence / reason (shared with provider)"
                              name="note"
                              maxLength={500}
                            />
                            <label className="product-check">
                              <input name="attested" type="checkbox" />
                              For approval: I independently checked this
                              provider’s licence and business contact. This is
                              not an automated licence check.
                            </label>
                          </ActionForm>
                          <p className="product-help">
                            Suspension hides inventory and slots and cancels
                            outstanding patient requests and appointments.
                          </p>
                        </div>
                      </details>
                    </article>
                  ))
                )}
              </section>
            )}
          </>
        )
      )}
    </main>
  );
}
