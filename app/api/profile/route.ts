import { database, requireAccount, errorResponse } from "@/lib/data";
import { profileData } from "@/lib/applications";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const account = await requireAccount();
    const db = await database();
    const row = await db
      .prepare("SELECT data FROM renter_profiles WHERE account_id=?")
      .bind(account.id)
      .first<{ data: string }>();
    return Response.json({
      profile: row ? JSON.parse(row.data) : { fullName: account.display_name },
      email: account.email,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(request: Request) {
  try {
    const account = await requireAccount();
    const db = await database();
    const body = await request.json();
    const profile = profileData(body);
    await db
      .prepare(
        "INSERT INTO renter_profiles (account_id,data) VALUES (?,?) ON CONFLICT(account_id) DO UPDATE SET data=excluded.data,updated_at=CURRENT_TIMESTAMP",
      )
      .bind(account.id, JSON.stringify(profile))
      .run();
    return Response.json({ profile });
  } catch (error) {
    return errorResponse(error);
  }
}
