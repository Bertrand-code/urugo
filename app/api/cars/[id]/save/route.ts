import {
  AccessError,
  database,
  errorResponse,
  requireAccount,
} from "@/lib/data";
import { input, vehicle } from "@/lib/products";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await requireAccount(),
      v = await vehicle((await params).id),
      body = await input(request),
      db = await database();
    if (typeof body.saved !== "boolean")
      throw new AccessError("Choose save or remove.", 400);
    if (body.saved && v.status !== "published")
      throw new AccessError("Vehicle not found.", 404);
    if (body.saved)
      await db
        .prepare(
          "INSERT OR IGNORE INTO vehicle_favorites(id,account_id,vehicle_id) VALUES(?,?,?)",
        )
        .bind(crypto.randomUUID(), a.id, v.id)
        .run();
    else
      await db
        .prepare(
          "DELETE FROM vehicle_favorites WHERE account_id=? AND vehicle_id=?",
        )
        .bind(a.id, v.id)
        .run();
    return Response.json({ saved: body.saved });
  } catch (e) {
    return errorResponse(e);
  }
}
