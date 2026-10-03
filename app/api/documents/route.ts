import { managementScope, requirePermission } from "@/lib/authorization";
import {
  AccessError,
  currentAccount,
  database,
  errorResponse,
  mediaBucket,
  stringField,
} from "@/lib/data";

export const dynamic = "force-dynamic";

type DocumentRow = {
  id: string;
  property_id: string;
  property_name: string;
  lease_id: string | null;
  file_name: string;
  content_type: string;
  size_bytes: number;
  visibility: "management" | "resident";
  created_at: string;
};
const fields =
  "d.id, d.property_id, p.name AS property_name, d.lease_id, d.file_name, d.content_type, d.size_bytes, d.visibility, d.created_at";

export async function GET(request: Request) {
  try {
    const account = await currentAccount();
    if (!account)
      throw new AccessError("Please sign in to view documents.", 401);
    const db = await database();
    const scope = await managementScope(
      account,
      "document.view",
      "d.property_id",
    );
    if (new URL(request.url).searchParams.get("experience") === "personal") {
      scope.sql = "0=1";
      scope.values = [];
    }
    const documents = await db
      .prepare(
        "SELECT " +
          fields +
          " FROM property_documents d JOIN properties p ON p.id=d.property_id WHERE (" +
          scope.sql +
          ") OR (d.visibility='resident' AND EXISTS (SELECT 1 FROM tenancies t JOIN household_members h ON h.tenancy_id=t.id WHERE t.property_id=d.property_id AND h.account_id=? AND h.relationship IN ('primary','co_resident','guarantor') AND t.status!='former' AND (d.lease_id IS NULL OR d.lease_id=t.lease_id))) ORDER BY d.created_at DESC",
      )
      .bind(...scope.values, account.id)
      .all<DocumentRow>();
    return Response.json({ documents: documents.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const propertyId = stringField(form.get("propertyId"), 100);
    const manager = await requirePermission(propertyId, "document.manage");
    const bucket = mediaBucket();
    if (!bucket)
      return Response.json(
        { error: "Document storage is not available." },
        { status: 503 },
      );
    const leaseId = stringField(form.get("leaseId"), 100) || null;
    const visibility =
      form.get("visibility") === "management" ? "management" : "resident";
    const files = form
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    if (!files.length || files.length > 5)
      return Response.json(
        { error: "Upload between one and five documents at a time." },
        { status: 400 },
      );
    const db = await database();
    const property = await db
      .prepare("SELECT id, name FROM properties WHERE id = ?")
      .bind(propertyId)
      .first<{ id: string; name: string }>();
    if (!property)
      return Response.json({ error: "Property not found." }, { status: 404 });
    if (
      leaseId &&
      !(await db
        .prepare("SELECT id FROM leases WHERE id = ? AND property_id = ?")
        .bind(leaseId, propertyId)
        .first())
    ) {
      return Response.json(
        { error: "Choose a lease that belongs to this property." },
        { status: 400 },
      );
    }
    const allowed = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    if (
      files.some(
        (file) =>
          !allowed.has(file.type) ||
          file.size > 10 * 1024 * 1024 ||
          file.size === 0,
      )
    )
      throw new AccessError(
        "Use PDF, Word, text, JPEG, PNG or WebP files up to 10 MB.",
        400,
      );
    const documents: DocumentRow[] = [];
    const statements: D1PreparedStatement[] = [];
    const uploadedKeys:string[]=[];
    try {
    for (const file of files) {
      if (!allowed.has(file.type) || file.size > 10 * 1024 * 1024) {
        return Response.json(
          {
            error: "Documents must be PDF, Word, text, or images up to 10 MB.",
          },
          { status: 400 },
        );
      }
      const id = crypto.randomUUID();
      const key = "documents/" + propertyId + "/" + id;
      uploadedKeys.push(key);
      await bucket.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || "application/octet-stream" },
      });
      statements.push(
        db
          .prepare(
            "INSERT INTO property_documents (id, property_id, lease_id, uploaded_by, file_name, storage_key, content_type, size_bytes, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            id,
            propertyId,
            leaseId,
            manager.id,
            stringField(file.name, 180) || "document",
            key,
            file.type || "application/octet-stream",
            file.size,
            visibility,
          ),
      );
      documents.push({
        id,
        property_id: propertyId,
        property_name: property.name,
        lease_id: leaseId,
        file_name: stringField(file.name, 180) || "document",
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        visibility,
        created_at: new Date().toISOString(),
      });
    }
    await db.batch(statements);
    } catch(error) { if(uploadedKeys.length)await bucket.delete(uploadedKeys);throw error; }
    return Response.json({ documents }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
