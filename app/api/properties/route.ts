import { accessiblePropertyIds, currentAccount, database, errorResponse, isEmail, requireAdmin, stringField } from "@/lib/data";

export const dynamic = "force-dynamic";

type PropertyRow = {
  id: string; name: string; neighborhood: string; kind: string; homes: number; occupied: number;
  status: "published" | "draft"; accent: string; listing_type: "rent" | "sale"; price_amount: number;
  currency: string; bedrooms: number; bathrooms: number; area_sqm: number | null; year_built: number | null;
  address: string; city: string; description: string; featured: number; created_at: string;
  access_role?: "admin" | "owner" | "resident" | null;
};

const propertyColumns = "id, name, neighborhood, kind, homes, occupied, status, accent, listing_type, price_amount, currency, bedrooms, bathrooms, area_sqm, year_built, address, city, description, featured, created_at";
const validCurrencies = ["BIF", "USD", "EUR"];

export async function GET(request: Request) {
  try {
    const publicListings = new URL(request.url).searchParams.get("public") === "1";
    const account = publicListings ? null : await currentAccount();
    const db = await database();
    let properties: PropertyRow[] = [];
    if (!account) {
      properties = (await db.prepare("SELECT " + propertyColumns + ", NULL AS access_role FROM properties WHERE status = 'published' ORDER BY created_at DESC").all<PropertyRow>()).results;
    } else {
      const ids = await accessiblePropertyIds(account);
      if (ids === null) {
        properties = (await db.prepare("SELECT " + propertyColumns + ", 'admin' AS access_role FROM properties ORDER BY created_at DESC").all<PropertyRow>()).results;
      } else if (ids.length) {
        const placeholders = ids.map(() => "?").join(", ");
        const query = "SELECT p." + propertyColumns.split(", ").join(", p.") + ", pm.role AS access_role FROM properties p INNER JOIN property_memberships pm ON pm.property_id = p.id WHERE pm.account_id = ? AND p.id IN (" + placeholders + ") ORDER BY p.created_at DESC";
        properties = (await db.prepare(query).bind(account.id, ...ids).all<PropertyRow>()).results;
      }
    }
    return Response.json({ properties });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAdmin();
    const payload = await request.json() as Record<string, unknown>;
    const name = stringField(payload.name, 100);
    const neighborhood = stringField(payload.neighborhood, 100);
    const kind = stringField(payload.kind, 50) || "Apartments";
    const homes = Number(payload.homes);
    const status = payload.status === "published" ? "published" : "draft";
    const accent = ["green", "blue", "ochre", "coral"].includes(String(payload.accent)) ? String(payload.accent) : "green";
    const listingType = payload.listingType === "sale" ? "sale" : "rent";
    const priceAmount = Number(payload.priceAmount);
    const currency = validCurrencies.includes(String(payload.currency)) ? String(payload.currency) : "BIF";
    const bedrooms = Number(payload.bedrooms);
    const bathrooms = Number(payload.bathrooms);
    const areaSqm = payload.areaSqm === "" || payload.areaSqm === undefined ? null : Number(payload.areaSqm);
    const yearBuilt = payload.yearBuilt === "" || payload.yearBuilt === undefined ? null : Number(payload.yearBuilt);
    const address = stringField(payload.address, 180);
    const city = stringField(payload.city, 80) || "Bujumbura";
    const description = stringField(payload.description, 2000);
    const ownerEmail = stringField(payload.ownerEmail, 150).toLowerCase();

    if (!name || !neighborhood || !address || !Number.isInteger(homes) || homes < 1 || homes > 5000 || !Number.isInteger(priceAmount) || priceAmount < 0 || !Number.isInteger(bedrooms) || bedrooms < 0 || !Number.isFinite(bathrooms) || bathrooms < 0 || (areaSqm !== null && (!Number.isInteger(areaSqm) || areaSqm < 1)) || (yearBuilt !== null && (!Number.isInteger(yearBuilt) || yearBuilt < 1800 || yearBuilt > new Date().getFullYear() + 1)) || (ownerEmail && !isEmail(ownerEmail))) {
      return Response.json({ error: "Add the property location, price, and valid home details." }, { status: 400 });
    }

    const property: PropertyRow = {
      id: crypto.randomUUID(), name, neighborhood, kind, homes, occupied: 0, status, accent, listing_type: listingType,
      price_amount: priceAmount, currency, bedrooms, bathrooms, area_sqm: areaSqm, year_built: yearBuilt, address,
      city, description, featured: 0, created_at: new Date().toISOString(), access_role: "admin",
    };
    const db = await database();
    const statements: D1PreparedStatement[] = [
      db.prepare("INSERT INTO properties (id, name, neighborhood, kind, homes, occupied, status, accent, listing_type, price_amount, currency, bedrooms, bathrooms, area_sqm, year_built, address, city, description, featured, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(property.id, name, neighborhood, kind, homes, 0, status, accent, listingType, priceAmount, currency, bedrooms, bathrooms, areaSqm, yearBuilt, address, city, description, 0, account.id),
    ];
    if (ownerEmail) {
      const groupId = crypto.randomUUID();
      statements.push(db.prepare("INSERT INTO access_groups (id, name, role, property_id, created_by) VALUES (?, ?, 'owner', ?, ?)")
        .bind(groupId, name + " owners", property.id, account.id));
      const owner = await db.prepare("SELECT id, role FROM accounts WHERE email = ?").bind(ownerEmail).first<{ id: string; role: "admin" | "owner" | "resident" }>();
      if (owner) {
        statements.push(
          db.prepare("INSERT OR IGNORE INTO access_group_members (id, group_id, account_id) VALUES (?, ?, ?)").bind(crypto.randomUUID(), groupId, owner.id),
          db.prepare("INSERT OR IGNORE INTO property_memberships (id, property_id, account_id, role) VALUES (?, ?, ?, 'owner')").bind(crypto.randomUUID(), property.id, owner.id),
        );
        if (owner.role !== "admin") statements.push(db.prepare("UPDATE accounts SET role = 'owner', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(owner.id));
      } else {
        statements.push(db.prepare("INSERT INTO access_invites (id, group_id, email) VALUES (?, ?, ?)").bind(crypto.randomUUID(), groupId, ownerEmail));
      }
    }
    await db.batch(statements);
    return Response.json({ property }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
