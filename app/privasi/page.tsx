import type { Metadata } from "next";
import Link from "next/link";
import { LogoLengkap } from "@/components/logo";

export const metadata: Metadata = { title: "Kebijakan Privasi · Radioterapi RSHS" };

/**
 * Kebijakan privasi publik (tanpa login), dirujuk dari halaman login dan dari layar persetujuan
 * Google (Google Auth Platform → Branding). Disusun 2026-10-12 mengikuti UU 27/2022 (PDP),
 * UU 17/2023 (Kesehatan), Permenkes 24/2022 (Rekam Medis), dan Google API Services User Data
 * Policy. Masih DRAF: nama resmi pengendali, pejabat pelindungan data (PDP), dan dasar hukumnya
 * perlu disahkan bagian hukum / PDP rumah sakit. Setelah disahkan, isi konstanta di bawah lalu
 * set DRAF = false. Kalau cara aplikasi memakai data berubah, halaman ini wajib ikut diubah.
 */
const DRAF = false;
const BERLAKU = "12 Oktober 2026";
/** Pengendali data pribadi (nama resmi unit/rumah sakit) */
const PENGENDALI = "Instalasi Radioterapi RSHS";
/** Kontak pengelola aplikasi untuk pertanyaan privasi dan permintaan terkait data */
const KONTAK = "sayyid.its@gmail.com";

const BAGIAN = [
  ["ringkasan", "Ringkasan"],
  ["tentang", "Tentang aplikasi dan pengendali data"],
  ["data", "Data yang diproses"],
  ["tujuan", "Tujuan dan dasar pemrosesan"],
  ["google", "Data dari akun Google"],
  ["akses", "Siapa yang dapat melihat data"],
  ["lokasi", "Penyedia layanan dan lokasi data"],
  ["retensi", "Lama penyimpanan"],
  ["keamanan", "Keamanan dan insiden"],
  ["hak", "Hak Anda"],
  ["cookie", "Cookie"],
  ["perubahan", "Perubahan kebijakan"],
  ["kontak", "Kontak"],
] as const;

