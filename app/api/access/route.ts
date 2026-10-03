import { errorResponse, requireAdmin } from "@/lib/data";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAdmin();
    return Response.json({
      groups: [],
      message:
        "Use Team & Access. Legacy groups are retained for migration only.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
async function retired() {
  return Response.json(
    { error: "Group access has been replaced by Team & Access." },
    { status: 410 },
  );
}
export const POST = retired;
export const DELETE = retired;
