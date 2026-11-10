import { NextRequest, NextResponse } from "next/server";

const CANONICAL_HOST = "budgettravelcompass.com";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase().split(":", 1)[0];
  const isLocalStaticCapture =
    request.headers.get("x-static-public-capture") === "1"
    && (host === "127.0.0.1" || host === "localhost");
  if (isLocalStaticCapture) return NextResponse.next();

  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.toLowerCase();
  const isHttp = forwardedProtocol === "http" || request.nextUrl.protocol === "http:";
  const isAlternateHost = host === `www.${CANONICAL_HOST}`;

  if (!isHttp && !isAlternateHost) {
    return NextResponse.next();
  }

  const destination = request.nextUrl.clone();
  destination.protocol = "https:";
  destination.host = CANONICAL_HOST;

  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
