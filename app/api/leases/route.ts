import {
  managementScope,
  permittedPropertyIds,
  requirePermission,
  auditStatement,
} from "@/lib/authorization";
import {
  AccessError,
  currentAccount,
  database,
  errorResponse,
  isEmail,
  stringField,
} from "@/lib/data";

export const dynamic = "force-dynamic";

type LeaseRow = {
  id: string;
  property_id: string;
  property_name: string;
  unit_id: string | null;
  unit_name: string | null;
  resident_email: string;
  resident_name: string;
  monthly_rent: number;
  currency: string;
  due_day: number;
  start_date: string;
  end_date: string | null;
  status: string;
  balance: number;
  open_charge_id: string | null;
  next_due_date: string | null;
};

export async function GET() {
  try {
    const account = await currentAccount();
    if (!account)
      throw new AccessError("Please sign in to manage residents.", 401);
    const db = await database();
    const fields =
      "l.id, l.property_id, p.name AS property_name, l.unit_id, u.name AS unit_name, l.resident_email, l.resident_name, l.monthly_rent, l.currency, l.due_day, l.start_date, l.end_date, l.status, (SELECT status FROM tenancies WHERE lease_id=l.id) AS tenancy_status, COALESCE((SELECT SUM(amount) FROM charges WHERE lease_id = l.id AND status = 'open'), 0) AS balance, (SELECT id FROM charges WHERE lease_id = l.id AND status = 'open' ORDER BY due_date ASC LIMIT 1) AS open_charge_id, (SELECT due_date FROM charges WHERE lease_id = l.id AND status = 'open' ORDER BY due_date ASC LIMIT 1) AS next_due_date";
    const scope = await managementScope(account, "lease.view", "l.property_id");
    const result = await db
      .prepare(
        "SELECT " +
          fields +
          " FROM leases l JOIN properties p ON p.id=l.property_id LEFT JOIN units u ON u.id=l.unit_id WHERE " +
          scope.sql +
          " ORDER BY l.created_at DESC",
      )
      .bind(...scope.values)
      .all<LeaseRow>();
    const financial = await permittedPropertyIds(account, "payment.view");
    return Response.json({
      leases: result.results.map((row) => {
        if (financial === null || financial.includes(row.property_id))
          return row;
        const { balance, open_charge_id, next_due_date, ...lease } = row;
        void balance;
        void open_charge_id;
        void next_due_date;
        return lease;
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const propertyId = stringField(payload.propertyId, 100);
    const manager = await requirePermission(propertyId, "lease.create");
    const applicationId = stringField(payload.applicationId) || null;
    const unitId = stringField(payload.unitId, 100) || null;
    const residentName = stringField(payload.residentName, 100);
    const residentEmail = stringField(payload.residentEmail, 150).toLowerCase();
    const monthlyRent = Number(payload.monthlyRent);
    const currency = ["BIF", "USD", "EUR"].includes(String(payload.currency))
      ? String(payload.currency)
      : "BIF";
    const dueDay = Number(payload.dueDay);
    const startDate = stringField(payload.startDate, 20);
    const dueDate = stringField(payload.dueDate, 20);
    if (
      !residentName ||
      !isEmail(residentEmail) ||
      !Number.isInteger(monthlyRent) ||
      monthlyRent < 0 ||
      !Number.isInteger(dueDay) ||
      dueDay < 1 ||
      dueDay > 28 ||
      !startDate ||
      !dueDate
    ) {
      return Response.json(
        { error: "Add resident details, rent, and a valid due date." },
        { status: 400 },
      );
    }
    const db = await database();
    const property = await db
      .prepare("SELECT id FROM properties WHERE id = ?")
      .bind(propertyId)
      .first();
    if (!property)
      return Response.json({ error: "Property not found." }, { status: 404 });
    if (unitId) {
      const unit = await db
        .prepare("SELECT id FROM units WHERE id = ? AND property_id = ?")
        .bind(unitId, propertyId)
        .first();
      if (!unit)
        return Response.json(
          { error: "Choose a unit from this property." },
          { status: 400 },
        );
    }
    if (
      unitId &&
      (await db
        .prepare(
          "SELECT id FROM leases WHERE unit_id=? AND status IN ('active','pending')",
        )
        .bind(unitId)
        .first())
    )
      throw new AccessError(
        "This unit already has an active or pending lease.",
        409,
      );
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
    )
      throw new AccessError("Enter valid lease dates.", 400);
    if (applicationId) {
      const application = await db
        .prepare(
          "SELECT a.email,w.unit_id FROM applications a JOIN application_workflows w ON w.application_id=a.id WHERE a.id=? AND a.property_id=? AND w.stage='approved'",
        )
        .bind(applicationId, propertyId)
        .first<{ email: string; unit_id: string | null }>();
      if (
        !application ||
        application.email !== residentEmail ||
        (application.unit_id && application.unit_id !== unitId)
      )
        throw new AccessError(
          "Use the approved application's property, applicant and unit.",
          400,
        );
      if (
        await db
          .prepare(
            "SELECT lease_id FROM application_leases WHERE application_id=?",
          )
          .bind(applicationId)
          .first()
      )
        throw new AccessError("This application already has a lease.", 409);
    }
    const account = await db
      .prepare("SELECT id FROM accounts WHERE email = ?")
      .bind(residentEmail)
      .first<{ id: string }>();
    const firstChargeId = crypto.randomUUID();
    const lease: LeaseRow = {
      id: crypto.randomUUID(),
      property_id: propertyId,
      property_name: "",
      unit_id: unitId,
      unit_name: null,
      resident_email: residentEmail,
      resident_name: residentName,
      monthly_rent: monthlyRent,
      currency,
      due_day: dueDay,
      start_date: startDate,
      end_date: null,
      status: "pending",
      balance: monthlyRent,
      open_charge_id: firstChargeId,
      next_due_date: dueDate,
    };
    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          "INSERT INTO leases (id, property_id, unit_id, resident_account_id, resident_email, resident_name, monthly_rent, currency, due_day, start_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
        )
        .bind(
          lease.id,
          propertyId,
          unitId,
          account?.id ?? null,
          residentEmail,
          residentName,
          monthlyRent,
          currency,
          dueDay,
          startDate,
        ),
      db
        .prepare(
          "INSERT INTO charges (id, lease_id, kind, description, amount, due_date, status) VALUES (?, ?, 'rent', ?, ?, ?, 'open')",
        )
        .bind(
          firstChargeId,
          lease.id,
          "Rent due " + dueDate.slice(0, 7),
          monthlyRent,
          dueDate,
        ),
    ];
    if (unitId)
      statements.push(
        db
          .prepare("UPDATE units SET status = 'reserved' WHERE id = ?")
          .bind(unitId),
      );
    if (applicationId)
      statements.push(
        db
          .prepare(
            "INSERT INTO application_leases (application_id,lease_id) VALUES (?,?)",
          )
          .bind(applicationId, lease.id),
      );
    const tenancyId = crypto.randomUUID();
    statements.push(
      db
        .prepare(
          "INSERT INTO tenancies (id, property_id, unit_id, lease_id, status, start_date) VALUES (?,?,?,?,'pending_move_in',?)",
        )
        .bind(tenancyId, propertyId, unitId, lease.id, startDate),
      db
        .prepare(
          "INSERT INTO household_members (id,tenancy_id,account_id,email,name) VALUES (?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          tenancyId,
          account?.id ?? null,
          residentEmail,
          residentName,
        ),
      auditStatement(db, manager, propertyId, "lease.created", lease.id),
    );
    await db.batch(statements);
    return Response.json({ lease }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
