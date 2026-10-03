import { database, errorResponse, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = stringField(url.searchParams.get("q"), 80).toLowerCase();
    const listingType = url.searchParams.get("type");
    const city = stringField(url.searchParams.get("city"), 80);
    const bedrooms = Number(url.searchParams.get("bedrooms") || 0);
    const conditions = [
      "p.status = 'published'",
      "COALESCE(d.publication,'published')='published'",
    ];
    const values: (string | number)[] = [];
    if (listingType === "rent" || listingType === "sale") {
      conditions.push("p.listing_type = ?");
      values.push(listingType);
    }
    if (city) {
      conditions.push("LOWER(p.city) = ?");
      values.push(city.toLowerCase());
    }
    if (Number.isInteger(bedrooms) && bedrooms > 0) {
      conditions.push("p.bedrooms >= ?");
      values.push(bedrooms);
    }
    if (query) {
      conditions.push(
        "(LOWER(p.name) LIKE ? OR LOWER(p.neighborhood) LIKE ? OR LOWER(p.address) LIKE ? OR LOWER(p.city) LIKE ?)",
      );
      values.push(
        "%" + query + "%",
        "%" + query + "%",
        "%" + query + "%",
        "%" + query + "%",
      );
    }
    for (const [param, column] of [
      ["minPrice", "p.price_amount"],
      ["maxPrice", "p.price_amount"],
      ["bathrooms", "p.bathrooms"],
    ] as const) {
      const raw = url.searchParams.get(param);
      if (raw) {
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0)
          return Response.json(
            { error: "Enter valid numeric filters." },
            { status: 400 },
          );
        conditions.push(column + (param === "maxPrice" ? " <= ?" : " >= ?"));
        values.push(value);
      }
    }
    const currency = url.searchParams.get("currency");
    if (currency) {
      conditions.push("p.currency=?");
      values.push(currency);
    }
    if (url.searchParams.get("pets") === "allowed")
      conditions.push("d.pet_policy='allowed'");
    if (url.searchParams.get("parking") === "available")
      conditions.push("d.parking='available'");
    for (const amenity of (url.searchParams.get("amenities") || "")
      .split(",")
      .filter(Boolean)
      .slice(0, 10)) {
      conditions.push(
        "EXISTS (SELECT 1 FROM json_each(d.amenities) WHERE value=?)",
      );
      values.push(amenity.trim().toLowerCase());
    }
    const moveIn = url.searchParams.get("moveIn");
    if (moveIn) {
      conditions.push(
        "EXISTS (SELECT 1 FROM units u WHERE u.property_id=p.id AND u.status='available' AND (u.available_date IS NULL OR u.available_date<=?))",
      );
      values.push(moveIn);
    }
    if (url.searchParams.get("available") === "1")
      conditions.push(
        "EXISTS (SELECT 1 FROM units u WHERE u.property_id=p.id AND u.status='available')",
      );
    const sql =
      "SELECT p.id, p.name, p.neighborhood, p.kind, p.listing_type, p.price_amount, p.currency, p.bedrooms, p.bathrooms, p.area_sqm, p.year_built, p.address, p.city, p.description, p.featured, d.amenities, d.pet_policy, d.parking, (SELECT id FROM property_images WHERE property_id = p.id ORDER BY sort_order ASC LIMIT 1) AS image_id, (SELECT COUNT(*) FROM units WHERE property_id = p.id AND status = 'available') AS available_units FROM properties p LEFT JOIN listing_details d ON d.property_id=p.id WHERE " +
      conditions.join(" AND ") +
      " ORDER BY p.featured DESC, p.created_at DESC";
    const db = await database();
    const listings = await db
      .prepare(sql)
      .bind(...values)
      .all<Record<string, unknown>>();
    return Response.json({
      listings: listings.results.map((listing) => ({
        ...listing,
        image_url: listing.image_id ? "/api/media/" + listing.image_id : null,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
