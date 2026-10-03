import {
  database,
  errorResponse,
  requireAccount,
  isEmail,
  stringField,
  AccessError,
} from "@/lib/data";
import {
  requirePermission,
  managementScope,
  auditStatement,
} from "@/lib/authorization";
import { rolePermissions } from "@/lib/permissions";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const account = await requireAccount();
    const db = await database();
    const scope = await managementScope(account, "team.view", "s.property_id");
    const members = await db
      .prepare(
        `SELECT s.id, s.property_id, p.name AS property_name, a.display_name AS name, a.email, s.role, s.status, s.source FROM (SELECT *, 'staff' AS source FROM staff_assignments UNION ALL SELECT *, 'ownership' AS source FROM ownerships) s JOIN accounts a ON a.id=s.account_id JOIN properties p ON p.id=s.property_id WHERE ${scope.sql} ORDER BY a.display_name`,
      )
      .bind(...scope.values)
      .all();
    const invites = await db
      .prepare(
        `SELECT s.id, s.property_id, p.name AS property_name, s.email, s.role, CASE WHEN s.status='pending' AND datetime(s.expires_at)<=datetime('now') THEN 'expired' ELSE s.status END AS status, 'invitation' AS source FROM invitations s JOIN properties p ON p.id=s.property_id WHERE ${scope.sql} ORDER BY s.created_at DESC`,
      )
      .bind(...scope.values)
      .all();
    return Response.json({ members: [...members.results, ...invites.results] });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const db = await database();
    if (body.action === "accept") {
      const account = await requireAccount();
      const invite = await db
        .prepare(
          "SELECT id, property_id, role FROM invitations WHERE id=? AND email=? AND status='pending' AND datetime(expires_at)>datetime('now')",
        )
        .bind(stringField(body.id), account.email)
        .first<{ id: string; property_id: string; role: string }>();
      if (!invite)
        throw new AccessError(
          "This invitation is unavailable or expired.",
          404,
        );
      const table = ["owner", "investor"].includes(invite.role)
        ? "ownerships"
        : "staff_assignments";
      await db.batch([
        db
          .prepare(
            `INSERT INTO ${table} (id, property_id, account_id, role, status) SELECT ?, property_id, ?, role, 'active' FROM invitations WHERE id=? AND status='pending' AND datetime(expires_at)>datetime('now') ON CONFLICT(property_id, account_id) DO UPDATE SET role=excluded.role,status='active'`,
          )
          .bind(crypto.randomUUID(), account.id, invite.id),
        db
          .prepare(
            "UPDATE invitations SET status='accepted', accepted_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",
          )
          .bind(invite.id),
        auditStatement(
          db,
          account,
          invite.property_id,
          "invitation.accepted",
          invite.id,
        ),
      ]);
      return Response.json({ accepted: true });
    }
    const propertyId = stringField(body.propertyId);
    const account = await requirePermission(propertyId, "team.manage");
    const email = stringField(body.email, 150).toLowerCase();
    const role = stringField(body.role);
    if (!isEmail(email) || !Object.hasOwn(rolePermissions, role))
      throw new AccessError("Choose a valid email and property role.", 400);
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          "UPDATE invitations SET status='revoked' WHERE property_id=? AND email=? AND status='pending'",
        )
        .bind(propertyId, email),
      db
        .prepare(
          "INSERT INTO invitations (id,email,invited_by,property_id,role,expires_at) VALUES (?,?,?,?,?,datetime('now','+7 days'))",
        )
        .bind(id, email, account.id, propertyId, role),
      auditStatement(db, account, propertyId, "invitation.created", id),
    ]);
    return Response.json(
      {
        id,
        status: "pending",
        delivery: "in_app",
        message:
          "Invitation is available when this person signs in. Email delivery is not configured.",
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const db = await database();
    const source = String(body.source);
    const table =
      source === "ownership"
        ? "ownerships"
        : source === "staff"
          ? "staff_assignments"
          : source === "invitation"
            ? "invitations"
            : null;
    if (!table) throw new AccessError("Choose a valid access record.", 400);
    const id = stringField(body.id);
    const item = await db
      .prepare(`SELECT property_id FROM ${table} WHERE id=?`)
      .bind(id)
      .first<{ property_id: string }>();
    if (!item) throw new AccessError("Access record not found.", 404);
    const account = await requirePermission(item.property_id, "team.manage");
    const status =
      source === "invitation"
        ? "revoked"
        : body.status === "active"
          ? "active"
          : "revoked";
    const role = stringField(body.role);
    if (
      role &&
      (!Object.hasOwn(rolePermissions, role) ||
        source === "invitation" ||
        ["owner", "investor"].includes(role) !== (source === "ownership"))
    )
      throw new AccessError(
        "Revoke this relationship and invite the person to the new role.",
        400,
      );
    await db.batch([
      db
        .prepare(
          `UPDATE ${table} SET status=?${role ? ", role=?" : ""} WHERE id=?`,
        )
        .bind(...(role ? [status, role, id] : [status, id])),
      auditStatement(db, account, item.property_id, "access.updated", id),
    ]);
    return Response.json({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
