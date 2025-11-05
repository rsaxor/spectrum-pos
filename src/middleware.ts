import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("firebase-auth-token")?.value;
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname.startsWith("/login");

  let user = null;
  if (token) {
    try {
      const verifyUrl = new URL("/api/verify-session", request.url);
      const res = await fetch(verifyUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) user = await res.json();
    } catch (err) {
      console.warn("Middleware: verification request failed");
    }
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!user && !isAuthPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
