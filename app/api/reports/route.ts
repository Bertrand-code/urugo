import { database, requireAccount, errorResponse } from "@/lib/data";
import { managementScope } from "@/lib/authorization";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const account = await requireAccount();
    const db = await database();
    const scope = await managementScope(account, "report.view", "p.id");
    const properties = await db
      .prepare(
        `SELECT p.id,p.name,p.homes,(SELECT COUNT(*) FROM units u WHERE u.property_id=p.id) AS tracked_units,(SELECT COUNT(*) FROM units u WHERE u.property_id=p.id AND u.status='occupied') AS occupied_units,(SELECT COUNT(*) FROM maintenance_requests m WHERE m.property_id=p.id AND m.status!='completed') AS open_maintenance FROM properties p WHERE ${scope.sql}`,
      )
      .bind(...scope.values)
      .all();
    const balances = await db
      .prepare(
        `SELECT p.id AS property_id,l.currency,COALESCE(SUM(c.amount),0) AS outstanding FROM properties p JOIN leases l ON l.property_id=p.id JOIN charges c ON c.lease_id=l.id AND c.status='open' WHERE ${scope.sql} GROUP BY p.id,l.currency`,
      )
      .bind(...scope.values)
      .all();
    const collected = await db
      .prepare(
        `SELECT p.id AS property_id,l.currency,SUM(r.amount) AS collected FROM properties p JOIN leases l ON l.property_id=p.id JOIN payments r ON r.lease_id=l.id WHERE ${scope.sql} AND strftime('%Y-%m',r.paid_at)=strftime('%Y-%m','now') GROUP BY p.id,l.currency`,
      )
      .bind(...scope.values)
      .all();
    return Response.json({
      properties: properties.results,
      balances: balances.results,
      collected: collected.results,
      period: new Date().toISOString().slice(0, 7),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
