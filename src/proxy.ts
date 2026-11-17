import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const proxy = auth((request) => {
  const path = request.nextUrl.pathname;
  const origin = request.headers.get("origin");
  if (path.startsWith("/api/") && !path.startsWith("/api/auth/") &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method) && origin !== null) {
    let originHost: string;
    try { originHost = new URL(origin).host; }
    catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
    if (originHost !== request.nextUrl.host) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
