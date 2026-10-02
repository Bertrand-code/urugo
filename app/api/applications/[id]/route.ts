import { database, errorResponse, requirePropertyManager, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const applicationId = stringField((await params).id, 100);
    const payload = await request.json() as Record<string, unknown>;
    const status = payload.status;
    if (!["new", "reviewing", "declined", "accepted"].includes(String(status))) {
      return Response.json({ error: "Choose a valid application status." }, { status: 400 });
    }
    const db = await database();
    const application = await db.prepare("SELECT property_id FROM applications WHERE id = ?").bind(applicationId).first<{ property_id: string }>();
    if (!application) return Response.json({ error: "Application not found." }, { status: 404 });
    await requirePropertyManager(application.property_id);
    await db.prepare("UPDATE applications SET status = ? WHERE id = ?").bind(status, applicationId).run();
    return Response.json({ application: { id: applicationId, status } });
  } catch (error) {
    return errorResponse(error);
  }
}
