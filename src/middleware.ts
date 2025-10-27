import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { admin } from "@/lib/firebase-admin";

export const runtime = "nodejs";

// This is a function to get the user session from the token
async function checkFirebaseSession(token: string | undefined) {
  if (!token) {
    return null;
  }
  try {
    // Verify the token using the admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    // This will catch expired or invalid tokens
    console.warn("Middleware Auth Warning:", "Invalid or expired token.");
    return null;
  }
}

export async function middleware(request: NextRequest) {
  console.log(`Middleware (Node.js) triggered for: ${request.nextUrl.pathname}`);

  const token = request.cookies.get("firebase-auth-token")?.value;
  const user = await checkFirebaseSession(token);
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith("/login");

  // If a logged-in user tries to visit the login page...
  if (user && isAuthPage) {
    // ...redirect them to the dashboard.
    console.log("Middleware: User authenticated, redirecting from /login to /");
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If a logged-out user tries to access a protected page...
  if (!user && !isAuthPage) {
    // ...redirect them to the login page.
    console.log("Middleware: User not authenticated, redirecting to /login");
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname); // Remember where they wanted to go
    return NextResponse.redirect(loginUrl);
  }

  // Otherwise, allow the request to proceed.
  return NextResponse.next();
}

// Config: This determines which paths the middleware runs on.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

