import {
  currentAccount,
  database,
  errorResponse,
  mediaBucket,
  propertyAccess,
  stringField,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const imageId = stringField((await params).id, 100);
    const db = await database();
    const image = await db
      .prepare(
        "SELECT i.storage_key, p.id AS property_id, p.status, COALESCE(d.publication,'published') AS publication FROM property_images i INNER JOIN properties p ON p.id = i.property_id LEFT JOIN listing_details d ON d.property_id=p.id WHERE i.id = ?",
      )
      .bind(imageId)
      .first<{
        storage_key: string;
        property_id: string;
        status: "published" | "draft";
        publication: string;
      }>();
    if (!image) return new Response("Not found", { status: 404 });
    const account = await currentAccount();
    const access = account
      ? await propertyAccess(account, image.property_id)
      : null;
    if (
      (image.status !== "published" || image.publication !== "published") &&
      access !== "admin" &&
      access !== "owner"
    )
      return new Response("Not found", { status: 404 });
    const object = await mediaBucket()?.get(image.storage_key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set(
      "Cache-Control",
      image.status === "published" && image.publication === "published"
        ? "public, max-age=60"
        : "private, no-store",
    );
    headers.set("ETag", object.httpEtag);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
    return new Response(object.body, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
