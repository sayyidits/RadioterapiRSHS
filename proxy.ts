import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, IS_DEMO } from "@/lib/mode";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (IS_DEMO) return demoGate(request);
  return updateSession(request);
}

/** Mode demo: cukup cek cookie role yang dipilih. */
function demoGate(request: NextRequest) {
  const onLogin = request.nextUrl.pathname.startsWith("/login");
  // Cookie berisi akun yang tidak dikenal (getCurrentUser mengirim ke /login?sesi=habis):
  // hapus di sini, kalau tidak /login dan / saling redirect tanpa henti
  if (onLogin && request.nextUrl.searchParams.has("sesi")) {
    const res = NextResponse.next();
    res.cookies.delete(DEMO_COOKIE);
    return res;
  }
  if (request.nextUrl.pathname.startsWith("/privasi")) return NextResponse.next();
  const hasRole = request.cookies.has(DEMO_COOKIE);
  if (!hasRole && !onLogin) return NextResponse.redirect(new URL("/login", request.url));
  if (hasRole && onLogin) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
