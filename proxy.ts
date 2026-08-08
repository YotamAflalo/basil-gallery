import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_COOKIE, adminToken, timingSafeEqual } from "@/lib/admin-auth";

/**
* Gate every /admin route. Runs before the page, so an unauthenticated
 * request never reaches code that can read or write ImageKit.
 */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();

  const supplied = request.cookies.get(ADMIN_COOKIE)?.value ?? "";

  let expected: string;
  try {
    expected = await adminToken();
  } catch {
    // ADMIN_PASSWORD missing. Fail closed rather than leaving /admin open.
    return new NextResponse(
      "Admin is disabled: ADMIN_PASSWORD is not set on the server.",
      { status: 503, headers: { "content-type": "text/plain" } },
    );
  }

  if (timingSafeEqual(supplied, expected)) return NextResponse.next();

  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*"],
};
