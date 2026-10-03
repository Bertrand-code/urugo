import { database, errorResponse, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = stringField((await params).id, 100);
    const db = await database();
    const property = await db
      .prepare(
        "SELECT p.id, p.name, p.neighborhood, p.kind, listing_type, price_amount, currency, bedrooms, bathrooms, area_sqm, year_built, address, city, description, d.amenities, d.pet_policy, d.parking, d.policies FROM properties p LEFT JOIN listing_details d ON d.property_id=p.id WHERE p.id = ? AND p.status = 'published' AND COALESCE(d.publication,'published')='published'",
      )
      .bind(id)
      .first<Record<string, unknown>>();
    if (!property)
      return Response.json({ error: "Listing not found." }, { status: 404 });
    const [images, units] = await Promise.all([
      db
        .prepare(
          "SELECT id, alt_text, sort_order FROM property_images WHERE property_id = ? ORDER BY sort_order ASC",
        )
        .bind(id)
        .all<{ id: string; alt_text: string; sort_order: number }>(),
      db
        .prepare(
          "SELECT id, name, bedrooms, bathrooms, area_sqm, price_amount, currency, available_date FROM units WHERE property_id = ? AND status = 'available' ORDER BY price_amount ASC",
        )
        .bind(id)
        .all(),
    ]);
    return Response.json({
      property: {
        ...property,
        images: images.results.map((image) => ({
          ...image,
          url: "/api/media/" + image.id,
        })),
        units: units.results,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
