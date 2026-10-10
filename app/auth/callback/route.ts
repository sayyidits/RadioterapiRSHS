import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Tujuan kembali dari Google dan dari tautan konfirmasi email: tukar `code` menjadi sesi
 * (cookie), lalu ke dashboard. Akun baru diarahkan getCurrentUser ke /daftar.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", origin));
  }
  // Login dibatalkan, tautan kedaluwarsa, atau error dari Google/Supabase
  return NextResponse.redirect(new URL("/login?error=masuk", origin));
}
