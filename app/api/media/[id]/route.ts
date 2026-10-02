import { currentAccount, database, errorResponse, mediaBucket, propertyAccess, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const imageId = stringField((await params).id, 100);
    const db = await database();
    const image = await db.prepare("SELECT i.storage_key, p.id AS property_id, p.status FROM property_images i INNER JOIN properties p ON p.id = i.property_id WHERE i.id = ?")
      .bind(imageId).first<{ storage_key: string; property_id: string; status: "published" | "draft" }>();
    if (!image) return new Response("Not found", { status: 404 });
    const account = await currentAccount();
    const access = account ? await propertyAccess(account, image.property_id) : null;
    if (image.status !== "published" && access !== "admin" && access !== "owner") return new Response("Not found", { status: 404 });
    const object = await mediaBucket()?.get(image.storage_key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", image.status === "published" ? "public, max-age=3600" : "private, no-store");
    headers.set("ETag", object.httpEtag);
    return new Response(object.body, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
