import { requirePermission } from "@/lib/authorization";
import { database, errorResponse, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = stringField((await params).id, 100);
    const db = await database();
    const item = await db
      .prepare("SELECT property_id FROM maintenance_requests WHERE id = ?")
      .bind(id)
      .first<{ property_id: string }>();
    if (!item)
      return Response.json(
        { error: "Maintenance request not found." },
        { status: 404 },
      );
    await requirePermission(item.property_id, "maintenance.update");
    const payload = (await request.json()) as Record<string, unknown>;
    const status = String(payload.status);
    const scheduledFor = stringField(payload.scheduledFor, 20) || null;
    if (!["new", "in_progress", "on_hold", "completed"].includes(status))
      return Response.json(
        { error: "Choose a valid maintenance status." },
        { status: 400 },
      );
    await db
      .prepare(
        "UPDATE maintenance_requests SET status = ?, scheduled_for = COALESCE(?, scheduled_for), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .bind(status, scheduledFor, id)
      .run();
    return Response.json({
      request: { id, status, scheduled_for: scheduledFor },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
