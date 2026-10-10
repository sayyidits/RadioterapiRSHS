# Radioterapi RSHS

Website untuk memantau perjalanan pasien radioterapi dari pendaftaran sampai fraksi penyinaran terakhir. Pasien hanya bisa pindah ke tahap berikutnya kalau role yang bertanggung jawab di tahap itu sudah ACC.

> Rancangan ini masih prototipe dan belum disetujui atasan. Pakai data dummy saja dulu.

## Alur

| # | Tahap | Penanggung jawab | Bisa dikembalikan ke |
|---|---|---|---|
| 1 | Pendaftaran | Administrasi | – |
| 2 | Poli Radioterapi (dosis, jumlah fraksi, rencana pesawat, tanggal CT Sim) | Dokter DPJP atau Perawat | – |
| 3 | CT Simulator | RTT | – |
| 4 | Delineasi | Dokter DPJP | CT Simulator |
| 5 | Planning (ACC plan, boleh mengganti pesawat yang masih ada kuotanya) | Fisikawan Medis | tahap mana pun sebelumnya, paling jauh CT Simulator |
| 6 | Verifikasi (DRR/CBCT/EPID/QA) | RTT | tahap mana pun sebelumnya, paling jauh CT Simulator |
| 7 | Penyinaran (absen hadir, lalu dicatat per fraksi) | Administrasi (absen), RTT | tahap mana pun sebelumnya, paling jauh CT Simulator (replanning) |
| 8 | Selesai | otomatis setelah fraksi terakhir tercatat | – |

- **Jadwal berdasarkan kuota pesawat**: di Poli, dokter/perawat memilih rencana pesawat dan tanggal CT Sim (H). Verifikasi jatuh di H+14 hari (digeser ke hari kerja bila libur), dan fraksi pertama diberikan di hari yang sama. Delineasi dan Planning harus selesai sebelum tanggal verifikasi. Tanggal CT Sim hanya bisa dipilih kalau **setiap** hari penyinaran pasien (mulai verifikasi, satu fraksi per hari kerja) masih ada kuota di pesawat itu. Aturan ini mutlak dan dicek ulang oleh database.
- **Kuota harian pesawat**: Synergy 65, Precise 65, Cobalt 30 pasien per hari. Brakiterapi tanpa kuota.
- **Kuota CT Simulator**: maksimal 7 pasien per hari untuk semua pesawat. Tanggal CT Sim yang sudah berisi 7 pasien dicoret ("CT Sim penuh") dan ditolak database, walaupun kuota pesawatnya masih ada.
- **Tugas saya** di dashboard diberi nomor prioritas berdasarkan due date: yang terlambat paling atas, lalu yang paling dekat. Due date: CT Sim = tanggal CT Sim, Delineasi/Planning/Verifikasi = tanggal verifikasi, Penyinaran = setiap hari kerja. Pasien di Poli belum punya due date. Untuk dokter, antrean Poli tampil terpisah di bagian **Poli hari ini** (di atas Tugas saya), sehingga Tugas saya dokter hanya berisi Delineasi.
- **Dashboard per tanggal**: semua role bisa memilih tanggal dan melihat agenda hari itu: CT Sim, verifikasi & mulai penyinaran, selesai penyinaran, dan jumlah pasien tiap pesawat dibanding kuota.
- **DPJP** dipilih administrasi saat pendaftaran. Tahap dokter hanya bisa dikerjakan DPJP pasien tersebut, dan untuk sekarang DPJP belum bisa dipindah.
- **Perawat** bisa ACC di tahap Poli (mengisi field yang sama dengan dokter). Di tahap lain perawat hanya melihat.
- **ACC Planning** cukup oleh fismed (sudah didiskusikan dengan dokter), lalu pasien langsung ke Verifikasi.
- **Kembalikan** bisa langsung ke tahap mana pun sebelumnya, paling jauh CT Simulator (CT ulang), termasuk dari Penyinaran untuk replanning (mis. tumor membesar). Pasien tidak pernah dikembalikan ke Poli karena Poli sudah pasti selesai. Fraksi yang sudah diberikan tetap dihitung.
- **Poli hanya berlaku 1 hari**: kunjungan Poli harus di-ACC (dan dijadwalkan) di hari itu juga. Kalau tidak, kunjungan hangus dan muncul di daftar **Poli hangus** milik administrasi, yang bisa mendaftarkan ulang saat pasien datang lagi.
- **Due date** juga tampil di samping nama tahap Delineasi dan Planning di halaman pasien.
- **Mesin**: Synergy, Precise, Cobalt, Brakiterapi. Direncanakan di Poli, bisa diganti fismed di Planning bila kuotanya cukup, menjadi mesin bawaan saat mencatat fraksi, dan boleh diganti untuk satu fraksi saja.
- **Jadwal fraksi**: setelah fraksi pertama diberikan, halaman pasien menampilkan semua fraksi sampai terakhir: yang sudah disinar, hari tidak hadir, dan jadwal sisa fraksi (1 per hari kerja, melewati Sabtu, Minggu, libur nasional, dan cuti bersama). Jika pasien tidak hadir, sisa jadwal otomatis mundur. Daftar libur ada di `lib/holidays.ts` dan tabel `hari_libur` di database (2026 dan 2027). Keduanya perlu ditambah setiap SKB 3 Menteri tahun berikutnya terbit.
- **Info Pesawat**: jumlah pasien per hari di Synergy, Precise, dan Cobalt dibanding kuota harian, dengan grafik 20 hari kerja ke depan dan daftar pasien di tanggal yang dipilih. Pasien terhitung sejak ACC Poli, mulai hari verifikasi sampai fraksi terakhir.
- **Absen penyinaran**: setiap hari administrasi (atau RTT) mencatat pasien hadir / tidak hadir di halaman **Absen Penyinaran**. Fraksi hanya bisa dicatat untuk pasien yang hadir, dengan tanggal otomatis hari ini (WIB). Status boleh diubah dan perubahannya tercatat, kecuali menjadi tidak hadir setelah fraksi hari itu tercatat. Lebih dari satu fraksi per hari diperbolehkan (hiperfraksi).
- Setiap ACC menampilkan **konfirmasi** agar data diperiksa kembali sebelum pasien dipindahkan.

