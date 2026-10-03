import {
  database,
  requireAccount,
  errorResponse,
  AccessError,
  stringField,
  isEmail,
} from "@/lib/data";
import { requirePermission, auditStatement } from "@/lib/authorization";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const account = await requireAccount();
    const db = await database();
    const rows = await db
      .prepare(
        "SELECT t.id,t.property_id,t.lease_id,t.status,t.start_date,t.end_date,p.name AS property_name,u.name AS unit_name FROM tenancies t JOIN properties p ON p.id=t.property_id LEFT JOIN units u ON u.id=t.unit_id WHERE EXISTS (SELECT 1 FROM household_members h WHERE h.tenancy_id=t.id AND h.account_id=? AND h.relationship IN ('primary','co_resident','guarantor'))",
      )
      .bind(account.id)
      .all();
    const household = await db
      .prepare(
        "SELECT h.id,h.tenancy_id,h.name,h.relationship FROM household_members h WHERE EXISTS (SELECT 1 FROM household_members me WHERE me.tenancy_id=h.tenancy_id AND me.account_id=? AND me.relationship IN ('primary','co_resident','guarantor'))",
      )
      .bind(account.id)
      .all();
    return Response.json({
      tenancies: rows.results,
      household: household.results,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const db = await database();
    const t = await db
      .prepare(
        "SELECT id,property_id,unit_id,lease_id,status,start_date FROM tenancies WHERE lease_id=?",
      )
      .bind(stringField(body.leaseId))
      .first<{
        id: string;
        property_id: string;
        unit_id: string | null;
        lease_id: string;
        status: string;
        start_date: string;
      }>();
    if (!t) throw new AccessError("Tenancy not found.", 404);
    const account = await requirePermission(t.property_id, "lease.manage");
    const status = String(body.status);
    const next: Record<string, string[]> = {
      pending_move_in: ["active", "former"],
      active: ["notice_given", "move_out_pending"],
      notice_given: ["active", "move_out_pending"],
      move_out_pending: ["former"],
      former: [],
    };
    if (!next[t.status]?.includes(status))
      throw new AccessError("This tenancy transition is not allowed.", 400);
    if (
      status === "active" &&
      t.start_date > new Date().toISOString().slice(0, 10)
    )
      throw new AccessError(
        "Move-in cannot be completed before the lease start date.",
        400,
      );
    const statements = [
      db.prepare("UPDATE tenancies SET status=? WHERE id=?").bind(status, t.id),
      db
        .prepare("UPDATE leases SET status=? WHERE id=?")
        .bind(
          status === "former"
            ? "ended"
            : status === "pending_move_in"
              ? "pending"
              : "active",
          t.lease_id,
        ),
      auditStatement(db, account, t.property_id, "tenancy." + status, t.id),
    ];
    if (t.unit_id)
      statements.push(
        db
          .prepare("UPDATE units SET status=? WHERE id=?")
          .bind(
            status === "former"
              ? "available"
              : status === "pending_move_in"
                ? "reserved"
                : "occupied",
            t.unit_id,
          ),
      );
    await db.batch(statements);
    return Response.json({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const db = await database();
    const t = await db
      .prepare("SELECT id,property_id FROM tenancies WHERE lease_id=?")
      .bind(stringField(body.leaseId))
      .first<{ id: string; property_id: string }>();
    if (!t) throw new AccessError("Tenancy not found.", 404);
    const manager = await requirePermission(t.property_id, "lease.manage");
    const name = stringField(body.name, 100),
      email = stringField(body.email, 150).toLowerCase(),
      relationship = String(body.relationship);
    if (
      !name ||
      (email && !isEmail(email)) ||
      !["co_resident", "occupant", "dependent", "guarantor"].includes(
        relationship,
      )
    )
      throw new AccessError(
        "Enter a name and valid household relationship.",
        400,
      );
    const account = email
      ? await db
          .prepare("SELECT id FROM accounts WHERE email=?")
          .bind(email)
          .first<{ id: string }>()
      : null;
    await db.batch([
      db
        .prepare(
          "INSERT INTO household_members (id,tenancy_id,account_id,email,name,relationship) VALUES (?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          t.id,
          account?.id ?? null,
          email || null,
          name,
          relationship,
        ),
      auditStatement(db, manager, t.property_id, "household.added", t.id),
    ]);
    return Response.json({ created: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
