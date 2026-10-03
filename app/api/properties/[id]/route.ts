import {
  database,
  errorResponse,
  mediaBucket,
  requirePropertyManager,
  stringField,
} from "@/lib/data";

export const dynamic = "force-dynamic";

async function propertyIdFrom(params: Promise<{ id: string }>) {
  return stringField((await params).id, 100);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const propertyId = await propertyIdFrom(params);
    await requirePropertyManager(propertyId);
    const payload = (await request.json()) as Record<string, unknown>;
    const status = payload.status;
    const occupied = payload.occupied;
    const db = await database();
    const existing = await db
      .prepare("SELECT homes FROM properties WHERE id = ?")
      .bind(propertyId)
      .first<{ homes: number }>();
    if (!existing)
      return Response.json({ error: "Property not found." }, { status: 404 });

    if (status !== undefined && status !== "published" && status !== "draft") {
      return Response.json(
        { error: "Choose a valid listing status." },
        { status: 400 },
      );
    }
    if (
      occupied !== undefined &&
      (!Number.isInteger(Number(occupied)) ||
        Number(occupied) < 0 ||
        Number(occupied) > existing.homes)
    ) {
      return Response.json(
        {
          error: "Occupied homes must be between zero and the property total.",
        },
        { status: 400 },
      );
    }
    await db
      .prepare(
        "UPDATE properties SET status = COALESCE(?, status), occupied = COALESCE(?, occupied), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .bind(
        status ?? null,
        occupied === undefined ? null : Number(occupied),
        propertyId,
      )
      .run();
    const property = await db
      .prepare(
        "SELECT id, name, neighborhood, kind, homes, occupied, status, accent, listing_type, price_amount, currency, bedrooms, bathrooms, area_sqm, year_built, address, city, description, featured, created_at FROM properties WHERE id = ?",
      )
      .bind(propertyId)
      .first();
    return Response.json({ property });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const propertyId = await propertyIdFrom(params);
    await requirePropertyManager(propertyId);
    const db = await database();
    const property = await db
      .prepare("SELECT id FROM properties WHERE id = ?")
      .bind(propertyId)
      .first();
    if (!property)
      return Response.json({ error: "Property not found." }, { status: 404 });

    const groups = await db
      .prepare("SELECT id FROM access_groups WHERE property_id = ?")
      .bind(propertyId)
      .all<{ id: string }>();
    const imageRows = await db
      .prepare("SELECT storage_key FROM property_images WHERE property_id = ?")
      .bind(propertyId)
      .all<{ storage_key: string }>();
    const leaseRows = await db
      .prepare("SELECT id FROM leases WHERE property_id = ?")
      .bind(propertyId)
      .all<{ id: string }>();
    const documentRows = await db
      .prepare(
        "SELECT storage_key FROM property_documents WHERE property_id = ?",
      )
      .bind(propertyId)
      .all<{ storage_key: string }>();
    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          "DELETE FROM message_context WHERE message_id IN (SELECT id FROM property_messages WHERE property_id=?)",
        )
        .bind(propertyId),
      db
        .prepare(
          "DELETE FROM application_leases WHERE lease_id IN (SELECT id FROM leases WHERE property_id=?)",
        )
        .bind(propertyId),
      db
        .prepare(
          "DELETE FROM application_events WHERE application_id IN (SELECT id FROM applications WHERE property_id=?)",
        )
        .bind(propertyId),
      db
        .prepare(
          "DELETE FROM application_workflows WHERE application_id IN (SELECT id FROM applications WHERE property_id=?)",
        )
        .bind(propertyId),
      db
        .prepare(
          "DELETE FROM household_members WHERE tenancy_id IN (SELECT id FROM tenancies WHERE property_id=?)",
        )
        .bind(propertyId),
      ...[
        "tenancies",
        "ownerships",
        "staff_assignments",
        "invitations",
        "listing_preferences",
        "listing_details",
      ].map((table) =>
        db
          .prepare("DELETE FROM " + table + " WHERE property_id=?")
          .bind(propertyId),
      ),
      db
        .prepare("DELETE FROM applications WHERE property_id = ?")
        .bind(propertyId),
      db
        .prepare("DELETE FROM property_memberships WHERE property_id = ?")
        .bind(propertyId),
      db
        .prepare("DELETE FROM property_images WHERE property_id = ?")
        .bind(propertyId),
      db
        .prepare("DELETE FROM property_documents WHERE property_id = ?")
        .bind(propertyId),
      db
        .prepare("DELETE FROM property_messages WHERE property_id = ?")
        .bind(propertyId),
      db
        .prepare("DELETE FROM maintenance_requests WHERE property_id = ?")
        .bind(propertyId),
      db.prepare("DELETE FROM units WHERE property_id = ?").bind(propertyId),
      db.prepare("DELETE FROM leases WHERE property_id = ?").bind(propertyId),
    ];
    for (const lease of leaseRows.results) {
      statements.push(
        db.prepare("DELETE FROM charges WHERE lease_id = ?").bind(lease.id),
        db.prepare("DELETE FROM payments WHERE lease_id = ?").bind(lease.id),
      );
    }
    for (const group of groups.results) {
      statements.push(
        db
          .prepare("DELETE FROM access_group_members WHERE group_id = ?")
          .bind(group.id),
        db
          .prepare("DELETE FROM access_invites WHERE group_id = ?")
          .bind(group.id),
      );
    }
    statements.push(
      db
        .prepare("DELETE FROM access_groups WHERE property_id = ?")
        .bind(propertyId),
      db.prepare("DELETE FROM properties WHERE id = ?").bind(propertyId),
    );
    await db.batch(statements);
    const bucket = mediaBucket();
    const mediaKeys = [...imageRows.results, ...documentRows.results].map(
      (media) => media.storage_key,
    );
    if (bucket && mediaKeys.length) await bucket.delete(mediaKeys);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
