import { database, errorResponse, requireAccount } from "@/lib/data";
import { publicVehicleColumns, vehiclePhoto } from "@/lib/products";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const a = await requireAccount(),
      db = await database();
    const [vehicles, inquiries, saved, review] = await Promise.all([
      db
        .prepare(
          `SELECT v.*,${vehiclePhoto} FROM vehicles v WHERE v.seller_id=? ORDER BY v.updated_at DESC LIMIT 200`,
        )
        .bind(a.id)
        .all(),
      db
        .prepare(
          "SELECT i.id,i.vehicle_id,i.buyer_name,i.message,i.reply,i.status,i.created_at,v.make,v.model,v.year,CASE WHEN v.seller_id=? THEN 1 ELSE 0 END AS can_reply FROM vehicle_inquiries i JOIN vehicles v ON v.id=i.vehicle_id WHERE i.buyer_id=? OR v.seller_id=? ORDER BY i.updated_at DESC LIMIT 200",
        )
        .bind(a.id, a.id, a.id)
        .all(),
      db
        .prepare(
          `SELECT ${publicVehicleColumns},${vehiclePhoto} FROM vehicle_favorites f JOIN vehicles v ON v.id=f.vehicle_id WHERE f.account_id=? AND v.status='published' LIMIT 100`,
        )
        .bind(a.id)
        .all(),
      a.role === "admin"
        ? db
            .prepare(
              `SELECT v.*,${vehiclePhoto} FROM vehicles v WHERE v.status IN('pending','published') ORDER BY CASE v.status WHEN 'pending' THEN 0 ELSE 1 END,v.updated_at LIMIT 100`,
            )
            .all()
        : Promise.resolve({ results: [] }),
    ]);
    return Response.json(
      {
        vehicles: vehicles.results,
        inquiries: inquiries.results,
        saved: saved.results,
        review: review.results,
        isAdmin: a.role === "admin",
        displayName: a.display_name,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
