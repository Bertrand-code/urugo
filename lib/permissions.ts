export const permissions = [
  "property.view",
  "property.edit",
  "listing.manage",
  "unit.view",
  "unit.manage",
  "application.view",
  "application.review",
  "resident.view",
  "lease.view",
  "lease.create",
  "lease.manage",
  "payment.view",
  "payment.manage",
  "maintenance.view",
  "maintenance.create",
  "maintenance.update",
  "document.view",
  "document.manage",
  "message.view",
  "message.send",
  "team.view",
  "team.manage",
  "report.view",
  "financial.view",
] as const;
export type Permission = (typeof permissions)[number];
export const rolePermissions = {
  property_manager: [...permissions],
  leasing_agent: [
    "property.view",
    "unit.view",
    "application.view",
    "application.review",
    "resident.view",
    "lease.view",
    "lease.create",
    "message.view",
    "message.send",
  ],
  maintenance_technician: [
    "property.view",
    "unit.view",
    "maintenance.view",
    "maintenance.create",
    "maintenance.update",
  ],
  accountant: [
    "property.view",
    "lease.view",
    "payment.view",
    "payment.manage",
    "financial.view",
    "report.view",
  ],
  owner: [...permissions],
  investor: ["property.view", "report.view", "financial.view"],
} satisfies Record<string, readonly Permission[]>;
export type StaffRole = keyof typeof rolePermissions;
export function roleAllows(role: string, permission: Permission): boolean {
  return (
    Object.hasOwn(rolePermissions, role) &&
    (rolePermissions[role as StaffRole] as readonly string[]).includes(
      permission,
    )
  );
}
export const roleLabels: Record<StaffRole, string> = {
  property_manager: "Property Manager",
  leasing_agent: "Leasing Agent",
  maintenance_technician: "Maintenance Technician",
  accountant: "Accountant",
  owner: "Owner",
  investor: "Investor / Viewer",
};
