"use client";
import {
  ActionButton,
  dateTime,
  Empty,
  ErrorNotice,
  Loading,
  Pill,
  useResource,
} from "../../components/products";
import type { HealthWorkspace } from "../types";
export default function Requests() {
  const { data, error, loading, reload } =
    useResource<HealthWorkspace>("/api/health/me");
  return (
    <main className="product-main">
      <section className="product-hero">
        <div>
          <div className="product-eyebrow">YOUR HEALTH REQUESTS</div>
          <h1>Know your next step.</h1>
          <p>
            Track pharmacy confirmations and appointment requests. Your requests
            are shared only with you and the relevant provider team.
          </p>
        </div>
        <aside className="product-hero-note">
          <strong>Check before you leave.</strong>
          <p>
            Only a confirmed request gives you a provider’s commitment. Check
            the time, address, and any hold expiry.
          </p>
          <button
            className="product-button secondary"
            onClick={reload}
            disabled={loading}
          >
            Refresh status
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
            <section className="product-section">
              <h2>Pharmacy requests</h2>
              {!data.mine.length ? (
                <Empty title="No pharmacy requests yet">
                  <p>
                    Find the exact medicine, strength, and form, then ask a
                    pharmacy to confirm.
                  </p>
                  <a className="product-button" href="/health">
                    Find medicine
                  </a>
                </Empty>
              ) : (
                data.mine.map((r) => (
                  <article key={r.id} className="product-panel">
                    <div className="product-heading-row">
                      <div>
                        <h3>
                          {r.name} · {r.strength}
                        </h3>
                        <p>
                          {r.form} · {r.facility_name}
                          <br />
                          {r.address}, {r.city}
                        </p>
                      </div>
                      <Pill value={r.status} />
                    </div>
                    <p>
                      {r.status === "requested"
                        ? "Waiting for the pharmacy. Please do not travel based on this request yet."
                        : r.status === "confirmed"
                          ? "The pharmacy confirmed this item and a collection window. Bring any required prescription; the pharmacist determines dispensing eligibility."
                          : r.status === "unavailable"
                            ? "The pharmacy could not confirm this item. Contact your clinician or pharmacist about next steps."
                            : r.status === "expired"
                              ? "This request or hold expired. Make a new request before travelling."
                              : r.status === "collected"
                                ? "The pharmacy marked this request as collected."
                                : "This request was cancelled."}
                    </p>
                    {r.status === "confirmed" && r.hold_until && (
                      <div className="product-notice">
                        Provider hold expires {dateTime(r.hold_until)}
                      </div>
                    )}
                    {r.facility_status !== "verified" && (
                      <p className="product-inline-error">
                        This provider is not currently accepting requests on
                        Urugo.
                      </p>
                    )}
                    <div className="product-actions">
                      <a
                        href={"tel:" + r.phone}
                        className="product-button secondary"
                      >
                        Call pharmacy
                      </a>
                      {["requested", "confirmed"].includes(r.status) && (
                        <ActionButton
                          url={"/api/health/requests/" + r.id}
                          body={{ status: "cancelled" }}
                          confirm="Cancel this pharmacy request?"
                          onDone={reload}
                        >
                          Cancel request
                        </ActionButton>
                      )}
                    </div>
                    <p className="product-help">
                      Requested {dateTime(r.created_at)}
                    </p>
                  </article>
                ))
              )}
            </section>
            <section className="product-section">
              <h2>Appointments</h2>
              {!data.bookings.length ? (
                <Empty title="Your appointments will appear here">
                  <p>
                    Choose a published time and wait for the clinic to confirm
                    your request.
                  </p>
                  <a href="/health" className="product-button secondary">
                    Find a clinic
                  </a>
                </Empty>
              ) : (
                data.bookings.map((r) => (
                  <article key={r.id} className="product-panel">
                    <div className="product-heading-row">
                      <div>
                        <h3>{r.service}</h3>
                        <p>
                          {r.practitioner} · {r.facility_name}
                          <br />
                          {r.address}, {r.city}
                        </p>
                      </div>
                      <Pill value={r.status} />
                    </div>
                    <div className="product-notice">
                      {dateTime(r.starts_at)} — {dateTime(r.ends_at)}
                    </div>
                    <p>
                      {r.status === "requested"
                        ? "The clinic has not confirmed yet. Please wait for its response."
                        : r.status === "confirmed"
                          ? "Your clinic has confirmed this appointment. Contact them directly about fees or preparation."
                          : r.status === "expired"
                            ? "The time passed before the clinic confirmed. Please request a new time."
                            : r.status === "declined"
                              ? "The clinic could not accept this request. Please choose another time."
                              : r.status === "completed"
                                ? "The clinic marked this appointment as completed."
                                : "This appointment was cancelled."}
                    </p>
                    <div className="product-actions">
                      <a
                        href={"tel:" + r.phone}
                        className="product-button secondary"
                      >
                        Call clinic
                      </a>
                      {["requested", "confirmed"].includes(r.status) && (
                        <ActionButton
                          url={"/api/health/appointments/" + r.id}
                          body={{ status: "cancelled" }}
                          confirm="Cancel this appointment? The clinic will see the cancellation."
                          onDone={reload}
                        >
                          Cancel appointment
                        </ActionButton>
                      )}
                    </div>
                  </article>
                ))
              )}
            </section>
            <div className="product-notice">
              Health requests are separate from your home, property-management,
              and vehicle accounts. We do not collect diagnoses, prescriptions,
              medical documents, or payment details in these workflows.
            </div>
          </>
        )
      )}
    </main>
  );
}
