import { requirePermission } from "@/lib/authorization";
import { database, errorResponse, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const propertyId = stringField((await params).id, 100);
    await requirePermission(propertyId, "unit.view");
    const db = await database();
    const units = await db
      .prepare(
        "SELECT id, name, bedrooms, bathrooms, area_sqm, price_amount, currency, status, available_date FROM units WHERE property_id = ? ORDER BY name",
      )
      .bind(propertyId)
      .all();
    return Response.json({ units: units.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const propertyId = stringField((await params).id, 100);
    await requirePermission(propertyId, "unit.manage");
    const payload = (await request.json()) as Record<string, unknown>;
    const name = stringField(payload.name, 70);
    const bedrooms = Number(payload.bedrooms);
    const bathrooms = Number(payload.bathrooms);
    const areaSqm =
      payload.areaSqm === "" || payload.areaSqm === undefined
        ? null
        : Number(payload.areaSqm);
    const priceAmount = Number(payload.priceAmount);
    const currency = ["BIF", "USD", "EUR"].includes(String(payload.currency))
      ? String(payload.currency)
      : "BIF";
    const availableDate = stringField(payload.availableDate, 20) || null;
    if (
      !name ||
      !Number.isInteger(bedrooms) ||
      bedrooms < 0 ||
      !Number.isFinite(bathrooms) ||
      bathrooms < 0 ||
      (areaSqm !== null && (!Number.isInteger(areaSqm) || areaSqm < 1)) ||
      !Number.isInteger(priceAmount) ||
      priceAmount < 0
    ) {
      return Response.json(
        { error: "Add a unit name, price, and valid details." },
        { status: 400 },
      );
    }
    const db = await database();
    const unit = {
      id: crypto.randomUUID(),
      property_id: propertyId,
      name,
      bedrooms,
      bathrooms,
      area_sqm: areaSqm,
      price_amount: priceAmount,
      currency,
      status: "available",
      available_date: availableDate,
    };
    await db
      .prepare(
        "INSERT INTO units (id, property_id, name, bedrooms, bathrooms, area_sqm, price_amount, currency, status, available_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?)",
      )
      .bind(
        unit.id,
        propertyId,
        name,
        bedrooms,
        bathrooms,
        areaSqm,
        priceAmount,
        currency,
        availableDate,
      )
      .run();
    return Response.json({ unit }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
