// Memberi hak akses Master (dan mengaktifkan) satu akun. Dipakai sekali untuk Master pertama;
// Admin/Master berikutnya cukup diatur dari halaman Akun. Role kerja (nakes) akun itu tidak berubah;
// akun tanpa role kerja memilihnya sendiri di /daftar setelah masuk.
// Pakai: npm run akun:master -- email@contoh.com   (butuh SUPABASE_DB_URL di .env.local)
// Akunnya harus sudah dibuat dulu: daftar/masuk sekali lewat website.
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL_NON_POOLING;
if (!email || !url) {
  console.error("Pakai: npm run akun:master -- email@contoh.com  (SUPABASE_DB_URL harus diisi di .env.local)");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });

sql`update public.profiles set akses = 'master', status = 'aktif', diproses_at = now()
    where lower(email) = ${email} returning full_name, role`
  .then(async (rows) => {
    if (rows.length === 0) {
      console.error(`Akun ${email} belum ada. Daftar atau masuk sekali lewat website, lalu jalankan lagi.`);
      process.exitCode = 1;
    } else {
      console.log(`✓ ${rows[0].full_name} (${email}) sekarang Master, role kerja: ${rows[0].role ?? "belum dipilih (pilih di website)"}.`);
    }
    await sql.end();
  })
  .catch(async (err) => {
    console.error("Gagal:", err.message);
    await sql.end();
    process.exit(1);
  });
