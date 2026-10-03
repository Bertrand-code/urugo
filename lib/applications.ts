import { stringField } from "./data";
export const stages = [
  "draft",
  "submitted",
  "needs_information",
  "under_review",
  "screening",
  "approved",
  "denied",
  "withdrawn",
] as const;
export type ApplicationStage = (typeof stages)[number];
export const legacyStatus = (stage: string) =>
  stage === "approved"
    ? "accepted"
    : stage === "denied" || stage === "withdrawn"
      ? "declined"
      : stage === "under_review" ||
          stage === "screening" ||
          stage === "needs_information"
        ? "reviewing"
        : "new";
export const applicationFields =
  "a.id,a.property_id,p.name AS property_name,a.full_name,a.email,a.phone,a.move_in_date,a.household_size,a.message,a.status,a.created_at,w.unit_id,u.name AS unit_name,w.stage,w.updated_at,w.assigned_to";
export const applicationJoin =
  "applications a JOIN properties p ON p.id=a.property_id JOIN application_workflows w ON w.application_id=a.id LEFT JOIN units u ON u.id=w.unit_id";
// Allowlist reusable fields. Never accept identity, screening, bank, or SSN data here.
export function profileData(value: unknown) {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    [
      "fullName",
      "phone",
      "household",
      "employment",
      "income",
      "rentalHistory",
      "pets",
      "vehicles",
      "references",
    ].map((key) => [key, stringField(input[key], 1000)]),
  );
}
