import { AccessError, currentAccount, database, errorResponse, isEmail, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: string;
  property_id: string;
  property_name: string;
  full_name: string;
  email: string;
  phone: string;
  move_in_date: string | null;
  household_size: number;
  message: string;
  status: "new" | "reviewing" | "declined" | "accepted";
  created_at: string;
};

export async function GET() {
  try {
    const account = await currentAccount();
    if (!account) throw new AccessError("Please sign in to review applications.", 401);
    if (account.role === "resident") throw new AccessError("Applications are available to property owners and administrators.", 403);
    const db = await database();
    const query = account.role === "admin"
      ? `SELECT a.id, a.property_id, p.name AS property_name, a.full_name, a.email, a.phone, a.move_in_date, a.household_size, a.message, a.status, a.created_at
         FROM applications a INNER JOIN properties p ON p.id = a.property_id ORDER BY a.created_at DESC`
      : `SELECT a.id, a.property_id, p.name AS property_name, a.full_name, a.email, a.phone, a.move_in_date, a.household_size, a.message, a.status, a.created_at
         FROM applications a
         INNER JOIN properties p ON p.id = a.property_id
         INNER JOIN property_memberships pm ON pm.property_id = a.property_id
         WHERE pm.account_id = ? AND pm.role = 'owner'
         ORDER BY a.created_at DESC`;
    const result = account.role === "admin"
      ? await db.prepare(query).all<ApplicationRow>()
      : await db.prepare(query).bind(account.id).all<ApplicationRow>();
    return Response.json({ applications: result.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const propertyId = stringField(payload.propertyId, 100);
    const fullName = stringField(payload.fullName, 100);
    const email = stringField(payload.email, 150).toLowerCase();
    const phone = stringField(payload.phone, 50);
    const moveInDate = stringField(payload.moveInDate, 20) || null;
    const householdSize = Number(payload.householdSize);
    const message = stringField(payload.message, 2000);

    if (!propertyId || !fullName || !isEmail(email) || !phone || !Number.isInteger(householdSize) || householdSize < 1 || householdSize > 30) {
      return Response.json({ error: "Please complete your name, contact details, and household size." }, { status: 400 });
    }
    const db = await database();
    const property = await db.prepare("SELECT id, name FROM properties WHERE id = ? AND status = 'published'").bind(propertyId).first<{ id: string; name: string }>();
    if (!property) return Response.json({ error: "This listing is no longer accepting applications." }, { status: 404 });

    const application = {
      id: crypto.randomUUID(), property_id: property.id, property_name: property.name, full_name: fullName, email, phone,
      move_in_date: moveInDate, household_size: householdSize, message, status: "new" as const, created_at: new Date().toISOString(),
    };
    await db.prepare("INSERT INTO applications (id, property_id, full_name, email, phone, move_in_date, household_size, message, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')")
      .bind(application.id, propertyId, fullName, email, phone, moveInDate, householdSize, message).run();
    return Response.json({ application }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
