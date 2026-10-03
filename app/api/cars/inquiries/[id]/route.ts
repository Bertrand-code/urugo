import {
  AccessError,
  database,
  errorResponse,
  requireAccount,
} from "@/lib/data";
import { input, field } from "@/lib/products";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await requireAccount(),
      { id } = await params,
      body = await input(request),
      db = await database();
    const record = await db
      .prepare(
        "SELECT i.*,v.seller_id FROM vehicle_inquiries i JOIN vehicles v ON v.id=i.vehicle_id WHERE i.id=?",
      )
      .bind(id)
      .first<{ buyer_id: string; seller_id: string; status: string }>();
    if (!record || ![record.buyer_id, record.seller_id].includes(a.id))
      throw new AccessError("Inquiry not found.", 404);
    if (record.status === "closed")
      throw new AccessError("This inquiry is closed.", 409);
    const action = field(body, "action", 20);
    if (action === "reply" && record.seller_id === a.id)
      await db
        .prepare(
          "UPDATE vehicle_inquiries SET reply=?,status='replied',updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .bind(field(body, "reply", 1500), id)
        .run();
    else if (action === "close")
      await db
        .prepare(
          "UPDATE vehicle_inquiries SET status='closed',updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .bind(id)
        .run();
    else throw new AccessError("Only the seller can reply.", 403);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
