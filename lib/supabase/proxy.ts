import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";

// /auth/callback: kembali dari Google & tautan konfirmasi email, sesi belum ada.
// /privasi: kebijakan privasi, diperiksa Google tanpa login.
const PUBLIC_PATHS = ["/login", "/auth", "/privasi"];

export async function updateSession(request: NextRequest) {
  // Bila redirectTo ditolak (tidak ada di Redirect URLs Supabase), Supabase mengembalikan pengguna
  // ke Site URL dengan ?code=. Teruskan ke /auth/callback supaya kodenya tetap ditukar menjadi sesi.
  const code = request.nextUrl.searchParams.get("code");
  if (code && !request.nextUrl.pathname.startsWith("/auth")) {
    const to = request.nextUrl.clone();
    to.pathname = "/auth/callback";
    to.search = "";
    to.searchParams.set("code", code);
    return NextResponse.redirect(to);
  }

  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Jangan taruh kode lain di antara createServerClient dan getClaims.
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!loggedIn && !isPublic) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = "";
    return redirectWithCookies(to, response);
  }
  // /login?error=... (mis. akun tanpa profil dari getCurrentUser) tetap ditampilkan, supaya tidak redirect berputar
  if (loggedIn && path === "/login" && !request.nextUrl.searchParams.has("error")) {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return redirectWithCookies(to, response);
  }

  return response;
}

function redirectWithCookies(to: URL, from: NextResponse) {
  const res = NextResponse.redirect(to);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}