Aturan alur ada di dua tempat yang harus selalu sama:
- `lib/workflow.ts`: label, penanggung jawab, isian form tiap tahap, daftar mesin, dan tujuan "Kembalikan" (untuk UI)
- `supabase/migrations/` (dijalankan berurutan): fungsi `stage_owner`, `next_stage`, `can_return`, `can_act`, `advance_stage`, `return_stage`, `record_fraction`, `set_attendance`, `jadwal_sinar`, `hunian_pesawat`, `kuota_penuh_pada` (aturan yang benar-benar ditegakkan di database)

## Teknologi

Next.js 16 (App Router, Server Actions), Tailwind CSS 4, Supabase (Postgres, Auth, RLS), dan deploy di Vercel.

## Menjalankan mode demo (tanpa setup)

Jika `.env.local` belum berisi `NEXT_PUBLIC_SUPABASE_URL`, aplikasi otomatis berjalan dalam **mode demo**:

```bash
npm install
npm run dev
```

Buka http://localhost:3000 lalu pilih role. Di mode demo:
- Database Postgres (PGlite) berjalan langsung di laptop dan memakai migration SQL yang sama, jadi aturan ACC per role tetap berlaku.
- Tidak perlu login. Role dipilih di halaman awal dan bisa diganti kapan saja lewat dropdown **"Lihat sebagai"** di kanan atas tanpa pindah halaman.
- Data awalnya ±350 pasien dummy di berbagai tahap, dibagi ke dua dokter. Jumlahnya dibuat supaya kuota harian ketiga pesawat penuh selama beberapa minggu ke depan, sehingga dokter dan perawat harus mencari tanggal CT Sim yang masih kosong. Termasuk satu pasien replanning ("Wayan Sudarsa") yang dikembalikan dari Penyinaran ke Planning, dan satu kunjungan Poli yang hangus ("Nurhayati") untuk dicoba didaftarkan ulang oleh administrasi. Tombol **Reset data demo** ada di halaman pilih role (klik **Keluar**) dan mengembalikan data ke kondisi awal.
- Papan **Alur pasien** (kolom per tahap) di dashboard hanya muncul di mode demo, untuk presentasi.
- Data tersimpan di `node_modules/.cache/demo-db`. Kalau file migration SQL berubah, data demo otomatis dibuat ulang.

