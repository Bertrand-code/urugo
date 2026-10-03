import {
  database,
  requireAccount,
  errorResponse,
  stringField,
} from "@/lib/data";
import { managementScope } from "@/lib/authorization";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const account = await requireAccount();
    const q = stringField(new URL(request.url).searchParams.get("q"), 80);
    if (q.length < 2) return Response.json({ results: [] });
    const db = await database();
    const term = "%" + q + "%";
    const [property, application, lease, maintenance] = await Promise.all([
      managementScope(account, "property.view", "p.id"),
      managementScope(account, "application.view", "a.property_id"),
      managementScope(account, "lease.view", "l.property_id"),
      managementScope(account, "maintenance.view", "m.property_id"),
    ]);
    const rows = await Promise.all([
      db
        .prepare(
          "SELECT p.id,p.id AS property_id,p.name AS title,p.neighborhood AS subtitle,'properties' AS tab FROM properties p WHERE (" +
            property.sql +
            ") AND (p.name LIKE ? OR p.city LIKE ?) LIMIT 8",
        )
        .bind(...property.values, term, term)
        .all(),
      db
        .prepare(
          "SELECT a.id,a.property_id,a.full_name AS title,p.name AS subtitle,'applications' AS tab FROM applications a JOIN properties p ON p.id=a.property_id JOIN application_workflows w ON w.application_id=a.id WHERE (" +
            application.sql +
            ") AND w.stage!='draft' AND a.full_name LIKE ? LIMIT 8",
        )
        .bind(...application.values, term)
        .all(),
      db
        .prepare(
          "SELECT l.id,l.property_id,l.resident_name AS title,p.name AS subtitle,'residents' AS tab FROM leases l JOIN properties p ON p.id=l.property_id WHERE (" +
            lease.sql +
            ") AND l.resident_name LIKE ? LIMIT 8",
        )
        .bind(...lease.values, term)
        .all(),
      db
        .prepare(
          "SELECT m.id,m.property_id,m.title,p.name AS subtitle,'maintenance' AS tab FROM maintenance_requests m JOIN properties p ON p.id=m.property_id WHERE (" +
            maintenance.sql +
            ") AND m.title LIKE ? LIMIT 8",
        )
        .bind(...maintenance.values, term)
        .all(),
    ]);
    return Response.json({ results: rows.flatMap((r) => r.results) });
  } catch (error) {
    return errorResponse(error);
  }
}
