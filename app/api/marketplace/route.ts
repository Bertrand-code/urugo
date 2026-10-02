import { database, errorResponse, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = stringField(url.searchParams.get("q"), 80).toLowerCase();
    const listingType = url.searchParams.get("type");
    const city = stringField(url.searchParams.get("city"), 80);
    const bedrooms = Number(url.searchParams.get("bedrooms") || 0);
    const conditions = ["p.status = 'published'"];
    const values: (string | number)[] = [];
    if (listingType === "rent" || listingType === "sale") { conditions.push("p.listing_type = ?"); values.push(listingType); }
    if (city) { conditions.push("LOWER(p.city) = ?"); values.push(city.toLowerCase()); }
    if (Number.isInteger(bedrooms) && bedrooms > 0) { conditions.push("p.bedrooms >= ?"); values.push(bedrooms); }
    if (query) { conditions.push("(LOWER(p.name) LIKE ? OR LOWER(p.neighborhood) LIKE ? OR LOWER(p.address) LIKE ?)"); values.push("%" + query + "%", "%" + query + "%", "%" + query + "%"); }
    const sql = "SELECT p.id, p.name, p.neighborhood, p.kind, p.homes, p.occupied, p.listing_type, p.price_amount, p.currency, p.bedrooms, p.bathrooms, p.area_sqm, p.year_built, p.address, p.city, p.description, p.featured, (SELECT id FROM property_images WHERE property_id = p.id ORDER BY sort_order ASC LIMIT 1) AS image_id, (SELECT COUNT(*) FROM units WHERE property_id = p.id AND status = 'available') AS available_units FROM properties p WHERE " + conditions.join(" AND ") + " ORDER BY p.featured DESC, p.created_at DESC";
    const db = await database();
    const listings = await db.prepare(sql).bind(...values).all<Record<string, unknown>>();
    return Response.json({ listings: listings.results.map((listing) => ({ ...listing, image_url: listing.image_id ? "/api/media/" + listing.image_id : null })) });
  } catch (error) {
    return errorResponse(error);
  }
}
