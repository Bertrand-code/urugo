import { requirePermission } from "@/lib/authorization";
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
      .prepare("SELECT property_id FROM leases WHERE id = ?")
      .bind(leaseId)
      .first<{ property_id: string }>();
    if (!lease)
      return Response.json({ error: "Lease not found." }, { status: 404 });
    const actor = await requirePermission(lease.property_id, "payment.manage");
    const payload = (await request.json()) as Record<string, unknown>;
    const chargeId = stringField(payload.chargeId, 100);
    const reference = stringField(payload.reference, 120);
    const charge = await db
      .prepare(
        "SELECT id, amount FROM charges WHERE id = ? AND lease_id = ? AND status = 'open'",
      )
      .bind(chargeId, leaseId)
      .first<{ id: string; amount: number }>();
    if (!charge)
      return Response.json(
        { error: "Choose an open charge to record payment." },
        { status: 400 },
      );
    const paymentId = crypto.randomUUID();
    const results = await db.batch([
      db
        .prepare(
          "INSERT INTO payments (id, lease_id, amount, method, reference) SELECT ?, lease_id, amount, 'manual', ? FROM charges WHERE id = ? AND lease_id = ? AND status = 'open'",
        )
        .bind(paymentId, reference, charge.id, leaseId),
      db
        .prepare(
          "UPDATE charges SET status = 'paid' WHERE id = ? AND lease_id = ? AND status = 'open'",
        )
        .bind(charge.id, leaseId),
      db
        .prepare(
          "INSERT INTO audit_events (id,actor_id,property_id,action,resource_id) SELECT ?,?,?, 'payment.recorded',? WHERE EXISTS (SELECT 1 FROM payments WHERE id=?)",
        )
        .bind(
          crypto.randomUUID(),
          actor.id,
          lease.property_id,
          paymentId,
          paymentId,
        ),
    ]);
    if (!results[0].meta.changes)
      return Response.json(
        { error: "This charge has already been paid." },
        { status: 409 },
      );
    return Response.json({ paymentRecorded: true });
  } catch (error) {
    return errorResponse(error);
  }
}
