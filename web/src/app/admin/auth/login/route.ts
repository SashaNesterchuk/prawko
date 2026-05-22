import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  buildAdminCookieOptions,
  createAdminSessionCookieValue,
  normalizeAdminNextPath,
  verifyAdminCredentials,
} from "../../../../lib/admin-auth";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = normalizeAdminNextPath(String(formData.get("next") ?? "/admin"));
  const result = verifyAdminCredentials(email, password);

  if (!result.ok) {
    const redirectUrl = new URL("/admin/login", request.url);
    redirectUrl.searchParams.set("error", result.reason);
    redirectUrl.searchParams.set("next", nextPath);

    if (email) {
      redirectUrl.searchParams.set("email", email);
    }

    return NextResponse.redirect(redirectUrl, {
      status: 303,
    });
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), {
    status: 303,
  });

  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: createAdminSessionCookieValue(result.email),
    ...buildAdminCookieOptions(),
  });

  return response;
}
