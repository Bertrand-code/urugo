import { currentAccount, database, errorResponse } from "@/lib/data";
import { contextFor } from "@/lib/authorization";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const account = await currentAccount();
    if (!account)
      return Response.json({
        account: null,
        contexts: [],
        tenancies: [],
        invitations: [],
      });
    const db = await database();
    const [contexts, tenancies, invitations] = await Promise.all([
      contextFor(account),
      db
        .prepare(
          "SELECT t.id, t.property_id, t.lease_id, t.status, p.name AS property_name, u.name AS unit_name FROM tenancies t JOIN household_members h ON h.tenancy_id=t.id JOIN properties p ON p.id=t.property_id LEFT JOIN units u ON u.id=t.unit_id WHERE h.account_id=? AND h.relationship IN ('primary','co_resident','guarantor') AND t.status!='former'",
        )
        .bind(account.id)
        .all(),
      db
        .prepare(
          "SELECT i.id, i.role, p.name AS property_name, i.expires_at FROM invitations i JOIN properties p ON p.id=i.property_id WHERE i.email=? AND i.status='pending' AND datetime(i.expires_at)>datetime('now')",
        )
        .bind(account.email)
        .all(),
    ]);
    return Response.json(
      {
        account: {
          id: account.id,
          email: account.email,
          displayName: account.display_name,
          role: account.role,
        },
        contexts,
        tenancies: tenancies.results,
        invitations: invitations.results,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
