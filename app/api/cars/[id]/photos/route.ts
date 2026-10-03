import {
  AccessError,
  database,
  errorResponse,
  mediaBucket,
  requireAccount,
} from "@/lib/data";
import { vehicle, ownsVehicle, audit } from "@/lib/products";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await requireAccount(),
      v = await vehicle((await params).id);
    ownsVehicle(a, v);
    if (!["draft", "pending"].includes(v.status))
      throw new AccessError(
        "Return the listing to draft before changing photos.",
        409,
      );
    const bucket = mediaBucket();
    if (!bucket) throw new AccessError("Photo storage is unavailable.", 503);
    if (Number(request.headers.get("content-length") || 0) > 50 * 1024 * 1024)
      throw new AccessError("Upload up to six photos at a time.", 413);
    const form = await request.formData(),
      files = form.getAll("files").filter((v): v is File => v instanceof File);
    if (
      !files.length ||
      files.length > 6 ||
      files.some(
        (f) =>
          !f.size ||
          f.size > 8 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(f.type),
      )
    )
      throw new AccessError(
        "Choose 1–6 JPEG, PNG or WebP photos, up to 8 MB each.",
        400,
      );
    const db = await database(),
      count = await db
        .prepare("SELECT COUNT(*) AS n FROM vehicle_photos WHERE vehicle_id=?")
        .bind(v.id)
        .first<{ n: number }>();
    if ((count?.n || 0) + files.length > 12)
      throw new AccessError("A listing can have up to twelve photos.", 400);
    const keys: string[] = [],
      statements: D1PreparedStatement[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
          png =
            bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71,
          webp =
            String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
            String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
        if (
          !(
            (file.type === "image/jpeg" && jpeg) ||
            (file.type === "image/png" && png) ||
            (file.type === "image/webp" && webp)
          )
        )
          throw new AccessError("A file does not match its image format.", 400);
        const id = crypto.randomUUID(),
          key = `vehicles/${v.id}/${id}`;
        keys.push(key);
        await bucket.put(key, file.stream(), {
          httpMetadata: { contentType: file.type },
        });
        statements.push(
          db
            .prepare(
              "INSERT INTO vehicle_photos(id,vehicle_id,storage_key,content_type,position) VALUES(?,?,?,?,?)",
            )
            .bind(id, v.id, key, file.type, (count?.n || 0) + index),
        );
      }
      statements.push(
        db
          .prepare(
            "UPDATE vehicles SET status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=?",
          )
          .bind(v.id),
        audit(db, a, "cars.photos.updated", v.id),
      );
      await db.batch(statements);
    } catch (e) {
      if (keys.length) await bucket.delete(keys);
      throw e;
    }
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
