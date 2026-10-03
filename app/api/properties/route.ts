import {
  accessiblePropertyIds,
  currentAccount,
  database,
  errorResponse,
  isEmail,
  requireAdmin,
  stringField,
} from "@/lib/data";

export const dynamic = "force-dynamic";

type PropertyRow = {
  id: string;
  name: string;
  neighborhood: string;
  kind: string;
  homes: number;
  occupied: number;
  status: "published" | "draft";
  accent: string;
  listing_type: "rent" | "sale";
  price_amount: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  year_built: number | null;
  address: string;
  city: string;
  description: string;
  featured: number;
  created_at: string;
  access_role?: "admin" | "owner" | "resident" | null;
};

const propertyColumns =
  "id, name, neighborhood, kind, homes, occupied, status, accent, listing_type, price_amount, currency, bedrooms, bathrooms, area_sqm, year_built, address, city, description, featured, created_at";
const validCurrencies = ["BIF", "USD", "EUR"];

export async function GET(request: Request) {
  try {
    const publicListings =
      new URL(request.url).searchParams.get("public") === "1";
    const account = publicListings ? null : await currentAccount();
    const db = await database();
    let properties: PropertyRow[] = [];
    if (!account) {
      properties = (
        await db
          .prepare(
            "SELECT " +
              propertyColumns +
              ", NULL AS access_role FROM properties WHERE status = 'published' AND NOT EXISTS (SELECT 1 FROM listing_details d WHERE d.property_id=properties.id AND d.publication!='published') ORDER BY created_at DESC",
          )
          .all<PropertyRow>()
      ).results;
    } else {
      const ids = await accessiblePropertyIds(account);
      if (ids === null) {
        properties = (
          await db
            .prepare(
              "SELECT " +
                propertyColumns +
                ", 'admin' AS access_role FROM properties ORDER BY created_at DESC",
            )
            .all<PropertyRow>()
        ).results;
      } else if (ids.length) {
        const placeholders = ids.map(() => "?").join(", ");
        const query =
          "SELECT " +
          propertyColumns +
          " FROM properties WHERE id IN (" +
          placeholders +
          ") ORDER BY created_at DESC";
        properties = (
          await db
            .prepare(query)
            .bind(...ids)
            .all<PropertyRow>()
        ).results;
      }
    }
    if (!account)
      properties = properties.map(
        (p) =>
          ({
            id: p.id,
            name: p.name,
            neighborhood: p.neighborhood,
            city: p.city,
            listing_type: p.listing_type,
            price_amount: p.price_amount,
            currency: p.currency,
            bedrooms: p.bedrooms,
            bathrooms: p.bathrooms,
            description: p.description,
          }) as PropertyRow,
      );
    return Response.json({ properties });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAdmin();
    const payload = (await request.json()) as Record<string, unknown>;
    const name = stringField(payload.name, 100);
    const neighborhood = stringField(payload.neighborhood, 100);
    const kind = stringField(payload.kind, 50) || "Apartments";
    const homes = Number(payload.homes);
    const status = payload.status === "published" ? "published" : "draft";
    const accent = ["green", "blue", "ochre", "coral"].includes(
      String(payload.accent),
    )
      ? String(payload.accent)
      : "green";
    const listingType = payload.listingType === "sale" ? "sale" : "rent";
    const priceAmount = Number(payload.priceAmount);
    const currency = validCurrencies.includes(String(payload.currency))
      ? String(payload.currency)
      : "BIF";
    const bedrooms = Number(payload.bedrooms);
    const bathrooms = Number(payload.bathrooms);
    const areaSqm =
      payload.areaSqm === "" || payload.areaSqm === undefined
        ? null
        : Number(payload.areaSqm);
    const yearBuilt =
      payload.yearBuilt === "" || payload.yearBuilt === undefined
        ? null
        : Number(payload.yearBuilt);
    const address = stringField(payload.address, 180);
    const city = stringField(payload.city, 80) || "Bujumbura";
    const description = stringField(payload.description, 2000);
    const ownerEmail = stringField(payload.ownerEmail, 150).toLowerCase();
    const featured = payload.featured === true ? 1 : 0;

    if (
      !name ||
      !neighborhood ||
      !address ||
      !Number.isInteger(homes) ||
      homes < 1 ||
      homes > 5000 ||
      !Number.isInteger(priceAmount) ||
      priceAmount < 0 ||
      !Number.isInteger(bedrooms) ||
      bedrooms < 0 ||
      !Number.isFinite(bathrooms) ||
      bathrooms < 0 ||
      (areaSqm !== null && (!Number.isInteger(areaSqm) || areaSqm < 1)) ||
      (yearBuilt !== null &&
        (!Number.isInteger(yearBuilt) ||
          yearBuilt < 1800 ||
          yearBuilt > new Date().getFullYear() + 1)) ||
      (ownerEmail && !isEmail(ownerEmail))
    ) {
      return Response.json(
        { error: "Add the property location, price, and valid home details." },
        { status: 400 },
      );
    }

    const property: PropertyRow = {
      id: crypto.randomUUID(),
      name,
      neighborhood,
      kind,
      homes,
      occupied: 0,
      status,
      accent,
      listing_type: listingType,
      price_amount: priceAmount,
      currency,
      bedrooms,
      bathrooms,
      area_sqm: areaSqm,
      year_built: yearBuilt,
      address,
      city,
      description,
      featured,
      created_at: new Date().toISOString(),
      access_role: "admin",
    };
    const db = await database();
    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          "INSERT INTO properties (id, name, neighborhood, kind, homes, occupied, status, accent, listing_type, price_amount, currency, bedrooms, bathrooms, area_sqm, year_built, address, city, description, featured, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          property.id,
          name,
          neighborhood,
          kind,
          homes,
          0,
          status,
          accent,
          listingType,
          priceAmount,
          currency,
          bedrooms,
          bathrooms,
          areaSqm,
          yearBuilt,
          address,
          city,
          description,
          featured,
          account.id,
        ),
    ];
    if (ownerEmail)
      statements.push(
        db
          .prepare(
            "INSERT INTO invitations (id,email,invited_by,property_id,role,expires_at) VALUES (?,?,?,?,'owner',datetime('now','+7 days'))",
          )
          .bind(crypto.randomUUID(), ownerEmail, account.id, property.id),
      );
    await db.batch(statements);
    return Response.json({ property }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
