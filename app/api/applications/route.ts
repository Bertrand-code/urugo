import {
  database,
  requireAccount,
  errorResponse,
  AccessError,
  stringField,
} from "@/lib/data";
import { managementScope } from "@/lib/authorization";
import {
  applicationFields,
  applicationJoin,
  profileData,
} from "@/lib/applications";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const account = await requireAccount();
    const db = await database();
    const personal =
      new URL(request.url).searchParams.get("experience") === "personal";
    const scope = personal
      ? { sql: "w.account_id=?", values: [account.id] }
      : await managementScope(account, "application.view", "a.property_id");
    const rows = await db
      .prepare(
        "SELECT " +
          applicationFields +
          " FROM " +
          applicationJoin +
          " WHERE " +
          scope.sql +
          (personal ? "" : " AND w.stage!='draft'") +
          " ORDER BY a.created_at DESC",
      )
      .bind(...scope.values)
      .all();
    return Response.json({ applications: rows.results });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const body = (await request.json()) as Record<string, unknown>;
    const db = await database();
    const propertyId = stringField(body.propertyId),
      unitId = stringField(body.unitId) || null;
    const property = await db
      .prepare(
        "SELECT id FROM properties WHERE id=? AND status='published' AND NOT EXISTS (SELECT 1 FROM listing_details d WHERE d.property_id=properties.id AND d.publication!='published')",
      )
      .bind(propertyId)
      .first();
    if (!property)
      throw new AccessError("This listing is not accepting applications.", 404);
    if (
      unitId &&
      !(await db
        .prepare(
          "SELECT id FROM units WHERE id=? AND property_id=? AND status='available'",
        )
        .bind(unitId, propertyId)
        .first())
    )
      throw new AccessError("This unit is not available.", 400);
    const existing = await db
      .prepare(
        "SELECT a.id FROM applications a JOIN application_workflows w ON w.application_id=a.id WHERE a.property_id=? AND w.account_id=? AND COALESCE(w.unit_id,'')=COALESCE(?,'') AND w.stage NOT IN ('denied','withdrawn')",
      )
      .bind(propertyId, account.id, unitId)
      .first<{ id: string }>();
    if (existing)
      return Response.json({ application: existing }, { status: 200 });
    const draft = body.draft !== false;
    const fullName = stringField(body.fullName, 100) || account.display_name;
    const phone = stringField(body.phone, 50);
    const size = Number(body.householdSize) || 1;
    if (!Number.isInteger(size) || size < 1 || size > 30 || (!draft && !phone))
      throw new AccessError("Enter valid contact and household details.", 400);
    const id = crypto.randomUUID();
    const stage = draft ? "draft" : "submitted";
    await db.batch([
      db
        .prepare(
          "INSERT INTO applications (id,property_id,full_name,email,phone,household_size,move_in_date,message,status) VALUES (?,?,?,?,?,?,?,?,'new')",
        )
        .bind(
          id,
          propertyId,
          fullName,
          account.email,
          phone,
          size,
          stringField(body.moveInDate) || null,
          stringField(body.message, 2000),
        ),
      db
        .prepare(
          "INSERT INTO application_workflows (application_id,account_id,unit_id,stage,profile_snapshot) VALUES (?,?,?,?,?)",
        )
        .bind(
          id,
          account.id,
          unitId,
          stage,
          JSON.stringify(profileData(body.profile)),
        ),
      db
        .prepare(
          "INSERT INTO application_events (id,application_id,actor_id,stage) VALUES (?,?,?,?)",
        )
        .bind(crypto.randomUUID(), id, account.id, stage),
    ]);
    return Response.json({ application: { id, stage } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
