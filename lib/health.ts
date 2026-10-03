import { AccessError, type Account, database } from "./data";
import {
  type Input,
  field,
  choice,
  futureDate,
  facility,
  requireFacility,
  requireVerified,
  facilityScope,
  audit,
  conflict,
  expireHealthRequests,
} from "./products";

export async function healthSearch(url: URL) {
  const db = await database(),
    p = url.searchParams,
    q = (p.get("q") || "").trim().slice(0, 100),
    city = (p.get("city") || "").trim().slice(0, 100);
  const f = await db
    .prepare(
      "SELECT id,name,kind,city,address,phone,hours,verified_at FROM health_facilities WHERE status='verified' AND city LIKE ? AND name LIKE ? ORDER BY name LIMIT 100",
    )
    .bind("%" + city + "%", "%" + (p.get("provider") || "").slice(0, 100) + "%")
    .all();
  const inventory = await db
    .prepare(
      "SELECT i.id,i.facility_id,i.name,i.generic_name,i.strength,i.form,i.availability,i.updated_at,CASE WHEN datetime(i.updated_at)<datetime('now','-1 day') THEN 1 ELSE 0 END AS stale,f.name AS facility_name,f.city,f.address,f.phone,f.hours FROM medicine_inventory i JOIN health_facilities f ON f.id=i.facility_id WHERE f.status='verified' AND f.kind='pharmacy' AND (i.name||' '||i.generic_name||' '||i.strength||' '||i.form) LIKE ? AND f.city LIKE ? ORDER BY i.name,i.updated_at DESC LIMIT 100",
    )
    .bind("%" + q + "%", "%" + city + "%")
    .all();
  const slots = await db
    .prepare(
      "SELECT s.id,s.facility_id,s.service,s.practitioner,s.starts_at,s.ends_at,f.name AS facility_name,f.city,f.address,f.phone FROM appointment_slots s JOIN health_facilities f ON f.id=s.facility_id WHERE f.status='verified' AND f.kind='clinic' AND s.status='open' AND datetime(s.starts_at)>datetime('now') AND f.city LIKE ? AND (s.service||' '||s.practitioner||' '||f.name) LIKE ? AND NOT EXISTS(SELECT 1 FROM health_appointments a WHERE a.slot_id=s.id AND a.status IN('requested','confirmed')) ORDER BY s.starts_at LIMIT 100",
    )
    .bind("%" + city + "%", "%" + q + "%")
    .all();
  return {
    facilities: f.results,
    inventory: inventory.results,
    slots: slots.results,
    limit: 100,
  };
}
export async function healthWorkspace(a: Account) {
  const db = await database();
  await expireHealthRequests(db);
  const scope = facilityScope();
  const [
    facilities,
    inventory,
    slots,
    requests,
    appointments,
    mine,
    bookings,
    review,
    staff,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT f.*,CASE WHEN f.owner_id=? THEN 1 ELSE 0 END AS can_manage_team FROM health_facilities f WHERE ${scope} ORDER BY f.name`,
      )
      .bind(a.id, a.id, a.id)
      .all(),
    db
      .prepare(
        `SELECT i.*,f.name AS facility_name FROM medicine_inventory i JOIN health_facilities f ON f.id=i.facility_id WHERE ${scope} ORDER BY i.name LIMIT 500`,
      )
      .bind(a.id, a.id)
      .all(),
    db
      .prepare(
        `SELECT s.*,f.name AS facility_name FROM appointment_slots s JOIN health_facilities f ON f.id=s.facility_id WHERE ${scope} ORDER BY s.starts_at DESC LIMIT 200`,
      )
      .bind(a.id, a.id)
      .all(),
    db
      .prepare(
        `SELECT r.id,r.status,r.patient_name,r.created_at,r.hold_until,i.name,i.strength,i.form,i.facility_id,f.name AS facility_name FROM medicine_requests r JOIN medicine_inventory i ON i.id=r.inventory_id JOIN health_facilities f ON f.id=i.facility_id WHERE ${scope} ORDER BY r.created_at DESC LIMIT 200`,
      )
      .bind(a.id, a.id)
      .all(),
    db
      .prepare(
        `SELECT a.id,a.status,a.patient_name,a.created_at,s.facility_id,s.service,s.practitioner,s.starts_at,s.ends_at,f.name AS facility_name FROM health_appointments a JOIN appointment_slots s ON s.id=a.slot_id JOIN health_facilities f ON f.id=s.facility_id WHERE ${scope} ORDER BY s.starts_at DESC LIMIT 200`,
      )
      .bind(a.id, a.id)
      .all(),
    db
      .prepare(
        "SELECT r.id,r.status,r.created_at,r.hold_until,i.name,i.strength,i.form,f.name AS facility_name,f.phone,f.address,f.city,f.status AS facility_status FROM medicine_requests r JOIN medicine_inventory i ON i.id=r.inventory_id JOIN health_facilities f ON f.id=i.facility_id WHERE r.patient_id=? ORDER BY r.created_at DESC LIMIT 100",
      )
      .bind(a.id)
      .all(),
    db
      .prepare(
        "SELECT a.id,a.status,a.created_at,s.service,s.practitioner,s.starts_at,s.ends_at,f.name AS facility_name,f.phone,f.address,f.city,f.status AS facility_status FROM health_appointments a JOIN appointment_slots s ON s.id=a.slot_id JOIN health_facilities f ON f.id=s.facility_id WHERE a.patient_id=? ORDER BY s.starts_at DESC LIMIT 100",
      )
      .bind(a.id)
      .all(),
    a.role === "admin"
      ? db
          .prepare(
            "SELECT id,name,kind,city,address,phone,hours,license,status,review_note,verified_at FROM health_facilities ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,created_at DESC LIMIT 100",
          )
          .all()
      : Promise.resolve({ results: [] }),
    db
      .prepare(
        "SELECT hs.id,hs.facility_id,hs.status,a.display_name,a.email FROM health_staff hs JOIN health_facilities f ON f.id=hs.facility_id JOIN accounts a ON a.id=hs.account_id WHERE f.owner_id=? ORDER BY a.display_name",
      )
      .bind(a.id)
      .all(),
  ]);
  return {
    facilities: facilities.results,
    inventory: inventory.results,
    slots: slots.results,
    requests: requests.results,
    appointments: appointments.results,
    mine: mine.results,
    bookings: bookings.results,
    review: review.results,
    staff: staff.results,
    isAdmin: a.role === "admin",
  };
}

export async function createHealth(a: Account, resource: string, b: Input) {
  const db = await database(),
    id = crypto.randomUUID();
  if (resource === "facilities") {
    const values = [
      id,
      a.id,
      field(b, "name", 150),
      choice(b, "kind", ["pharmacy", "clinic"]),
      field(b, "city", 100),
      field(b, "address", 250),
      field(b, "phone", 50),
      field(b, "hours", 300),
      field(b, "license", 150),
    ];
    await db.batch([
      db
        .prepare(
          "INSERT INTO health_facilities(id,owner_id,name,kind,city,address,phone,hours,license) VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .bind(...values),
      audit(db, a, "health.facility.registered", id),
    ]);
  } else if (resource === "inventory") {
    const f = await requireFacility(
      a,
      field(b, "facility_id", 100),
      "pharmacy",
    );
    // Providers can prepare their catalog while waiting for verification. It remains private.
    await db
      .prepare(
        "INSERT INTO medicine_inventory(id,facility_id,name,generic_name,strength,form,availability) VALUES(?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        f.id,
        field(b, "name", 150),
        field(b, "generic_name", 150, true),
        field(b, "strength", 80),
        field(b, "form", 80),
        choice(b, "availability", ["available", "unavailable", "unknown"]),
      )
      .run();
  } else if (resource === "slots") {
    const f = await requireFacility(a, field(b, "facility_id", 100), "clinic");
    const start = futureDate(b, "starts_at"),
      end = futureDate(b, "ends_at"),
      practitioner = field(b, "practitioner", 120),
      service = field(b, "service", 120);
    if (end <= start || Date.parse(end) - Date.parse(start) > 8 * 3600000)
      throw new AccessError(
        "Appointments must end after they start and last no more than eight hours.",
        400,
      );
    // Atomic insertion prevents overlapping appointments for the same practitioner.
    const result = await db
      .prepare(
        "INSERT INTO appointment_slots(id,facility_id,service,practitioner,starts_at,ends_at) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM appointment_slots WHERE facility_id=? AND lower(practitioner)=lower(?) AND status='open' AND starts_at<? AND ends_at>?)",
      )
      .bind(
        id,
        f.id,
        service,
        practitioner,
        start,
        end,
        f.id,
        practitioner,
        end,
        start,
      )
      .run();
    if (!result.meta.changes)
      throw new AccessError(
        "This practitioner already has a slot during that time.",
        409,
      );
  } else if (resource === "requests") {
    await expireHealthRequests(db);
    const inventoryId = field(b, "inventory_id", 100),
      i = await db
        .prepare(
          "SELECT i.id,i.facility_id FROM medicine_inventory i JOIN health_facilities f ON f.id=i.facility_id WHERE i.id=? AND f.status='verified' AND f.kind='pharmacy'",
        )
        .bind(inventoryId)
        .first<{ id: string; facility_id: string }>();
    if (!i) throw new AccessError("Medicine listing not found.", 404);
    // No clinical history, prescriptions, symptoms, or payment details collected.
    try {
      const result = await db
        .prepare(
          "INSERT INTO medicine_requests(id,inventory_id,patient_id,patient_name) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM health_facilities WHERE id=? AND status='verified')",
        )
        .bind(id, i.id, a.id, a.display_name, i.facility_id)
        .run();
      if (!result.meta.changes)
        throw new AccessError(
          "This pharmacy is no longer accepting requests.",
          409,
        );
    } catch (e) {
      conflict(
        e,
        "You already have an active request for this medicine. Check My requests.",
      );
    }
  } else if (resource === "appointments") {
    const slotId = field(b, "slot_id", 100);
    try {
      const result = await db
        .prepare(
          "INSERT INTO health_appointments(id,slot_id,patient_id,patient_name) SELECT ?,s.id,?,? FROM appointment_slots s JOIN health_facilities f ON f.id=s.facility_id WHERE s.id=? AND s.status='open' AND f.status='verified' AND f.kind='clinic' AND datetime(s.starts_at)>datetime('now')",
        )
        .bind(id, a.id, a.display_name, slotId)
        .run();
      if (!result.meta.changes)
        throw new AccessError("This appointment is no longer available.", 409);
    } catch (e) {
      conflict(
        e,
        "Someone has already requested this time. Choose another appointment.",
      );
    }
  } else if (resource === "team") {
    const f = await facility(field(b, "facility_id", 100));
    if (f.owner_id !== a.id)
      throw new AccessError(
        "Only the provider account owner can manage its team.",
        403,
      );
    const email = field(b, "email", 254).toLowerCase();
    const member = await db
      .prepare("SELECT id FROM accounts WHERE email=?")
      .bind(email)
      .first<{ id: string }>();
    if (!member)
      throw new AccessError(
        "Ask this person to sign in to Urugo first, then add their account email.",
        400,
      );
    if (member.id === a.id)
      throw new AccessError("You already own this provider account.", 400);
    await db.batch([
      db
        .prepare(
          "INSERT INTO health_staff(id,facility_id,account_id,status) VALUES(?,?,?,'active') ON CONFLICT(account_id,facility_id) DO UPDATE SET status='active'",
        )
        .bind(id, f.id, member.id),
      audit(db, a, "health.staff.granted", f.id + ":" + member.id),
    ]);
  } else throw new AccessError("Route not found.", 404);
  return { id };
}

export async function updateHealth(
  a: Account,
  resource: string,
  id: string,
  b: Input,
) {
  const db = await database();
  if (resource === "facilities") {
    const f = await facility(id),
      action = field(b, "action", 30);
    if (action === "review") {
      if (a.role !== "admin")
        throw new AccessError(
          "Only platform administrators can verify providers.",
          403,
        );
      const status = choice(b, "status", ["verified", "suspended"]),
        note = field(b, "note", 500);
      if (status === "verified" && b.attested !== true)
        throw new AccessError(
          "Confirm that the licence and business contact were independently checked.",
          400,
        );
      const statements = [
        db
          .prepare(
            "UPDATE health_facilities SET status=?,review_note=?,verified_at=CASE WHEN ?='verified' THEN CURRENT_TIMESTAMP ELSE verified_at END,verified_by=? WHERE id=?",
          )
          .bind(status, note, status, a.id, id),
        audit(db, a, "health.facility." + status, id),
      ];
      if (status === "suspended") {
        statements.push(
          db
            .prepare(
              "UPDATE medicine_requests SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE inventory_id IN(SELECT id FROM medicine_inventory WHERE facility_id=?) AND status IN('requested','confirmed')",
            )
            .bind(id),
        );
        statements.push(
          db
            .prepare(
              "UPDATE health_appointments SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE slot_id IN(SELECT id FROM appointment_slots WHERE facility_id=?) AND status IN('requested','confirmed')",
            )
            .bind(id),
        );
      }
      await db.batch(statements);
    } else if (action === "contact") {
      if (f.owner_id !== a.id)
        throw new AccessError(
          "Only the provider account owner can edit its public details.",
          403,
        );
      // Operational hours can change without changing verified identity/address.
      await db.batch([
        db
          .prepare("UPDATE health_facilities SET hours=? WHERE id=?")
          .bind(field(b, "hours", 300), id),
        audit(db, a, "health.hours.updated", id),
      ]);
    } else throw new AccessError("Unknown action.", 400);
  } else if (resource === "inventory") {
    const i = await db
      .prepare("SELECT facility_id FROM medicine_inventory WHERE id=?")
      .bind(id)
      .first<{ facility_id: string }>();
    if (!i) throw new AccessError("Medicine listing not found.", 404);
    await requireFacility(a, i.facility_id, "pharmacy");
    // Identity stays immutable once requests reference it: create a new entry for
    // a different strength/form rather than silently changing a patient's request.
    const availability = choice(b, "availability", [
      "available",
      "unavailable",
      "unknown",
    ]);
    await db.batch([
      db
        .prepare(
          "UPDATE medicine_inventory SET availability=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .bind(availability, id),
      audit(db, a, "health.stock.updated", id),
    ]);
  } else if (resource === "slots") {
    const s = await db
      .prepare("SELECT facility_id FROM appointment_slots WHERE id=?")
      .bind(id)
      .first<{ facility_id: string }>();
    if (!s) throw new AccessError("Appointment slot not found.", 404);
    await requireFacility(a, s.facility_id, "clinic");
    choice(b, "status", ["closed"]);
    await db.batch([
      db
        .prepare("UPDATE appointment_slots SET status='closed' WHERE id=?")
        .bind(id),
      db
        .prepare(
          "UPDATE health_appointments SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE slot_id=? AND status IN('requested','confirmed')",
        )
        .bind(id),
      audit(db, a, "health.slot.closed", id),
    ]);
  } else if (resource === "requests") {
    await expireHealthRequests(db);
    const r = await db
      .prepare(
        "SELECT r.patient_id,r.status,i.facility_id FROM medicine_requests r JOIN medicine_inventory i ON i.id=r.inventory_id WHERE r.id=?",
      )
      .bind(id)
      .first<{ patient_id: string; status: string; facility_id: string }>();
    if (!r) throw new AccessError("Request not found.", 404);
    const status = choice(b, "status", [
      "confirmed",
      "unavailable",
      "collected",
      "cancelled",
    ]);
    if (r.patient_id === a.id) {
      if (status !== "cancelled")
        throw new AccessError(
          "Only the pharmacy can confirm availability.",
          403,
        );
    } else {
      const f = await requireFacility(a, r.facility_id, "pharmacy");
      requireVerified(f);
    }
    const allowed: Record<string, string[]> = {
      requested: ["confirmed", "unavailable", "cancelled"],
      confirmed: ["collected", "cancelled", "unavailable"],
    };
    if (!allowed[r.status]?.includes(status))
      throw new AccessError(
        "This request has changed or is no longer active.",
        409,
      );
    const hold = status === "confirmed" ? futureDate(b, "hold_until", 2) : null;
    const results = await db.batch([
      db
        .prepare(
          "UPDATE medicine_requests SET status=?,hold_until=COALESCE(?,hold_until),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?",
        )
        .bind(status, hold, id, r.status),
      audit(db, a, "health.request." + status, id),
    ]);
    if (!results[0].meta.changes)
      throw new AccessError(
        "This request changed. Refresh and try again.",
        409,
      );
  } else if (resource === "appointments") {
    await expireHealthRequests(db);
    const r = await db
      .prepare(
        "SELECT a.patient_id,a.status,s.facility_id,s.starts_at,s.ends_at FROM health_appointments a JOIN appointment_slots s ON s.id=a.slot_id WHERE a.id=?",
      )
      .bind(id)
      .first<{
        patient_id: string;
        status: string;
        facility_id: string;
        starts_at: string;
        ends_at: string;
      }>();
    if (!r) throw new AccessError("Appointment not found.", 404);
    const status = choice(b, "status", [
      "confirmed",
      "declined",
      "cancelled",
      "completed",
    ]);
    if (r.patient_id === a.id) {
      if (status !== "cancelled")
        throw new AccessError(
          "Only the clinic can confirm an appointment.",
          403,
        );
    } else {
      const f = await requireFacility(a, r.facility_id, "clinic");
      requireVerified(f);
    }
    const allowed: Record<string, string[]> = {
      requested: ["confirmed", "declined", "cancelled"],
      confirmed: ["completed", "cancelled"],
    };
    if (!allowed[r.status]?.includes(status))
      throw new AccessError(
        "This appointment has changed or is no longer active.",
        409,
      );
    if (status === "completed" && Date.parse(r.ends_at) > Date.now())
      throw new AccessError("Mark attendance after the appointment ends.", 400);
    if (status === "confirmed" && Date.parse(r.starts_at) <= Date.now())
      throw new AccessError("This appointment time has passed.", 409);
    const results = await db.batch([
      db
        .prepare(
          "UPDATE health_appointments SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?",
        )
        .bind(status, id, r.status),
      audit(db, a, "health.appointment." + status, id),
    ]);
    if (!results[0].meta.changes)
      throw new AccessError(
        "This appointment changed. Refresh and try again.",
        409,
      );
  } else if (resource === "team") {
    const member = await db
      .prepare(
        "SELECT hs.facility_id,f.owner_id FROM health_staff hs JOIN health_facilities f ON f.id=hs.facility_id WHERE hs.id=?",
      )
      .bind(id)
      .first<{ facility_id: string; owner_id: string }>();
    if (!member || member.owner_id !== a.id)
      throw new AccessError("Team member not found.", 404);
    const status = choice(b, "status", ["active", "revoked"]);
    await db.batch([
      db
        .prepare("UPDATE health_staff SET status=? WHERE id=?")
        .bind(status, id),
      audit(db, a, "health.staff." + status, id),
    ]);
  } else throw new AccessError("Route not found.", 404);
  return { ok: true };
}
