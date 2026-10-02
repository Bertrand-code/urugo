import { accessiblePropertyIds, currentAccount, database, errorResponse, requireAdmin, stringField } from "@/lib/data";

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
  created_at: string;
  access_role?: "admin" | "owner" | "resident" | null;
};

export async function GET(request: Request) {
  try {
    const publicListings = new URL(request.url).searchParams.get("public") === "1";
    const account = publicListings ? null : await currentAccount();
    const db = await database();
    let properties: PropertyRow[] = [];
    if (!account) {
      properties = (await db.prepare("SELECT id, name, neighborhood, kind, homes, occupied, status, accent, created_at, NULL AS access_role FROM properties WHERE status = 'published' ORDER BY created_at DESC").all<PropertyRow>()).results;
    } else {
      const ids = await accessiblePropertyIds(account);
      if (ids === null) {
        properties = (await db.prepare("SELECT id, name, neighborhood, kind, homes, occupied, status, accent, created_at, 'admin' AS access_role FROM properties ORDER BY created_at DESC").all<PropertyRow>()).results;
      } else if (ids.length) {
        properties = (await db.prepare(`SELECT p.id, p.name, p.neighborhood, p.kind, p.homes, p.occupied, p.status, p.accent, p.created_at, pm.role AS access_role
          FROM properties p INNER JOIN property_memberships pm ON pm.property_id = p.id
          WHERE pm.account_id = ? AND p.id IN (${ids.map(() => "?").join(", ")}) ORDER BY p.created_at DESC`).bind(account.id, ...ids).all<PropertyRow>()).results;
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

    if (!name || !neighborhood || !Number.isInteger(homes) || homes < 1 || homes > 5000) {
      return Response.json({ error: "Add a name, location, and a valid number of homes." }, { status: 400 });
    }
    const property: PropertyRow = {
      id: crypto.randomUUID(), name, neighborhood, kind, homes, occupied: 0, status, accent, created_at: new Date().toISOString(), access_role: "admin",
    };
    const db = await database();
    await db.prepare("INSERT INTO properties (id, name, neighborhood, kind, homes, occupied, status, accent, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(property.id, name, neighborhood, kind, homes, 0, status, accent, account.id).run();
    return Response.json({ property }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
