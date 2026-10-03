import {
  database,
  requireAccount,
  errorResponse,
  stringField,
  AccessError,
} from "@/lib/data";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const account = await requireAccount();
    const db = await database();
    const rows = await db
      .prepare(
        "SELECT s.property_id,s.saved,s.viewed_at,p.name,p.neighborhood,p.city FROM listing_preferences s JOIN properties p ON p.id=s.property_id LEFT JOIN listing_details d ON d.property_id=p.id WHERE s.account_id=? AND p.status='published' AND COALESCE(d.publication,'published')='published' ORDER BY s.viewed_at DESC LIMIT 50",
      )
      .bind(account.id)
      .all();
    return Response.json({ preferences: rows.results });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const db = await database();
    const body = (await request.json()) as Record<string, unknown>;
    const id = stringField(body.propertyId);
    if (
      !(await db
        .prepare(
          "SELECT p.id FROM properties p LEFT JOIN listing_details d ON d.property_id=p.id WHERE p.id=? AND p.status='published' AND COALESCE(d.publication,'published')='published'",
        )
        .bind(id)
        .first())
    )
      throw new AccessError("Listing not found.", 404);
    if (body.saved !== undefined)
      await db
        .prepare(
          "INSERT INTO listing_preferences (account_id,property_id,saved) VALUES (?,?,?) ON CONFLICT(account_id,property_id) DO UPDATE SET saved=excluded.saved",
        )
        .bind(account.id, id, body.saved === true ? 1 : 0)
        .run();
    else
      await db
        .prepare(
          "INSERT INTO listing_preferences (account_id,property_id) VALUES (?,?) ON CONFLICT(account_id,property_id) DO UPDATE SET viewed_at=CURRENT_TIMESTAMP",
        )
        .bind(account.id, id)
        .run();
    return Response.json({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
