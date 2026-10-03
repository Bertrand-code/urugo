"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { readJson } from "@/lib/http";
import {
  roleLabels,
  rolePermissions,
  type Permission,
  type StaffRole,
} from "@/lib/permissions";
export type Context = {
  id: string;
  name: string;
  roles: string[];
  permissions: Permission[];
};
export type Identity = {
  account: {
    id: string;
    email: string;
    displayName: string;
    role: "admin" | "owner" | "resident";
  } | null;
  contexts: Context[];
  tenancies: {
    id: string;
    lease_id: string;
    property_id: string;
    property_name: string;
    unit_name: string | null;
    status: string;
  }[];
  invitations: { id: string; role: string; property_name: string }[];
};
export const label = (value: string) => value.replaceAll("_", " ");
export function StatusBadge({ value }: { value: string }) {
  const tone = ["active", "paid", "approved", "completed", "accepted"].includes(
    value,
  )
    ? "success"
    : ["denied", "emergency", "overdue", "revoked"].includes(value)
      ? "danger"
      : [
            "pending",
            "submitted",
            "needs_information",
            "pending_move_in",
            "high",
          ].includes(value)
        ? "warning"
        : ["under_review", "screening", "in_progress"].includes(value)
          ? "info"
          : "neutral";
  return <span className={"semantic-status " + tone}>{label(value)}</span>;
}
export function TeamPanel({
  contexts,
  propertyId,
}: {
  contexts: Context[];
  propertyId: string;
}) {
  const [members, setMembers] = useState<
      {
        id: string;
        name?: string;
        email: string;
        property_id: string;
        property_name: string;
        role: StaffRole;
        status: string;
        source: string;
      }[]
    >([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(propertyId || contexts[0]?.id || ""),
    [email, setEmail] = useState(""),
    [role, setRole] = useState<StaffRole>("property_manager");
  const reload = useCallback(
    () =>
      fetch("/api/team")
        .then(readJson<{ members: typeof members }>)
        .then((data) => setMembers(data.members))
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: selected, email, role }),
      }).then(readJson<{ message: string }>);
      setNotice(result.message);
      setEmail("");
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function update(member: (typeof members)[number], newRole?: string) {
    setError("");
    try {
      await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: member.id,
          source: member.source,
          status: newRole ? "active" : "revoked",
          role: newRole,
        }),
      }).then(readJson);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="page-content">
      <section className="section-intro">
        <div>
          <p className="kicker">TEAM & ACCESS</p>
          <h2>Give each person the right access.</h2>
          <p>
            Assign owners, managers, leasing staff, maintenance teams, and other
            team members to the properties they manage. Roles, permissions, and
            property scope determine what each person can view or manage.
          </p>
        </div>
      </section>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <form className="card compact-form" onSubmit={invite}>
        <div className="form-grid">
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
            >
              {Object.entries(roleLabels).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Property scope
            <select
              required
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {contexts
                .filter((c) => c.permissions.includes("team.manage"))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <p className="form-hint">
          Invitations expire in seven days. Access begins only after acceptance
          by the invited account.
        </p>
        <button className="button button-dark" disabled={busy || !selected}>
          Create invitation
        </button>
      </form>
      <div className="table-scroll card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Property scope</th>
              <th>Status</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {members
              .filter((m) => !propertyId || m.property_id === propertyId)
              .map((m) => (
                <tr key={m.source + m.id}>
                  <td>
                    <strong>{m.name || m.email}</strong>
                    {m.name && <small>{m.email}</small>}
                  </td>
                  <td>{roleLabels[m.role]}</td>
                  <td>{m.property_name}</td>
                  <td>
                    <StatusBadge value={m.status} />
                  </td>
                  <td>
                    <details>
                      <summary>View access</summary>
                      <p>{rolePermissions[m.role]?.join(", ")}</p>
                      {contexts
                        .find((c) => c.id === m.property_id)
                        ?.permissions.includes("team.manage") &&
                        m.status !== "revoked" && (
                          <>
                            <button
                              type="button"
                              className="danger-button"
                              onClick={() => {
                                if (confirm("Revoke this property access?"))
                                  void update(m);
                              }}
                            >
                              Revoke
                            </button>
                            {m.source !== "invitation" && (
                              <label>
                                Change role
                                <select
                                  value={m.role}
                                  onChange={(e) =>
                                    void update(m, e.target.value)
                                  }
                                >
                                  {Object.entries(roleLabels)
                                    .filter(
                                      ([id]) =>
                                        ["owner", "investor"].includes(id) ===
                                        (m.source === "ownership"),
                                    )
                                    .map(([id, name]) => (
                                      <option key={id} value={id}>
                                        {name}
                                      </option>
                                    ))}
                                </select>
                              </label>
                            )}
                          </>
                        )}
                    </details>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!members.length && (
          <p className="empty-copy">
            No team assignments yet. Invite someone to a property to get
            started.
          </p>
        )}
      </div>
    </div>
  );
}
type Application = {
  id: string;
  property_id: string;
  property_name: string;
  unit_name?: string;
  full_name: string;
  stage: string;
  created_at: string;
  updated_at: string;
};
export function ApplicationInbox({
  personal = false,
  propertyId = "",
  onRefresh,
}: {
  personal?: boolean;
  propertyId?: string;
  onRefresh?: () => void;
}) {
  const [items, setItems] = useState<Application[]>([]),
    [filter, setFilter] = useState(""),
    [error, setError] = useState(""),
    [selected, setSelected] = useState("");
  const load = useCallback(
    () =>
      fetch("/api/applications" + (personal ? "?experience=personal" : ""))
        .then(readJson<{ applications: Application[] }>)
        .then((r) => setItems(r.applications))
        .catch((e) => setError(e.message)),
    [personal],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("tab") === "applications" && query.get("record"))
      setSelected(query.get("record")!);
  }, []);
  const scoped = items.filter(
    (a) => !propertyId || a.property_id === propertyId,
  );
  const nextStep: Record<string, string> = {
    draft: "Finish and submit your application.",
    submitted: "The property team has received your application.",
    needs_information:
      "The team needs more information. Open your application.",
    under_review: "The property team is reviewing your application.",
    screening: "Screening is being coordinated by the property team.",
    approved: "Contact the property team to arrange your lease and move-in.",
    denied: "The property team has completed its review.",
    withdrawn: "You withdrew this application.",
  };
  return (
    <section className="page-content">
      <div className="section-intro">
        <div>
          <p className="kicker">
            {personal ? "YOUR NEXT CHAPTER" : "LEASING PIPELINE"}
          </p>
          <h2>
            {personal
              ? "Every application, one clear next step."
              : "Move each application forward."}
          </h2>
        </div>
        {personal && (
          <a className="button button-dark" href="/discover">
            Find a home
          </a>
        )}
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div className="filter-chips">
        {[
          "",
          "submitted",
          "under_review",
          "screening",
          "approved",
          "needs_information",
        ].map((stage) => (
          <button
            key={stage}
            className={filter === stage ? "selected" : ""}
            onClick={() => setFilter(stage)}
          >
            {stage ? label(stage) : "All"}{" "}
            <b>{scoped.filter((a) => !stage || a.stage === stage).length}</b>
          </button>
        ))}
      </div>
      <div className="card operations-list">
        {scoped
          .filter((a) => !filter || a.stage === filter)
          .map((a) => (
            <article key={a.id} className="operation-row">
              <div>
                <p className="kicker">
                  {a.property_name}
                  {a.unit_name ? " · " + a.unit_name : ""}
                </p>
                <h3>{personal ? a.property_name : a.full_name}</h3>
                <StatusBadge value={a.stage} />
                <p>
                  {personal
                    ? nextStep[a.stage]
                    : "Updated " +
                      new Date(a.updated_at + "Z").toLocaleDateString()}
                </p>
              </div>
              <div className="form-actions">
                {personal &&
                  ["draft", "needs_information"].includes(a.stage) && (
                    <a
                      className="button button-light"
                      href={"/apply?application=" + a.id}
                    >
                      Continue
                    </a>
                  )}
                <button
                  className="text-button"
                  onClick={() => setSelected(a.id)}
                >
                  View application →
                </button>
              </div>
            </article>
          ))}
        {!scoped.length && (
          <p className="empty-copy">
            {personal
              ? "Your applications will appear here. Explore homes to begin."
              : "No applications yet. Published listings let renters apply directly."}
          </p>
        )}
      </div>
      {selected && (
        <ApplicationReview
          id={selected}
          personal={personal}
          close={() => setSelected("")}
          changed={() => {
            void load();
            onRefresh?.();
          }}
        />
      )}
    </section>
  );
}
function ApplicationReview({
  id,
  personal,
  close,
  changed,
}: {
  id: string;
  personal: boolean;
  close: () => void;
  changed: () => void;
}) {
  const [data, setData] = useState<{
      application: Application & {
        email: string;
        phone: string;
        move_in_date: string;
        household_size: number;
        message: string;
      };
      profile: Record<string, string>;
      timeline: {
        id: string;
        stage: string;
        message: string;
        internal: number;
        created_at: string;
      }[];
    } | null>(null),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [internal, setInternal] = useState(false),
    [stage, setStage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      fetch("/api/applications/" + id)
        .then(readJson<NonNullable<typeof data>>)
        .then((r) => {
          setData(r);
          setStage(r.application.stage);
        })
        .catch((e) => setError(e.message)),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function save() {
    setBusy(true);
    try {
      await fetch("/api/applications/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: personal ? "withdrawn" : stage,
          note,
          internal,
        }),
      }).then(readJson);
      setNote("");
      await load();
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card review-panel" aria-label="Application details">
      <button className="text-button" onClick={close}>
        Close details ×
      </button>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p className="kicker">
            {data.application.property_name} ·{" "}
            {data.application.unit_name || "Unit to be confirmed"}
          </p>
          <h2>{data.application.full_name}</h2>
          <StatusBadge value={data.application.stage} />
          <dl className="detail-dl">
            <dt>Contact</dt>
            <dd>
              {data.application.email} · {data.application.phone}
            </dd>
            <dt>Move-in preference</dt>
            <dd>{data.application.move_in_date || "Not specified"}</dd>
            <dt>Household</dt>
            <dd>{data.application.household_size} people</dd>
            {Object.entries(data.profile)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{label(k)}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          <h3>Application timeline</h3>
          <ol className="timeline">
            {data.timeline.map((e) => (
              <li key={e.id}>
                <StatusBadge value={e.stage} />
                {e.internal === 1 && <small> Internal only</small>}
                <p>{e.message || label(e.stage)}</p>
              </li>
            ))}
          </ol>
          {!personal && (
            <div className="compact-form">
              <label>
                Stage
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                >
                  {[
                    "submitted",
                    "needs_information",
                    "under_review",
                    "screening",
                    "approved",
                    "denied",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Update or note
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                />{" "}
                Internal note — never shown to applicant
              </label>
              <p className="form-hint">
                Screening is a manually tracked stage. No screening service or
                electronic signing provider is connected.
              </p>
            </div>
          )}
          {!["denied", "withdrawn"].includes(data.application.stage) && (
            <button
              className="button button-dark"
              disabled={busy}
              onClick={() => {
                if (!personal || confirm("Withdraw this application?"))
                  void save();
              }}
            >
              {personal ? "Withdraw application" : "Save review"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
export function HouseholdPanel() {
  const [data, setData] = useState<{
      tenancies: {
        id: string;
        property_name: string;
        unit_name: string;
        status: string;
      }[];
      household: {
        id: string;
        tenancy_id: string;
        name: string;
        relationship: string;
      }[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/tenancies")
      .then(readJson<NonNullable<typeof data>>)
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="page-content">
      <h2>Your household</h2>
      {error && <p role="alert">{error}</p>}
      {data?.tenancies.map((t) => (
        <article className="card review-panel" key={t.id}>
          <h3>
            {t.property_name} · {t.unit_name || "Unit not assigned"}
          </h3>
          <StatusBadge value={t.status} />
          {data.household
            .filter((h) => h.tenancy_id === t.id)
            .map((h) => (
              <p key={h.id}>
                {h.name} · {label(h.relationship)}
              </p>
            ))}
          <p className="form-hint">
            Contact management to change household members or lease
            responsibilities.
          </p>
        </article>
      ))}
      {data && !data.tenancies.length && (
        <p>No household yet. It appears after a lease is prepared.</p>
      )}
    </section>
  );
}
export function PerformancePanel({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<{
      properties: {
        id: string;
        name: string;
        homes: number;
        tracked_units: number;
        occupied_units: number;
        open_maintenance: number;
      }[];
      balances: {
        property_id: string;
        currency: string;
        outstanding: number;
      }[];
      collected: { property_id: string; currency: string; collected: number }[];
      period: string;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/reports")
      .then(readJson<NonNullable<typeof data>>)
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="page-content">
      <section className="section-intro">
        <div>
          <p className="kicker">PORTFOLIO PERFORMANCE · {data?.period}</p>
          <h2>Know how your properties are performing.</h2>
          <p>
            Recorded receipts and outstanding charges, reported separately by
            currency. Occupancy uses tracked unit records.
          </p>
        </div>
      </section>
      {error && <p role="alert">{error}</p>}
      {data?.properties
        .filter((p) => !propertyId || p.id === propertyId)
        .map((p) => (
          <article className="card review-panel" key={p.id}>
            <h3>{p.name}</h3>
            <div className="performance-grid">
              <div>
                <small>Tracked occupancy</small>
                <strong>
                  {p.occupied_units} / {p.tracked_units}
                </strong>
              </div>
              <div>
                <small>Open maintenance</small>
                <strong>{p.open_maintenance}</strong>
              </div>
              <div>
                <small>Collected this month</small>
                {data.collected
                  .filter((r) => r.property_id === p.id)
                  .map((r) => (
                    <strong key={r.currency}>
                      {r.collected.toLocaleString()} {r.currency}
                    </strong>
                  ))}
                {!data.collected.some((r) => r.property_id === p.id) && (
                  <strong>No receipts</strong>
                )}
              </div>
              <div>
                <small>Outstanding</small>
                {data.balances
                  .filter((r) => r.property_id === p.id)
                  .map((r) => (
                    <strong key={r.currency}>
                      {r.outstanding.toLocaleString()} {r.currency}
                    </strong>
                  ))}
                {!data.balances.some((r) => r.property_id === p.id) && (
                  <strong>No open charges</strong>
                )}
              </div>
            </div>
          </article>
        ))}
    </section>
  );
}
