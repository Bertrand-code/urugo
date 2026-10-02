import { database, errorResponse, isEmail, requireAdmin, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

type GroupRow = {
  id: string;
  name: string;
  role: "owner" | "resident";
  property_id: string;
  property_name: string;
  members: number;
  pending: number;
};

export async function GET() {
  try {
    await requireAdmin();
    const db = await database();
    const groups = await db.prepare(
      `SELECT g.id, g.name, g.role, g.property_id, p.name AS property_name,
       COUNT(DISTINCT gm.id) AS members, COUNT(DISTINCT i.id) AS pending
       FROM access_groups g
       INNER JOIN properties p ON p.id = g.property_id
       LEFT JOIN access_group_members gm ON gm.group_id = g.id
       LEFT JOIN access_invites i ON i.group_id = g.id
       GROUP BY g.id
       ORDER BY p.name, g.name`,
    ).all<GroupRow>();
    return Response.json({ groups: groups.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const payload = await request.json() as Record<string, unknown>;
    const action = payload.action;
    const db = await database();

    if (action === "create-group") {
      const name = stringField(payload.name, 100);
      const role = payload.role === "owner" ? "owner" : payload.role === "resident" ? "resident" : null;
      const propertyId = stringField(payload.propertyId, 100);
      if (!name || !role || !propertyId) return Response.json({ error: "Add a group name, property, and access type." }, { status: 400 });
      const property = await db.prepare("SELECT id FROM properties WHERE id = ?").bind(propertyId).first();
      if (!property) return Response.json({ error: "Choose an existing property." }, { status: 400 });
      const group = { id: crypto.randomUUID(), name, role, property_id: propertyId, members: 0, pending: 0 };
      await db.prepare("INSERT INTO access_groups (id, name, role, property_id, created_by) VALUES (?, ?, ?, ?, ?)")
        .bind(group.id, name, role, propertyId, admin.id).run();
      return Response.json({ group }, { status: 201 });
    }

    if (action === "invite") {
      const groupId = stringField(payload.groupId, 100);
      const email = stringField(payload.email, 150).toLowerCase();
      if (!groupId || !isEmail(email)) return Response.json({ error: "Choose a group and enter a valid email address." }, { status: 400 });
      const group = await db.prepare("SELECT id, property_id, role FROM access_groups WHERE id = ?").bind(groupId).first<{ id: string; property_id: string; role: "owner" | "resident" }>();
      if (!group) return Response.json({ error: "Access group not found." }, { status: 404 });
      const account = await db.prepare("SELECT id, role FROM accounts WHERE email = ?").bind(email).first<{ id: string; role: "admin" | "owner" | "resident" }>();
      if (!account) {
        await db.prepare("INSERT OR IGNORE INTO access_invites (id, group_id, email) VALUES (?, ?, ?)").bind(crypto.randomUUID(), groupId, email).run();
        return Response.json({ status: "pending" }, { status: 201 });
      }
      const statements: D1PreparedStatement[] = [
        db.prepare("INSERT OR IGNORE INTO access_group_members (id, group_id, account_id) VALUES (?, ?, ?)").bind(crypto.randomUUID(), groupId, account.id),
        db.prepare("INSERT OR IGNORE INTO property_memberships (id, property_id, account_id, role) VALUES (?, ?, ?, ?)").bind(crypto.randomUUID(), group.property_id, account.id, group.role),
      ];
      if (account.role !== "admin" && (group.role === "owner" || account.role === "resident")) {
        statements.push(db.prepare("UPDATE accounts SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(group.role, account.id));
      }
      await db.batch(statements);
      return Response.json({ status: "added" }, { status: 201 });
    }

    return Response.json({ error: "Unsupported access action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const groupId = stringField(new URL(request.url).searchParams.get("groupId"), 100);
    if (!groupId) return Response.json({ error: "Choose an access group to remove." }, { status: 400 });
    const db = await database();
    const group = await db.prepare("SELECT id, property_id FROM access_groups WHERE id = ?").bind(groupId).first<{ id: string; property_id: string }>();
    if (!group) return Response.json({ error: "Access group not found." }, { status: 404 });
    const members = await db.prepare("SELECT account_id FROM access_group_members WHERE group_id = ?").bind(groupId).all<{ account_id: string }>();
    await db.batch([
      db.prepare("DELETE FROM access_group_members WHERE group_id = ?").bind(groupId),
      db.prepare("DELETE FROM access_invites WHERE group_id = ?").bind(groupId),
      db.prepare("DELETE FROM access_groups WHERE id = ?").bind(groupId),
    ]);
    for (const member of members.results) {
      const remaining = await db.prepare(
        `SELECT 1 FROM access_group_members gm
         INNER JOIN access_groups g ON g.id = gm.group_id
         WHERE gm.account_id = ? AND g.property_id = ? LIMIT 1`,
      ).bind(member.account_id, group.property_id).first();
      if (!remaining) {
        await db.prepare("DELETE FROM property_memberships WHERE property_id = ? AND account_id = ?")
          .bind(group.property_id, member.account_id).run();
      }
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
