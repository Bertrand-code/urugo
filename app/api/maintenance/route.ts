import { managementScope, can } from "@/lib/authorization";
import {
  AccessError,
  currentAccount,
  database,
  errorResponse,
  requirePropertyParticipant,
  stringField,
} from "@/lib/data";

export const dynamic = "force-dynamic";

type MaintenanceRow = {
  id: string;
  property_id: string;
  property_name: string;
  lease_id: string | null;
  resident_name: string;
  title: string;
  description: string;
  category: string;
  priority: "low" | "normal" | "high" | "emergency";
  status: "new" | "in_progress" | "on_hold" | "completed";
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
};

const fields =
  "m.id, m.property_id, p.name AS property_name, m.lease_id, m.resident_name, m.title, m.description, m.category, m.priority, m.status, m.scheduled_for, m.created_at, m.updated_at";

export async function GET(request: Request) {
  try {
    const account = await currentAccount();
    if (!account)
      throw new AccessError(
        "Please sign in to view maintenance requests.",
        401,
      );
    const db = await database();
    const scope = await managementScope(
      account,
      "maintenance.view",
      "m.property_id",
    );
    if (new URL(request.url).searchParams.get("experience") === "personal") {
      scope.sql = "0=1";
      scope.values = [];
    }
    const requests = await db
      .prepare(
        "SELECT " +
          fields +
          " FROM maintenance_requests m JOIN properties p ON p.id=m.property_id WHERE (" +
          scope.sql +
          ") OR (m.resident_account_id=? AND EXISTS (SELECT 1 FROM tenancies t JOIN household_members h ON h.tenancy_id=t.id WHERE t.lease_id=m.lease_id AND h.account_id=? AND t.status!='former')) ORDER BY CASE m.priority WHEN 'emergency' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, m.created_at DESC",
      )
      .bind(...scope.values, account.id, account.id)
      .all<MaintenanceRow>();
    return Response.json({ requests: requests.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const propertyId = stringField(payload.propertyId, 100);
    const signedIn = await currentAccount();
    if (!signedIn) throw new AccessError("Please sign in.", 401);
    const participant = (await can(signedIn, "maintenance.create", propertyId))
      ? { account: signedIn, access: "owner" as const }
      : await requirePropertyParticipant(propertyId);
    const title = stringField(payload.title, 140);
    const description = stringField(payload.description, 3000);
    const category = [
      "general",
      "plumbing",
      "electrical",
      "appliance",
      "security",
      "cleaning",
    ].includes(String(payload.category))
      ? String(payload.category)
      : "general";
    const priority = ["low", "normal", "high", "emergency"].includes(
      String(payload.priority),
    )
      ? String(payload.priority)
      : "normal";
    if (!title || !description)
      return Response.json(
        { error: "Add a title and enough detail for the maintenance team." },
        { status: 400 },
      );
    const db = await database();
    const lease = await db
      .prepare(
        "SELECT t.lease_id AS id FROM tenancies t JOIN household_members h ON h.tenancy_id=t.id WHERE t.property_id=? AND h.account_id=? AND h.relationship IN ('primary','co_resident','guarantor') AND t.status IN ('active','notice_given','move_out_pending') LIMIT 1",
      )
      .bind(propertyId, participant.account.id)
      .first<{ id: string }>();
    if (
      !(await db
        .prepare("SELECT id FROM properties WHERE id=?")
        .bind(propertyId)
        .first())
    )
      throw new AccessError("Property not found.", 404);
    const item = {
      id: crypto.randomUUID(),
      property_id: propertyId,
      lease_id: lease?.id ?? null,
      resident_name: participant.account.display_name,
      title,
      description,
      category,
      priority,
      status: "new",
      scheduled_for: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db
      .prepare(
        "INSERT INTO maintenance_requests (id, property_id, lease_id, resident_account_id, resident_name, title, description, category, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')",
      )
      .bind(
        item.id,
        propertyId,
        item.lease_id,
        participant.account.id,
        item.resident_name,
        title,
        description,
        category,
        priority,
      )
      .run();
    return Response.json({ request: item }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
