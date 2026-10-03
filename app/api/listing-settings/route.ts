import { database, errorResponse, stringField, AccessError } from "@/lib/data";
import { requirePermission, auditStatement } from "@/lib/authorization";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("propertyId") || "";
    await requirePermission(id, "listing.manage");
    const db = await database();
    const row = await db
      .prepare(
        "SELECT amenities,pet_policy,parking,publication,policies FROM listing_details WHERE property_id=?",
      )
      .bind(id)
      .first<{ amenities: string }>();
    return Response.json({
      settings: row
        ? { ...row, amenities: JSON.parse(row.amenities) }
        : {
            amenities: [],
            pet_policy: "ask",
            parking: "ask",
            publication: "published",
            policies: "",
          },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = stringField(body.propertyId);
    const account = await requirePermission(id, "listing.manage");
    const db = await database();
    const amenities = Array.isArray(body.amenities)
      ? [
          ...new Set(
            body.amenities
              .filter((v): v is string => typeof v === "string")
              .map((v) => v.trim().toLowerCase())
              .filter(Boolean),
          ),
        ].slice(0, 20)
      : [];
    const pets = String(body.pet_policy),
      parking = String(body.parking),
      publication = String(body.publication);
    if (
      !["allowed", "not_allowed", "ask"].includes(pets) ||
      !["available", "none", "ask"].includes(parking) ||
      !["published", "paused", "archived"].includes(publication)
    )
      throw new AccessError("Choose valid listing policies.", 400);
    await db.batch([
      db
        .prepare(
          "INSERT INTO listing_details (property_id,amenities,pet_policy,parking,publication,policies) VALUES (?,?,?,?,?,?) ON CONFLICT(property_id) DO UPDATE SET amenities=excluded.amenities,pet_policy=excluded.pet_policy,parking=excluded.parking,publication=excluded.publication,policies=excluded.policies",
        )
        .bind(
          id,
          JSON.stringify(amenities),
          pets,
          parking,
          publication,
          stringField(body.policies, 2000),
        ),
      auditStatement(db, account, id, "listing.settings", id),
    ]);
    return Response.json({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
