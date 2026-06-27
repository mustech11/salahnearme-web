import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const loginAfterLogout = "/login?redirectTo=/admin&next=/admin";

  return NextResponse.redirect(
    new URL(
      `/api/auth/logout?next=${encodeURIComponent(loginAfterLogout)}`,
      url.origin
    )
  );
}