Skenario demo singkat:
1. **Administrasi**: tombol **+ Pasien baru** di dashboard → daftarkan pasien dan pilih dokter DPJP. Pasien langsung masuk Poli.
2. **Dokter DPJP** (atau **Perawat**): buka pasien di Poli (mis. "Siti Aminah" atau "Suparman") → isi dosis & jumlah fraksi → pilih rencana pesawat → pilih tanggal CT Sim. Tanggal yang dicoret sudah penuh. Kursus pendek (5 fraksi) bisa dapat tanggal lebih awal daripada kursus panjang (25 fraksi) → ACC → periksa lagi tanggal verifikasi di konfirmasi. Dokter lain hanya bisa melihat.
3. **Dokter**: tab **Daftar Pasien** berisi pasien miliknya, tab **Daftar Pasien Penuh** berisi semua pasien.
4. **RTT** → CT Simulator, lalu **Dokter** → Delineasi, lalu **Fismed** → Planning (pesawat bisa diganti, dropdown menampilkan pesawat mana yang masih tersedia) → ACC langsung ke Verifikasi. "Tugas saya" tiap role diurutkan dari due date terdekat. Contoh pasien terlambat: "Teguh Prasetyo" (CT Sim) dan "Hendra Wijaya" (Verifikasi).
5. **Fismed** di Planning: coba **Kembalikan** langsung ke CT Simulator dengan alasan.
6. **RTT**: verifikasi (DRR/CBCT/EPID/QA).
7. **Administrasi**: menu **Absen Penyinaran** → tandai pasien hadir / tidak hadir.
8. **RTT**: menu **Penyinaran Hari Ini** → catat fraksi untuk pasien yang hadir, dikelompokkan per mesin. Untuk melihat penyelesaian dengan cepat, pakai pasien "Slamet Riyadi" (3/5 fraksi). Di halaman pasien yang sedang penyinaran ada **Kembalikan untuk replanning**.
9. **Semua role**: menu **Info Pesawat** → jumlah pasien per hari di tiap pesawat dibanding kuota harian (Cobalt 30). Klik salah satu hari di grafik untuk melihat daftar pasiennya. Di dashboard, ganti tanggal di bagian **Agenda**.
10. **dr. Andi (Dokter + Master)** atau **Dewi Lestari (Administrasi + Admin)**: menu **Akun** → setujui atau tolak pendaftar contoh ("dr. Budi Hartono", "Ns. Putri Maharani"). Dokter yang disetujui langsung muncul di pilihan DPJP. Bandingkan: Admin tidak bisa mengubah akun dr. Andi (Master) dan tidak bisa memberi hak Admin. Halaman login Google dan lengkapi profil hanya ada di mode Supabase.

## Akun dan login (mode Supabase)

- Siapa pun bisa membuat akun dengan **Google** atau **email + password** di halaman login.
- Akun baru wajib **melengkapi profil**: nama lengkap beserta gelar dan role yang diminta.
- Setelah itu akun **menunggu persetujuan** dan belum bisa melihat data pasien apa pun.
- Setiap akun punya **role kerja** (Dokter, Perawat, RTT, Fismed, Administrasi), yang menentukan tahap yang bisa di-ACC, dan **hak akses** dengan urutan **Master → Admin → Nakes**:
  - **Nakes**: tidak mengelola akun.
  - **Admin**: menyetujui/menolak pendaftar, mengubah role kerja, dan menonaktifkan akun Nakes di menu **Akun**. Tidak bisa mengubah akun Admin/Master atau memberi hak Admin/Master.
  - **Master**: mengelola semua akun, termasuk mengangkat Admin atau Master lain.
  - Status dan hak akses akun sendiri tidak bisa diubah sendiri.
- Aturan ini ditegakkan di database (RLS dan fungsi Postgres), bukan hanya di tampilan.

## Setup Supabase + Vercel (untuk pemakaian sebenarnya)

### 1. Supabase dan database

