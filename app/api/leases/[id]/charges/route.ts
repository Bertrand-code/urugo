import { requirePermission, auditStatement } from "@/lib/authorization";
import { database, errorResponse, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const leaseId = stringField((await params).id, 100);
    const db = await database();
    const lease = await db
      .prepare(
        "SELECT property_id FROM leases WHERE id = ? AND status = 'active'",
      )
      .bind(leaseId)
      .first<{ property_id: string }>();
    if (!lease)
      return Response.json(
        { error: "Active lease not found." },
        { status: 404 },
      );
    const actor = await requirePermission(lease.property_id, "payment.manage");
    const payload = (await request.json()) as Record<string, unknown>;
    const kind = ["rent", "utility", "fee"].includes(String(payload.kind))
      ? String(payload.kind)
      : "rent";
    const description = stringField(payload.description, 180);
    const amount = Number(payload.amount);
    const dueDate = stringField(payload.dueDate, 20);
    if (
      !description ||
      !Number.isInteger(amount) ||
      amount < 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
    ) {
      return Response.json(
        { error: "Add a description, whole amount, and valid due date." },
        { status: 400 },
      );
    }
    const charge = {
      id: crypto.randomUUID(),
      lease_id: leaseId,
      kind,
      description,
      amount,
      due_date: dueDate,
      status: "open",
      created_at: new Date().toISOString(),
    };
    await db.batch([
      db
        .prepare(
          "INSERT INTO charges (id, lease_id, kind, description, amount, due_date, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
        )
        .bind(charge.id, leaseId, kind, description, amount, dueDate),
      auditStatement(db, actor, lease.property_id, "charge.created", charge.id),
    ]);
    return Response.json({ charge }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
