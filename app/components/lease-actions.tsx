"use client";
import { useState, type FormEvent } from "react";
import { readJson } from "@/lib/http";
export function LeaseActions({
  leaseId,
  status,
  onChange,
}: {
  leaseId: string;
  status: string;
  onChange: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function transition(next: string) {
    if (
      !confirm(
        next === "active"
          ? "Confirm that lease and move-in requirements are complete?"
          : "Update this tenancy lifecycle?",
      )
    )
      return;
    setBusy(true);
    try {
      await fetch("/api/tenancies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaseId, status: next }),
      }).then(readJson);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      await fetch("/api/tenancies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaseId,
          name: data.get("name"),
          email: data.get("email"),
          relationship: data.get("relationship"),
        }),
      }).then(readJson);
      form.reset();
      setError("Household member added.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Lease & household actions</summary>
      <p>Tenancy: {status.replaceAll("_", " ")}</p>
      {status === "pending_move_in" && (
        <button
          className="button button-light"
          disabled={busy}
          onClick={() => void transition("active")}
        >
          Confirm move-in
        </button>
      )}
      {status === "active" && (
        <button
          className="button button-light"
          disabled={busy}
          onClick={() => void transition("notice_given")}
        >
          Record notice
        </button>
      )}
      {["active", "notice_given"].includes(status) && (
        <button
          className="button button-light"
          disabled={busy}
          onClick={() => void transition("move_out_pending")}
        >
          Prepare move-out
        </button>
      )}
      {status === "move_out_pending" && (
        <button
          className="button button-light"
          disabled={busy}
          onClick={() => void transition("former")}
        >
          Complete move-out
        </button>
      )}
      <form onSubmit={add} className="compact-form">
        <h4>Add household member</h4>
        <label>
          Name
          <input required name="name" />
        </label>
        <label>
          Email (optional for occupants)
          <input type="email" name="email" />
        </label>
        <label>
          Relationship
          <select name="relationship">
            <option value="co_resident">Co-resident</option>
            <option value="occupant">Occupant</option>
            <option value="dependent">Dependent</option>
            <option value="guarantor">Guarantor</option>
          </select>
        </label>
        <button className="button button-light" disabled={busy}>
          Add household member
        </button>
      </form>
      {error && <p role="status">{error}</p>}
    </details>
  );
}
