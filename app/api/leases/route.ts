import { AccessError, currentAccount, database, errorResponse, isEmail, requirePropertyManager, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

type LeaseRow = {
  id: string; property_id: string; property_name: string; unit_id: string | null; unit_name: string | null;
  resident_email: string; resident_name: string; monthly_rent: number; currency: string; due_day: number;
  start_date: string; end_date: string | null; status: string; balance: number;
};

export async function GET() {
  try {
    const account = await currentAccount();
    if (!account) throw new AccessError("Please sign in to manage residents.", 401);
    if (account.role === "resident") throw new AccessError("Resident records are available only to property managers.", 403);
    const db = await database();
    const fields = "l.id, l.property_id, p.name AS property_name, l.unit_id, u.name AS unit_name, l.resident_email, l.resident_name, l.monthly_rent, l.currency, l.due_day, l.start_date, l.end_date, l.status, COALESCE((SELECT SUM(amount) FROM charges WHERE lease_id = l.id AND status = 'open'), 0) AS balance";
    const query = account.role === "admin"
      ? "SELECT " + fields + " FROM leases l INNER JOIN properties p ON p.id = l.property_id LEFT JOIN units u ON u.id = l.unit_id ORDER BY l.created_at DESC"
      : "SELECT " + fields + " FROM leases l INNER JOIN properties p ON p.id = l.property_id LEFT JOIN units u ON u.id = l.unit_id INNER JOIN property_memberships pm ON pm.property_id = l.property_id WHERE pm.account_id = ? AND pm.role = 'owner' ORDER BY l.created_at DESC";
    const result = account.role === "admin" ? await db.prepare(query).all<LeaseRow>() : await db.prepare(query).bind(account.id).all<LeaseRow>();
    return Response.json({ leases: result.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const propertyId = stringField(payload.propertyId, 100);
    await requirePropertyManager(propertyId);
    const unitId = stringField(payload.unitId, 100) || null;
    const residentName = stringField(payload.residentName, 100);
    const residentEmail = stringField(payload.residentEmail, 150).toLowerCase();
    const monthlyRent = Number(payload.monthlyRent);
    const currency = ["BIF", "USD", "EUR"].includes(String(payload.currency)) ? String(payload.currency) : "BIF";
    const dueDay = Number(payload.dueDay);
    const startDate = stringField(payload.startDate, 20);
    const dueDate = stringField(payload.dueDate, 20);
    if (!residentName || !isEmail(residentEmail) || !Number.isInteger(monthlyRent) || monthlyRent < 0 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28 || !startDate || !dueDate) {
      return Response.json({ error: "Add resident details, rent, and a valid due date." }, { status: 400 });
    }
    const db = await database();
    const property = await db.prepare("SELECT id FROM properties WHERE id = ?").bind(propertyId).first();
    if (!property) return Response.json({ error: "Property not found." }, { status: 404 });
    if (unitId) {
      const unit = await db.prepare("SELECT id FROM units WHERE id = ? AND property_id = ?").bind(unitId, propertyId).first();
      if (!unit) return Response.json({ error: "Choose a unit from this property." }, { status: 400 });
    }
    const account = await db.prepare("SELECT id FROM accounts WHERE email = ?").bind(residentEmail).first<{ id: string }>();
    const lease: LeaseRow = {
      id: crypto.randomUUID(), property_id: propertyId, property_name: "", unit_id: unitId, unit_name: null,
      resident_email: residentEmail, resident_name: residentName, monthly_rent: monthlyRent, currency, due_day: dueDay,
      start_date: startDate, end_date: null, status: "active", balance: monthlyRent,
    };
    const statements: D1PreparedStatement[] = [
      db.prepare("INSERT INTO leases (id, property_id, unit_id, resident_account_id, resident_email, resident_name, monthly_rent, currency, due_day, start_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')")
        .bind(lease.id, propertyId, unitId, account?.id ?? null, residentEmail, residentName, monthlyRent, currency, dueDay, startDate),
      db.prepare("INSERT INTO charges (id, lease_id, kind, description, amount, due_date, status) VALUES (?, ?, 'rent', ?, ?, ?, 'open')")
        .bind(crypto.randomUUID(), lease.id, "Rent due " + dueDate.slice(0, 7), monthlyRent, dueDate),
    ];
    if (unitId) statements.push(db.prepare("UPDATE units SET status = 'occupied' WHERE id = ?").bind(unitId));
    await db.batch(statements);
    return Response.json({ lease }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
