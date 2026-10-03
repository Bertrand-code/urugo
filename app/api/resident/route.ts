import { personalLeaseIds } from "@/lib/authorization";
import {
  AccessError,
  currentAccount,
  database,
  errorResponse,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const account = await currentAccount();
    if (!account)
      throw new AccessError(
        "Please sign in to view your resident portal.",
        401,
      );
    const db = await database();
    const ownIds = await personalLeaseIds(account);
    const ownCondition = ownIds.length
      ? "l.id IN (" + ownIds.map(() => "?").join(",") + ")"
      : "0=1";
    const leases = await db
      .prepare(
        "SELECT l.id, l.property_id, p.name AS property_name, p.address, p.city, u.name AS unit_name, l.monthly_rent, l.currency, l.due_day, l.start_date, l.end_date, l.status FROM leases l INNER JOIN properties p ON p.id = l.property_id LEFT JOIN units u ON u.id = l.unit_id WHERE " +
          ownCondition +
          " ORDER BY l.created_at DESC",
      )
      .bind(...ownIds)
      .all<{
        id: string;
        property_id: string;
        property_name: string;
        address: string;
        city: string;
        unit_name: string | null;
        monthly_rent: number;
        currency: string;
        due_day: number;
        start_date: string;
        end_date: string | null;
        status: string;
      }>();
    const leaseIds = leases.results.map((lease) => lease.id);
    let charges: Record<string, unknown>[] = [];
    let payments: Record<string, unknown>[] = [];
    if (leaseIds.length) {
      const placeholders = leaseIds.map(() => "?").join(", ");
      charges = (
        await db
          .prepare(
            "SELECT id, lease_id, kind, description, amount, due_date, status FROM charges WHERE lease_id IN (" +
              placeholders +
              ") ORDER BY due_date ASC",
          )
          .bind(...leaseIds)
          .all<Record<string, unknown>>()
      ).results;
      payments = (
        await db
          .prepare(
            "SELECT id, lease_id, amount, method, reference, paid_at FROM payments WHERE lease_id IN (" +
              placeholders +
              ") ORDER BY paid_at DESC",
          )
          .bind(...leaseIds)
          .all<Record<string, unknown>>()
      ).results;
    }
    const balance = charges
      .filter((charge) => charge.status === "open")
      .reduce((sum, charge) => sum + Number(charge.amount), 0);
    return Response.json({
      resident: { name: account.display_name, email: account.email },
      leases: leases.results,
      charges,
      payments,
      balance,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
