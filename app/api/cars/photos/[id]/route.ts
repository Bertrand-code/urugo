import {
  AccessError,
  currentAccount,
  database,
  errorResponse,
  mediaBucket,
  requireAccount,
} from "@/lib/data";
import { audit } from "@/lib/products";
type Context = { params: Promise<{ id: string }> };
type Photo = {
  id: string;
  vehicle_id: string;
  storage_key: string;
  content_type: string;
  seller_id: string;
  status: string;
};
async function photo(id: string) {
  const db = await database();
  const p = await db
    .prepare(
      "SELECT p.*,v.seller_id,v.status FROM vehicle_photos p JOIN vehicles v ON v.id=p.vehicle_id WHERE p.id=?",
    )
    .bind(id)
    .first<Photo>();
  if (!p) throw new AccessError("Photo not found.", 404);
  return p;
}
export async function GET(_request: Request, { params }: Context) {
  try {
    const p = await photo((await params).id);
    if (p.status !== "published") {
      const a = await currentAccount();
      if (!a || (a.id !== p.seller_id && a.role !== "admin"))
        throw new AccessError("Photo not found.", 404);
    }
    const object = await mediaBucket()?.get(p.storage_key);
    if (!object) throw new AccessError("Photo not found.", 404);
    return new Response(object.body, {
      headers: {
        "Content-Type": p.content_type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const a = await requireAccount(),
      p = await photo((await params).id);
    if (p.seller_id !== a.id) throw new AccessError("Photo not found.", 404);
    if (p.status !== "draft")
      throw new AccessError(
        "Return the listing to draft before removing photos.",
        409,
      );
    const db = await database();
    await db.batch([
      db.prepare("DELETE FROM vehicle_photos WHERE id=?").bind(p.id),
      audit(db, a, "cars.photo.removed", p.vehicle_id),
    ]);
    await mediaBucket()?.delete(p.storage_key);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
