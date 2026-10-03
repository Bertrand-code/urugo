import { AccessError, database, requireAccount, type Account } from "./data";
import { permissions, roleAllows, type Permission } from "./permissions";

export async function assignments(account: Account) {
  const db = await database();
  const rows = await db
    .prepare(
      `SELECT property_id, role FROM staff_assignments WHERE account_id = ? AND status = 'active'
    UNION SELECT property_id, role FROM ownerships WHERE account_id = ? AND status = 'active'`,
    )
    .bind(account.id, account.id)
    .all<{ property_id: string; role: string }>();
  return rows.results;
}
export async function permittedPropertyIds(
  account: Account,
  permission: Permission,
): Promise<string[] | null> {
  if (account.role === "admin") return null;
  return [
    ...new Set(
      (await assignments(account))
        .filter((row) => roleAllows(row.role, permission))
        .map((row) => row.property_id),
    ),
  ];
}
export async function can(
  account: Account,
  permission: Permission,
  propertyId: string,
) {
  const ids = await permittedPropertyIds(account, permission);
  return ids === null || ids.includes(propertyId);
}
export async function requirePermission(
  propertyId: string,
  permission: Permission,
) {
  const account = await requireAccount();
  const db = await database();
  if (
    !(await db
      .prepare("SELECT id FROM properties WHERE id = ?")
      .bind(propertyId)
      .first())
  )
    throw new AccessError("Property not found.", 404);
  if (!(await can(account, permission, propertyId)))
    throw new AccessError(
      "Your access does not allow this action at this property.",
      403,
    );
  return account;
}
export async function managementScope(
  account: Account,
  permission: Permission,
  column: string,
) {
  const ids = await permittedPropertyIds(account, permission);
  return ids === null
    ? { sql: "1=1", values: [] as string[] }
    : {
        sql: ids.length
          ? `${column} IN (${ids.map(() => "?").join(",")})`
          : "0=1",
        values: ids,
      };
}
export async function personalLeaseIds(
  account: Account,
  includeFormer = false,
) {
  const db = await database();
  return (
    await db
      .prepare(
        `SELECT t.lease_id FROM tenancies t JOIN household_members h ON h.tenancy_id = t.id WHERE h.account_id = ? AND h.relationship IN ('primary','co_resident','guarantor') ${includeFormer ? "" : "AND t.status != 'former'"}`,
      )
      .bind(account.id)
      .all<{ lease_id: string }>()
  ).results.map((row) => row.lease_id);
}
export async function contextFor(account: Account) {
  const db = await database();
  const relations = await assignments(account);
  const properties =
    account.role === "admin"
      ? (
          await db
            .prepare("SELECT id, name FROM properties ORDER BY name")
            .all<{ id: string; name: string }>()
        ).results
      : (
          await db
            .prepare(
              "SELECT DISTINCT p.id, p.name FROM properties p WHERE EXISTS (SELECT 1 FROM ownerships o WHERE o.property_id=p.id AND o.account_id=? AND o.status='active') OR EXISTS (SELECT 1 FROM staff_assignments s WHERE s.property_id=p.id AND s.account_id=? AND s.status='active') ORDER BY p.name",
            )
            .bind(account.id, account.id)
            .all<{ id: string; name: string }>()
        ).results;
  return properties.map((p) => ({
    ...p,
    roles:
      account.role === "admin"
        ? ["admin"]
        : relations.filter((r) => r.property_id === p.id).map((r) => r.role),
    permissions:
      account.role === "admin"
        ? [...permissions]
        : permissions.filter((permission) =>
            relations.some(
              (r) => r.property_id === p.id && roleAllows(r.role, permission),
            ),
          ),
  }));
}
export function auditStatement(
  db: D1Database,
  account: Account,
  propertyId: string,
  action: string,
  resourceId: string,
) {
  return db
    .prepare(
      "INSERT INTO audit_events (id, actor_id, property_id, action, resource_id) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(crypto.randomUUID(), account.id, propertyId, action, resourceId);
}
