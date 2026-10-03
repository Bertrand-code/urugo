import { can, personalLeaseIds } from "@/lib/authorization";
import {
  AccessError,
  currentAccount,
  database,
  errorResponse,
  mediaBucket,
  stringField,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = stringField((await params).id, 100);
    const account = await currentAccount();
    if (!account)
      throw new AccessError("Please sign in to open this document.", 401);
    const db = await database();
    const document = await db
      .prepare(
        "SELECT id, property_id, lease_id, storage_key, content_type, file_name, visibility FROM property_documents WHERE id = ?",
      )
      .bind(id)
      .first<{
        id: string;
        property_id: string;
        lease_id: string | null;
        storage_key: string;
        content_type: string;
        file_name: string;
        visibility: "management" | "resident";
      }>();
    if (!document)
      return Response.json({ error: "Document not found." }, { status: 404 });
    if (!(await can(account, "document.view", document.property_id))) {
      const ids = await personalLeaseIds(account);
      if (document.visibility !== "resident" || !ids.length)
        throw new AccessError("You do not have access to this document.", 403);
      const lease = await db
        .prepare(
          "SELECT id FROM leases WHERE property_id=? AND id IN (" +
            ids.map(() => "?").join(",") +
            ") AND (? IS NULL OR id=?)",
        )
        .bind(
          document.property_id,
          ...ids,
          document.lease_id,
          document.lease_id,
        )
        .first();
      if (!lease)
        throw new AccessError("You do not have access to this document.", 403);
    }
    const object = await mediaBucket()?.get(document.storage_key);
    if (!object)
      return Response.json(
        { error: "Document file is unavailable." },
        { status: 404 },
      );
    return new Response(object.body, {
      headers: {
        "Content-Type": document.content_type,
        "Content-Disposition":
          "attachment; filename*=UTF-8''" +
          encodeURIComponent(document.file_name),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
