import {
  AccessError,
  currentAccount,
  database,
  errorResponse,
  requireAccount,
} from "@/lib/data";
import {
  input,
  field,
  choice,
  whole,
  vehicle,
  ownsVehicle,
  publicVehicleColumns,
  vehiclePhoto,
  audit,
} from "@/lib/products";
type Context = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params,
      v = await vehicle(id),
      a = await currentAccount();
    const privateAccess = !!a && (v.seller_id === a.id || a.role === "admin");
    if (v.status !== "published" && !privateAccess)
      throw new AccessError("Vehicle not found.", 404);
    const db = await database(),
      record = await db
        .prepare(
          `SELECT ${publicVehicleColumns},${vehiclePhoto} FROM vehicles v WHERE v.id=?`,
        )
        .bind(id)
        .first();
    const photos = await db
      .prepare(
        "SELECT id,'/api/cars/photos/'||id AS url FROM vehicle_photos WHERE vehicle_id=? ORDER BY position,id",
      )
      .bind(id)
      .all();
    const saved = a
      ? !!(await db
          .prepare(
            "SELECT id FROM vehicle_favorites WHERE account_id=? AND vehicle_id=?",
          )
          .bind(a.id, id)
          .first())
      : false;
    return Response.json(
      {
        vehicle: record,
        photos: photos.results,
        saved,
        canEdit: !!a && v.seller_id === a.id,
        moderationNote: privateAccess ? v.moderation_note : undefined,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    const a = await requireAccount(),
      { id } = await params,
      v = await vehicle(id),
      body = await input(request),
      db = await database();
    const action = field(body, "action", 40);
    if (action === "moderate") {
      if (a.role !== "admin")
        throw new AccessError(
          "Only platform administrators can review listings.",
          403,
        );
      if (v.status !== "pending" && v.status !== "published")
        throw new AccessError(
          "This listing is not awaiting review or published.",
          409,
        );
      const status = choice(body, "status", ["published", "draft", "archived"]),
        note = field(body, "note", 500, status === "published");
      if (
        status === "published" &&
        !(await db
          .prepare("SELECT id FROM vehicle_photos WHERE vehicle_id=? LIMIT 1")
          .bind(id)
          .first())
      )
        throw new AccessError(
          "Add at least one vehicle photo before publishing.",
          400,
        );
      const reviewed = await db.batch([
        db
          .prepare(
            "UPDATE vehicles SET status=?,moderation_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND updated_at=?",
          )
          .bind(status, note, id, v.status, v.updated_at),
        audit(db, a, "cars.listing." + status, id),
      ]);
      if (!reviewed[0].meta.changes)
        throw new AccessError(
          "The listing changed during review. Refresh it before publishing.",
          409,
        );
    } else {
      ownsVehicle(a, v);
      if (action === "edit") {
        // Editing reviewed content always removes it from public discovery until reviewed again.
        const values = [
          field(body, "seller_name", 120),
          choice(body, "seller_type", ["private", "dealer"]),
          field(body, "make", 60),
          field(body, "model", 80),
          whole(body, "year", 1900, new Date().getUTCFullYear() + 1),
          whole(body, "mileage", 0, 3_000_000),
          choice(body, "transmission", ["automatic", "manual"]),
          choice(body, "fuel", ["petrol", "diesel", "hybrid", "electric"]),
          choice(body, "condition", ["new", "used"]),
          whole(body, "price", 1, 100_000_000_000),
          choice(body, "currency", ["BIF", "USD"]),
          field(body, "city", 100),
          field(body, "description", 3000),
          id,
        ];
        await db.batch([
          db
            .prepare(
              "UPDATE vehicles SET seller_name=?,seller_type=?,make=?,model=?,year=?,mileage=?,transmission=?,fuel=?,condition=?,price=?,currency=?,city=?,description=?,status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=?",
            )
            .bind(...values),
          audit(db, a, "cars.listing.edited", id),
        ]);
      } else if (action === "status") {
        const status = choice(body, "status", [
          "draft",
          "pending",
          "sold",
          "archived",
        ]);
        if (
          status === "pending" &&
          !(await db
            .prepare("SELECT id FROM vehicle_photos WHERE vehicle_id=? LIMIT 1")
            .bind(id)
            .first())
        )
          throw new AccessError(
            "Add at least one real vehicle photo before submitting.",
            400,
          );
        if (status === "sold" && v.status !== "published")
          throw new AccessError(
            "Only published vehicles can be marked sold.",
            409,
          );
        await db.batch([
          db
            .prepare(
              "UPDATE vehicles SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
            )
            .bind(status, id),
          audit(db, a, "cars.listing." + status, id),
        ]);
      } else throw new AccessError("Unknown action.", 400);
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