export default function PrivasiPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <LogoLengkap className="h-12 w-auto" />
      <h1 className="mt-8 text-2xl font-semibold">Kebijakan Privasi</h1>
      <p className="mt-1 text-sm text-slate-500">Radioterapi RSHS · berlaku sejak {BERLAKU}</p>

      {DRAF && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          Versi draf. Kebijakan ini sedang ditinjau oleh rumah sakit dan dapat berubah sebelum disahkan.
        </p>
      )}

      <nav aria-label="Daftar isi" className="mt-8 rounded-lg bg-slate-50 px-5 py-4 text-sm ring-1 ring-inset ring-slate-200">
        <p className="font-semibold text-slate-900">Daftar isi</p>
        <ol className="mt-2 grid gap-1 sm:grid-cols-2">
          {BAGIAN.map(([id, judul], i) => (
            <li key={id}>
              <a href={`#${id}`} className="text-teal-700 hover:underline">
                {i + 1}. {judul}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700 [&_h2]:mb-2 [&_h2]:scroll-mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-slate-800 [&_p+p]:mt-2 [&_ul]:mt-2 [&_ul]:space-y-1 [&_ul>li]:ml-5 [&_ul>li]:list-disc">
        <Bagian id="ringkasan">
          <ul>
            <li>Aplikasi ini hanya untuk staf radioterapi yang didaftarkan. Pasien tidak memakai aplikasi ini; data pasien dimasukkan oleh petugas.</li>
            <li>Data pasien adalah data kesehatan, termasuk data pribadi yang bersifat spesifik, dan dijaga kerahasiaannya.</li>
            <li>Staf masuk hanya dengan akun Google. Aplikasi hanya memakai nama dan alamat email Google untuk mengenali akun.</li>
            <li>Data tidak dijual, tidak dipakai untuk iklan, dan tidak dibagikan kecuali kepada penyedia layanan yang menjalankan aplikasi atau bila diwajibkan peraturan.</li>
            <li>Data disimpan di pusat data di luar Indonesia (Singapura). Lihat bagian 7.</li>
          </ul>
        </Bagian>

        <Bagian id="tentang">
          <p>
            Radioterapi RSHS adalah aplikasi internal untuk memantau alur pelayanan pasien radioterapi, dari pendaftaran,
            Poli, CT Simulator, delineasi, planning, verifikasi, hingga fraksi penyinaran terakhir. Akun hanya dibuat oleh
            Admin atau Master aplikasi; tidak ada pendaftaran untuk umum.
          </p>
          <p>
            Pengendali data pribadi untuk aplikasi ini adalah <b>{PENGENDALI}</b>, yang menentukan tujuan dan cara pemrosesan
            data. Penyedia layanan teknologi (bagian 7) bertindak sebagai prosesor yang memproses data atas nama pengendali.
          </p>
        </Bagian>

        <Bagian id="data">
          <h3>a. Data akun staf (pengguna aplikasi)</h3>
          <ul>
            <li>Dari akun Google saat Anda masuk: nama, alamat email, ID akun Google, dan alamat foto profil. Data ini disimpan oleh layanan login (Supabase Auth); aplikasi tidak menampilkan foto profil.</li>
            <li>Dari Admin/Master: nama lengkap beserta gelar, role kerja (misalnya dokter, perawat, RTT, fisikawan medis, administrasi), hak akses, dan status akun.</li>
            <li>Riwayat tindakan Anda di aplikasi beserta waktunya, misalnya ACC tahap, pengembalian tahap beserta alasannya, pencatatan fraksi, dan absensi.</li>
            <li>Log teknis yang dicatat penyedia layanan untuk keamanan, seperti alamat IP, jenis peramban, dan waktu akses.</li>
          </ul>
          <h3>b. Data pasien</h3>
          <ul>
            <li>Identitas: nomor rekam medis, nama, tanggal lahir, jenis kelamin, dan nomor HP.</li>
            <li>Data klinis dan rencana terapi: diagnosis rujukan dan diagnosis kerja, stadium, tujuan terapi, area radiasi, dosis total, jumlah fraksi, dokter penanggung jawab (DPJP), dan pesawat radiasi.</li>
            <li>Data tiap tahap: jadwal CT Simulator dan verifikasi, posisi dan alat imobilisasi, catatan kontur, teknik dan catatan planning, metode dan hasil verifikasi.</li>
            <li>Pelaksanaan penyinaran: tanggal dan mesin tiap fraksi, kehadiran harian, serta catatan petugas.</li>
            <li>Riwayat perubahan: siapa yang mengubah, kapan, dan apa yang diubah.</li>
          </ul>
          <p>
            Data kesehatan termasuk data pribadi yang bersifat spesifik menurut Pasal 4 ayat (2) UU Nomor 27 Tahun 2022 tentang
            Pelindungan Data Pribadi (UU PDP), sehingga diproses dengan perlindungan tambahan.
          </p>
        </Bagian>

        <Bagian id="tujuan">
          <ul>
            <li><b>Data pasien</b> diproses untuk menyelenggarakan pelayanan radioterapi: menjadwalkan CT Simulator dan penyinaran sesuai kuota pesawat, memantau setiap tahap, mencatat fraksi yang diberikan, dan menjaga keselamatan pasien. Dasarnya adalah pemenuhan kewajiban hukum rumah sakit, termasuk kewajiban menyelenggarakan rekam medis (UU Nomor 17 Tahun 2023 tentang Kesehatan dan Permenkes Nomor 24 Tahun 2022 tentang Rekam Medis), serta pelaksanaan pelayanan kesehatan, sebagaimana dimaksud Pasal 20 ayat (2) UU PDP.</li>
            <li><b>Data akun staf</b> diproses untuk mengenali pengguna, membatasi akses sesuai role kerja, dan menyimpan jejak audit atas setiap tindakan pada data pasien.</li>
          </ul>
          <p>
            Aplikasi menghitung jadwal dan sisa kuota secara otomatis sebagai alat bantu. Keputusan klinis dan penjadwalan tetap
            diambil oleh tenaga kesehatan. Data tidak dipakai untuk iklan, pemrofilan, penjualan, atau tujuan lain di luar
            pelayanan radioterapi.
          </p>
        </Bagian>

        <Bagian id="google">
          <p>
            Saat masuk dengan Google, aplikasi hanya meminta izin dasar (nama, alamat email, dan foto profil). Data itu hanya
            dipakai untuk masuk dan mencocokkan akun Anda dengan pendaftaran oleh Admin/Master. Aplikasi tidak membaca email,
            kontak, kalender, berkas, atau data Google lain, dan tidak membagikan data akun Google kepada pihak lain.
          </p>
          <p>
            Penggunaan dan pemindahan informasi yang diterima dari Google API ke aplikasi lain mematuhi{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="font-medium text-teal-700 hover:underline"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , termasuk ketentuan Limited Use.
          </p>
        </Bagian>

        <Bagian id="akses">
          <ul>
            <li>Data pasien hanya dapat dilihat oleh akun staf yang aktif. Untuk koordinasi antartahap, semua staf aktif dapat melihat data pasien radioterapi, tetapi perubahan hanya dapat dilakukan oleh role yang bertanggung jawab pada tahap tersebut dan selalu tercatat.</li>
            <li>Akun yang belum didaftarkan, ditolak, atau dinonaktifkan tidak dapat melihat data apa pun.</li>
            <li>Admin dan Master dapat melihat dan mengelola data akun staf.</li>
            <li>Isi rekam medis hanya dibuka kepada pihak lain dalam hal yang diizinkan peraturan, misalnya atas persetujuan pasien, untuk penegakan hukum, atau berdasarkan perintah pengadilan, sesuai Permenkes Nomor 24 Tahun 2022.</li>
          </ul>
        </Bagian>

        <Bagian id="lokasi">
          <p>Aplikasi dijalankan dengan bantuan penyedia layanan berikut, yang memproses data hanya sebatas untuk menjalankan aplikasi:</p>
          <ul>
            <li><b>Supabase</b>: basis data dan layanan login. Data disimpan di pusat data Singapura.</li>
            <li><b>Vercel</b>: server yang menjalankan aplikasi web. Data diproses saat Anda membuka halaman, dan server ini dapat berada di luar Indonesia.</li>
            <li><b>Google</b>: layanan masuk dengan akun Google.</li>
          </ul>
          <p>
            Karena itu, data pribadi ditransfer ke luar wilayah hukum Indonesia. Transfer ini dilakukan dengan memperhatikan
            Pasal 56 UU PDP, termasuk pelindungan data yang memadai dan bersifat mengikat dari penyedia layanan.
          </p>
        </Bagian>

        <Bagian id="retensi">
          <ul>
            <li>Data pasien disimpan mengikuti ketentuan retensi rekam medis yang berlaku di rumah sakit. Permenkes Nomor 24 Tahun 2022 Pasal 39 ayat (1) menetapkan data rekam medis elektronik disimpan paling singkat 25 tahun sejak tanggal kunjungan terakhir pasien.</li>
            <li>Data akun staf disimpan selama akun aktif. Akun yang pernah mencatat tindakan pada data pasien dinonaktifkan, bukan dihapus, karena namanya menjadi bagian dari jejak audit pelayanan.</li>
            <li>Log teknis disimpan oleh penyedia layanan sesuai kebijakan masing-masing.</li>
          </ul>
        </Bagian>

        <Bagian id="keamanan">
          <ul>
            <li>Semua koneksi memakai HTTPS, dan basis data dienkripsi saat disimpan oleh penyedia layanan.</li>
            <li>
              Masuk hanya dengan akun Google yang telah didaftarkan Admin/Master. Akun yang didaftarkan satu per satu baru aktif
              setelah pemiliknya memasukkan kode 6 angka dari Admin/Master, yang berlaku 5 menit. Tidak ada login dengan
              password.
            </li>
            <li>Hak akses ditegakkan di tingkat basis data per akun dan per role, bukan hanya di tampilan.</li>
            <li>Setiap perubahan data pasien tercatat sebagai jejak audit.</li>
            <li>Semua pihak yang terlibat dalam pelayanan wajib menjaga kerahasiaan data pasien, termasuk setelah pasien meninggal (Permenkes Nomor 24 Tahun 2022 Pasal 32).</li>
          </ul>
          <p>
            Bila terjadi kegagalan pelindungan data pribadi, pengendali memberitahukan secara tertulis kepada subjek data dan
            lembaga yang berwenang paling lambat 3 × 24 jam, sesuai Pasal 46 UU PDP. Pemberitahuan itu memuat data yang
            terungkap, kapan dan bagaimana data terungkap, serta upaya penanganan dan pemulihannya.
          </p>
        </Bagian>

        <Bagian id="hak">
          <p>Sesuai Pasal 5 sampai Pasal 13 UU PDP, Anda berhak:</p>
          <ul>
            <li>memperoleh informasi tentang identitas pengendali, dasar hukum, tujuan, dan akuntabilitas pemrosesan;</li>
            <li>melengkapi, memperbarui, atau memperbaiki data yang keliru;</li>
            <li>mengakses dan memperoleh salinan data pribadi Anda;</li>
            <li>meminta pemrosesan diakhiri atau data dihapus;</li>
            <li>menarik kembali persetujuan, bila pemrosesan didasarkan pada persetujuan;</li>
            <li>mengajukan keberatan atas keputusan yang hanya didasarkan pada pemrosesan otomatis;</li>
            <li>meminta pemrosesan ditunda atau dibatasi;</li>
            <li>menggugat dan menerima ganti rugi atas pelanggaran pemrosesan data pribadi Anda; dan</li>
            <li>memperoleh data Anda dalam format yang dapat dibaca sistem elektronik.</li>
          </ul>
          <p>
            <b>Staf</b> dapat mengajukan permintaan kepada Admin/Master aplikasi atau melalui kontak di bagian 13.{" "}
            <b>Pasien</b> dapat mengajukan permintaan melalui unit rekam medis rumah sakit atau kontak di bagian 13.
            Permintaan akan diverifikasi terlebih dahulu untuk memastikan identitas pemohon.
          </p>
          <p>
            Beberapa hak dapat dibatasi oleh kewajiban hukum. Misalnya, data rekam medis tidak dapat dihapus sebelum masa
            simpan yang diwajibkan peraturan berakhir.
          </p>
        </Bagian>

        <Bagian id="cookie">
          <p>
            Aplikasi hanya memakai cookie yang diperlukan untuk menjaga sesi login Anda. Tidak ada cookie iklan, analitik, atau
            pelacakan dari pihak ketiga.
          </p>
        </Bagian>

        <Bagian id="perubahan">
          <p>
            Kebijakan ini dapat diperbarui bila cara aplikasi memproses data berubah atau peraturan berubah. Tanggal berlaku di
            bagian atas halaman selalu menunjukkan versi terbaru.
          </p>
        </Bagian>

        <Bagian id="kontak">
          <p>
            Pertanyaan tentang kebijakan ini atau permintaan terkait data pribadi dapat dikirim ke{" "}
            <a href={`mailto:${KONTAK}`} className="font-medium text-teal-700 hover:underline">
              {KONTAK}
            </a>
            . Kontak pejabat pelindungan data pribadi rumah sakit akan dicantumkan di sini setelah ditetapkan.
          </p>
        </Bagian>
      </div>

      <p className="mt-10 text-sm">
        <Link href="/login" className="font-medium text-teal-700 hover:underline">
          ← Kembali ke halaman masuk
        </Link>
      </p>
    </main>
  );
}

function Bagian({ id, children }: { id: (typeof BAGIAN)[number][0]; children: React.ReactNode }) {
  const i = BAGIAN.findIndex(([k]) => k === id);
  return (
    <section>
      <h2 id={id}>
        {i + 1}. {BAGIAN[i][1]}
      </h2>
      {children}
    </section>
  );
}
