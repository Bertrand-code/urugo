import { accessiblePropertyIds, currentAccount, database, errorResponse } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const account = await currentAccount();
    if (!account) return Response.json({ account: null });
    const propertyIds = await accessiblePropertyIds(account);
    const db = await database();
    const applicationCount = account.role === "admin"
      ? await db.prepare("SELECT COUNT(*) AS count FROM applications WHERE status IN ('new', 'reviewing')").first<{ count: number }>()
      : propertyIds?.length
        ? await db.prepare(`SELECT COUNT(*) AS count FROM applications WHERE property_id IN (${propertyIds.map(() => "?").join(", ")}) AND status IN ('new', 'reviewing')`).bind(...propertyIds).first<{ count: number }>()
        : { count: 0 };

    return Response.json({
      account: { id: account.id, email: account.email, displayName: account.display_name, role: account.role },
      openApplications: applicationCount?.count ?? 0,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