1. **Buat project Supabase** di https://supabase.com (region terdekat: Singapore).
2. Salin `.env.example` menjadi `.env.local`, lalu isi:
   - `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (atau `..._ANON_KEY`), dari Project Settings → API
   - `SUPABASE_DB_URL`: klik **Connect** di dashboard, lalu pilih connection string mode *Session pooler*
   - `SUPABASE_SERVICE_ROLE_KEY` dan `DEMO_PASSWORD` hanya perlu kalau ingin menjalankan `db:seed`
3. Jalankan migration:
   ```bash
   npm install
   npm run db:setup
   ```
   Alternatif tanpa `SUPABASE_DB_URL`: buka Supabase → SQL Editor, lalu tempel dan jalankan **semua** file di `supabase/migrations/` satu per satu secara berurutan (0001 sampai 0009).
4. `npm run db:seed` (opsional) membuat 6 akun demo (dokter@flowrt.test sebagai Master, admin@flowrt.test sebagai Admin) dan ±350 pasien dummy. **Jangan dijalankan** di database yang akan dipakai sungguhan, atau nonaktifkan akun demo setelahnya.

### 2. Deploy ke Vercel

1. Push repo ini ke GitHub, lalu di https://vercel.com pilih **Add New → Project** dan import repo tersebut.
2. Di **Environment Variables**, isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (atau `..._ANON_KEY`). **Jangan** pasang `SUPABASE_SERVICE_ROLE_KEY` atau `SUPABASE_DB_URL` di Vercel.
3. Deploy, lalu catat alamatnya, mis. `https://flow-radioterapi.vercel.app`.

### 3. Login email dan Google

1. Supabase → **Authentication → URL Configuration**:
   - **Site URL**: alamat Vercel tadi
   - **Redirect URLs**: tambahkan `https://<alamat-vercel>/auth/callback` dan `http://localhost:3000/auth/callback`
2. Supabase → **Authentication → Sign In / Providers**:
   - **Allow new users to sign up**: aktif (persetujuan Admin/Master yang menyaring akun)
   - **Email**: aktif, dengan **Confirm email** aktif. Pengiriman email bawaan Supabase sangat dibatasi; untuk pemakaian sebenarnya pasang SMTP sendiri di Authentication → Emails → SMTP Settings.
3. **Google Cloud Console** (https://console.cloud.google.com):
   1. Buat project, lalu **APIs & Services → OAuth consent screen**: isi nama aplikasi dan email kontak, tipe *External*.
   2. **Credentials → Create credentials → OAuth client ID**, tipe *Web application*.
   3. **Authorized redirect URIs**: salin *Callback URL* dari halaman provider Google di Supabase, bentuknya `https://<project-ref>.supabase.co/auth/v1/callback`.
   4. Salin **Client ID** dan **Client secret**.
4. Supabase → **Authentication → Sign In / Providers → Google**: aktifkan, lalu tempel Client ID dan Client secret.

### 4. Master pertama

1. Buka website, daftar dengan email atau Google, lalu lengkapi profil. Akun akan berstatus menunggu persetujuan.
2. Beri akun itu hak akses Master (sekali saja, role kerjanya tetap, dari komputer yang punya `.env.local` berisi `SUPABASE_DB_URL`):
   ```bash
   npm run akun:master -- email-anda@contoh.com
   ```
3. Muat ulang website. Menu **Akun** muncul, dan pendaftaran staf berikutnya disetujui dari sana. Admin dan Master lain diangkat dengan memilih hak akses di halaman Akun.

## Keamanan

- Semua tabel memakai Row Level Security. Hanya akun **aktif** (disetujui Admin/Master) yang bisa membaca data pasien. Akun yang belum disetujui hanya bisa membaca profilnya sendiri.
- Tidak ada yang bisa insert/update/delete langsung. Setiap perubahan lewat fungsi Postgres (`security definer`) yang mengecek role user yang aktif dan tahap pasien saat itu. Tombol yang disembunyikan di UI hanyalah tampilan, aturan sebenarnya ada di database.
- Role tidak pernah dibaca dari data yang bisa diisi pengguna sendiri (`user_metadata`). Role kerja dan hak akses diberikan Admin/Master sesuai hierarki, atau lewat `app_metadata` oleh administrator.
- Setiap ACC dan pengembalian tercatat di `stage_events` (siapa, role, kapan, catatan). Setiap pencatatan kehadiran tersimpan sebagai baris baru di `attendance`, jadi perubahan tidak menghapus catatan sebelumnya.
