import { requirePermission } from "@/lib/authorization";
import { database, errorResponse, mediaBucket, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const propertyId = stringField((await params).id, 100);
    await requirePermission(propertyId, "listing.manage");
    const bucket = mediaBucket();
    if (!bucket)
      return Response.json(
        { error: "Photo storage is not available." },
        { status: 503 },
      );
    const form = await request.formData();
    const files = form
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    if (!files.length || files.length > 12)
      return Response.json(
        { error: "Upload between one and twelve photos at a time." },
        { status: 400 },
      );
    if (
      files.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 8 * 1024 * 1024 ||
          !file.size,
      )
    )
      return Response.json(
        { error: "Use JPEG, PNG or WebP photos up to 8 MB." },
        { status: 400 },
      );
    const db = await database();
    const current = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM property_images WHERE property_id = ?",
      )
      .bind(propertyId)
      .first<{ count: number }>();
    const images: { id: string; url: string; altText: string }[] = [];
    const statements: D1PreparedStatement[] = [];
    const uploadedKeys:string[]=[];
    try {
    for (const [index, file] of files.entries()) {
      if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
        return Response.json(
          { error: "Each photo must be an image smaller than 8 MB." },
          { status: 400 },
        );
      }
      const id = crypto.randomUUID();
      const key = "properties/" + propertyId + "/" + id;
      uploadedKeys.push(key);
      await bucket.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
      });
      const altText = stringField(form.get("alt-" + index), 150);
      statements.push(
        db
          .prepare(
            "INSERT INTO property_images (id, property_id, storage_key, alt_text, sort_order) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(id, propertyId, key, altText, (current?.count ?? 0) + index),
      );
      images.push({ id, url: "/api/media/" + id, altText });
    }
    await db.batch(statements);
    } catch(error) {if(uploadedKeys.length)await bucket.delete(uploadedKeys);throw error;}
    return Response.json({ images }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
