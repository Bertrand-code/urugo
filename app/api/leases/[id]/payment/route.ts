import { database, errorResponse, requirePropertyManager, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const leaseId = stringField((await params).id, 100);
    const db = await database();
    const lease = await db.prepare("SELECT property_id FROM leases WHERE id = ?").bind(leaseId).first<{ property_id: string }>();
    if (!lease) return Response.json({ error: "Lease not found." }, { status: 404 });
    await requirePropertyManager(lease.property_id);
    const payload = await request.json() as Record<string, unknown>;
    const chargeId = stringField(payload.chargeId, 100);
    const reference = stringField(payload.reference, 120);
    const charge = await db.prepare("SELECT id, amount FROM charges WHERE id = ? AND lease_id = ? AND status = 'open'").bind(chargeId, leaseId).first<{ id: string; amount: number }>();
    if (!charge) return Response.json({ error: "Choose an open charge to record payment." }, { status: 400 });
    await db.batch([
      db.prepare("INSERT INTO payments (id, lease_id, amount, method, reference) VALUES (?, ?, ?, 'manual', ?)").bind(crypto.randomUUID(), leaseId, charge.amount, reference),
      db.prepare("UPDATE charges SET status = 'paid' WHERE id = ?").bind(charge.id),
    ]);
    return Response.json({ paymentRecorded: true });
  } catch (error) {
    return errorResponse(error);
  }
}
