import type { Metadata } from "next";
import Link from "next/link";
import { LogoLengkap } from "@/components/logo";

export const metadata: Metadata = { title: "Kebijakan Privasi · Radioterapi RSHS" };

/** Kontak untuk pertanyaan privasi dan permintaan penghapusan akun */
const KONTAK = "sayyid.its@gmail.com";
const BERLAKU = "10 Oktober 2026";

/**
 * Kebijakan privasi publik (tanpa login), dirujuk dari halaman login dan dari layar persetujuan
 * Google (Google Auth Platform → Branding). Isinya perlu ditinjau pihak rumah sakit.
 */
export default function PrivasiPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <LogoLengkap className="h-12 w-auto" />
      <h1 className="mt-8 text-2xl font-semibold">Kebijakan Privasi</h1>
      <p className="mt-1 text-sm text-slate-500">Radioterapi RSHS · berlaku sejak {BERLAKU}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc">
        <section>
          <h2>Tentang aplikasi</h2>
          <p>
            Radioterapi RSHS adalah aplikasi internal untuk memantau alur pasien radioterapi, dari pendaftaran hingga fraksi
            penyinaran terakhir. Aplikasi ini hanya digunakan oleh tenaga kesehatan dan staf yang akunnya didaftarkan oleh
            Admin atau Master aplikasi. Tidak ada pendaftaran akun untuk umum.
          </p>
        </section>

        <section>
          <h2>Data akun yang kami gunakan</h2>
          <p>Saat Anda masuk dengan Google, aplikasi hanya meminta izin dasar (nama, alamat email, dan foto profil). Yang disimpan:</p>
          <ul className="mt-2 space-y-1">
            <li>alamat email, untuk mencocokkan akun Anda dengan pendaftaran oleh Admin/Master;</li>
            <li>nama lengkap beserta gelar, role kerja, dan hak akses yang diisi oleh Admin/Master;</li>
            <li>catatan tindakan Anda di aplikasi (misalnya ACC tahap, pencatatan fraksi, absensi) beserta waktunya, sebagai riwayat audit.</li>
          </ul>
          <p className="mt-2">
            Foto profil Google tidak disimpan. Aplikasi tidak membaca email, kontak, kalender, berkas, atau data Google
            lainnya.
          </p>
        </section>

        <section>
          <h2>Data pasien</h2>
          <p>
            Data pasien (identitas, rencana terapi, jadwal, dan catatan penyinaran) dimasukkan oleh petugas dan hanya dapat
            dilihat oleh akun yang aktif. Setiap perubahan dicatat (siapa, kapan, dan apa yang diubah). Data pasien tidak
            digunakan untuk tujuan lain di luar pelayanan radioterapi.
          </p>
        </section>

        <section>
          <h2>Penyimpanan dan keamanan</h2>
          <ul className="space-y-1">
            <li>Data disimpan di basis data Supabase (pusat data Singapura) dan aplikasi dijalankan di Vercel.</li>
            <li>Semua koneksi memakai HTTPS.</li>
            <li>
              Akses dibatasi per akun dan per role di tingkat basis data. Akun yang belum didaftarkan atau sudah dinonaktifkan
              tidak dapat melihat data apa pun.
            </li>
          </ul>
        </section>

        <section>
          <h2>Berbagi data</h2>
          <p>
            Kami tidak menjual, menyewakan, atau membagikan data akun maupun data pasien kepada pihak ketiga, dan tidak
            menggunakannya untuk iklan. Penyedia layanan di atas (Supabase, Vercel, Google untuk proses masuk) memproses data
            hanya sebatas yang diperlukan untuk menjalankan aplikasi.
          </p>
        </section>

        <section>
          <h2>Hak Anda</h2>
          <p>
            Anda dapat meminta perbaikan data akun atau penonaktifan akun kepada Admin/Master aplikasi, atau melalui kontak di
            bawah. Akun yang dinonaktifkan tidak dapat lagi masuk. Riwayat tindakan pada data pasien tetap disimpan sebagai
            bagian dari rekam jejak pelayanan.
          </p>
        </section>

        <section>
          <h2>Kontak</h2>
          <p>
            Pertanyaan tentang kebijakan ini dapat dikirim ke{" "}
            <a href={`mailto:${KONTAK}`} className="font-medium text-teal-700 hover:underline">
              {KONTAK}
            </a>
            .
          </p>
        </section>
      </div>

      <p className="mt-10 text-sm">
        <Link href="/login" className="font-medium text-teal-700 hover:underline">
          ← Kembali ke halaman masuk
        </Link>
      </p>
    </main>
  );
}
