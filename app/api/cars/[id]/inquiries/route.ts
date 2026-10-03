import {
  AccessError,
  database,
  errorResponse,
  requireAccount,
} from "@/lib/data";
import { input, field, vehicle } from "@/lib/products";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await requireAccount(),
      v = await vehicle((await params).id),
      body = await input(request),
      db = await database();
    if (v.status !== "published")
      throw new AccessError("This vehicle is not accepting inquiries.", 404);
    if (v.seller_id === a.id)
      throw new AccessError("This is your own listing.", 400);
    const existing = await db
      .prepare(
        "SELECT id FROM vehicle_inquiries WHERE buyer_id=? AND vehicle_id=? AND status!='closed'",
      )
      .bind(a.id, v.id)
      .first();
    if (existing)
      throw new AccessError(
        "You already have an inquiry for this vehicle. Check My garage for the reply.",
        409,
      );
    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO vehicle_inquiries(id,vehicle_id,buyer_id,buyer_name,message) VALUES(?,?,?,?,?)",
      )
      .bind(id, v.id, a.id, a.display_name, field(body, "message", 1500))
      .run();
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
