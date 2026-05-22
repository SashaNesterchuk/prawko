import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_SESSION_COOKIE, buildAdminCookieOptions } from "../../../../lib/admin-auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/admin/login?signed_out=1", request.url),
    {
      status: 303,
    }
  );

  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    ...buildAdminCookieOptions(),
    maxAge: 0,
  });
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  return response;
}
