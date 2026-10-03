import { AccessError, errorResponse, requireAccount } from "@/lib/data";
import { input } from "@/lib/products";
import {
  healthSearch,
  healthWorkspace,
  createHealth,
  updateHealth,
} from "@/lib/health";
type Context = { params: Promise<{ path: string[] }> };
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: Context) {
  try {
    const { path } = await params;
    if (path.length === 1 && path[0] === "search")
      return Response.json(await healthSearch(new URL(request.url)));
    if (path.length === 1 && path[0] === "me")
      return Response.json(await healthWorkspace(await requireAccount()), {
        headers: { "Cache-Control": "private, no-store" },
      });
    throw new AccessError("Route not found.", 404);
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const { path } = await params;
    if (path.length !== 1) throw new AccessError("Route not found.", 404);
    const a = await requireAccount();
    return Response.json(await createHealth(a, path[0], await input(request)), {
      status: 201,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    const { path } = await params;
    if (path.length !== 2) throw new AccessError("Route not found.", 404);
    const a = await requireAccount();
    return Response.json(
      await updateHealth(a, path[0], path[1], await input(request)),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
