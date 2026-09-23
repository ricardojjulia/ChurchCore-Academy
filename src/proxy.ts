import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths that must be reachable without a staff/student session. Each one authenticates itself:
// the public applicant portal is token-scoped and rate-limited, cron routes check CRON_SECRET,
// and the Stripe webhook verifies Stripe's signature. Before this list existed, the proxy
// redirected all of them to /login, so applicants couldn't apply, Vercel cron jobs (including
// the every-minute email worker) never ran, and Stripe webhooks never reconciled payments.
const PUBLIC_PAGE_PREFIXES = ["/apply"];
const PUBLIC_API_PREFIXES = ["/api/public/", "/api/cron/"];
const PUBLIC_EXACT_PATHS = new Set([
  "/login",
  "/manifest.webmanifest",
  "/student-sw.js",
  "/api/academy/billing/stripe-webhook",
]);

export function isPublicPath(pathname: string) {
  return (
    PUBLIC_EXACT_PATHS.has(pathname) ||
    pathname.startsWith("/_next") ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    PUBLIC_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  function redirectToLogin() {
    // API clients get a 401, not an HTML login redirect they can't follow.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!url || !publishableKey) {
    return redirectToLogin();
  }

  const response = NextResponse.next({ request: { headers: request.headers } });

  try {
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return redirectToLogin();
    }
  } catch {
    return redirectToLogin();
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
