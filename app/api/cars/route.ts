import { database, errorResponse, requireAccount } from "@/lib/data";
import {
  input,
  field,
  choice,
  whole,
  publicVehicleColumns,
  vehiclePhoto,
  audit,
} from "@/lib/products";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const db = await database(),
      p = new URL(request.url).searchParams;
    const clauses = ["v.status='published'"],
      args: (string | number)[] = [];
    const q = (p.get("q") || "").trim().slice(0, 100);
    if (q) {
      clauses.push("(v.make||' '||v.model||' '||v.city) LIKE ?");
      args.push("%" + q + "%");
    }
    for (const key of ["transmission", "fuel", "currency"]) {
      const value = p.get(key);
      if (value) {
        clauses.push(`v.${key}=?`);
        args.push(value);
      }
    }
    for (const [key, col, op] of [
      ["maxPrice", "price", "<="],
      ["minYear", "year", ">="],
      ["maxMileage", "mileage", "<="],
    ]) {
      const value = p.get(key);
      if (value) {
        clauses.push(`v.${col}${op}?`);
        args.push(whole({ [key]: value }, key));
      }
    }
    const page = Math.max(1, Math.min(1000, Number(p.get("page")) || 1)),
      offset = (Math.floor(page) - 1) * 24;
    const results = await db
      .prepare(
        `SELECT ${publicVehicleColumns},${vehiclePhoto} FROM vehicles v WHERE ${clauses.join(" AND ")} ORDER BY v.created_at DESC,v.id LIMIT 25 OFFSET ?`,
      )
      .bind(...args, offset)
      .all();
    return Response.json({
      vehicles: results.results.slice(0, 24),
      hasMore: results.results.length > 24,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    const account = await requireAccount(),
      body = await input(request),
      db = await database(),
      id = crypto.randomUUID();
    const values = [
      id,
      account.id,
      field(body, "seller_name", 120),
      choice(body, "seller_type", ["private", "dealer"]),
      field(body, "make", 60),
      field(body, "model", 80),
      whole(body, "year", 1900, new Date().getUTCFullYear() + 1),
      whole(body, "mileage", 0, 3_000_000),
      choice(body, "transmission", ["automatic", "manual"]),
      choice(body, "fuel", ["petrol", "diesel", "hybrid", "electric"]),
      choice(body, "condition", ["new", "used"]),
      whole(body, "price", 1, 100_000_000_000),
      choice(body, "currency", ["BIF", "USD"]),
      field(body, "city", 100),
      field(body, "description", 3000),
    ];
    await db.batch([
      db
        .prepare(
          "INSERT INTO vehicles(id,seller_id,seller_name,seller_type,make,model,year,mileage,transmission,fuel,condition,price,currency,city,description) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(...values),
      audit(db, account, "cars.listing.created", id),
    ]);
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
