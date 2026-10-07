# Flow Radioterapi

Website untuk memantau perjalanan pasien radioterapi dari pendaftaran sampai fraksi penyinaran terakhir. Pasien hanya bisa pindah ke tahap berikutnya kalau role yang bertanggung jawab di tahap itu sudah ACC.

> Rancangan ini masih prototipe dan belum disetujui atasan. Pakai data dummy saja dulu.

## Alur

| # | Tahap | Penanggung jawab | Bisa dikembalikan ke |
|---|---|---|---|
| 1 | Pendaftaran | Administrasi | – |
| 2 | Poli Radioterapi | Dokter Sp.Onk.Rad | Pendaftaran |
| 3 | CT Simulator | RTT | Poli |
| 4 | Delineasi (dosis & jumlah fraksi) | Dokter | CT Simulator |
| 5 | Planning | Fisikawan Medis | Delineasi |
| 6 | ACC Planning | Dokter | Planning |
| 7 | Verifikasi (DRR/CBCT/EPID/QA) | RTT | Planning, CT Simulator |
| 8 | Penyinaran (dicatat per fraksi) | RTT | – |
| 9 | Selesai | otomatis setelah fraksi terakhir tercatat | – |

Perawat hanya bisa melihat (tidak ada tombol ACC).

Aturan alur ada di dua tempat yang harus selalu sama:
- `lib/workflow.ts`: label, penanggung jawab, isian form tiap tahap, dan tujuan "Kembalikan" (untuk UI)
- `supabase/migrations/0001_init.sql`: fungsi `stage_owner`, `can_return`, `advance_stage`, `return_stage`, `record_fraction` (aturan yang benar-benar ditegakkan di database)

## Teknologi

Next.js 16 (App Router, Server Actions), Tailwind CSS 4, Supabase (Postgres, Auth, RLS), dan deploy di Vercel.

## Setup

1. **Buat project Supabase** di https://supabase.com (gratis).
2. Salin `.env.example` menjadi `.env.local`, lalu isi:
   - `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (atau `..._ANON_KEY`), dari Project Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY`, dari Project Settings → API (rahasia, hanya untuk script lokal)
   - `SUPABASE_DB_URL`: klik **Connect** di dashboard, lalu pilih connection string mode *Session pooler*
   - `DEMO_PASSWORD`: password untuk akun demo, minimal 8 karakter
3. Install lalu siapkan database:
   ```bash
   npm install
   npm run db:setup   # menjalankan migration SQL
   npm run db:seed    # membuat 5 akun demo dan 10 pasien dummy
   ```
   Kalau tidak mau memakai `SUPABASE_DB_URL`, buka Supabase → SQL Editor, tempel isi `supabase/migrations/0001_init.sql`, lalu klik Run.
4. Jalankan: `npm run dev`, lalu buka http://localhost:3000

### Akun demo

| Role | Email |
|---|---|
| Dokter Sp.Onk.Rad | dokter@flowrt.test |
| Perawat | perawat@flowrt.test |
| RTT | rtt@flowrt.test |
| Fisikawan Medis | fismed@flowrt.test |
| Administrasi | admin@flowrt.test |

Semua akun memakai password dari `DEMO_PASSWORD`. Pendaftaran akun publik tidak tersedia. Akun baru dibuat lewat dashboard Supabase (Authentication → Add user) dengan user metadata `{"full_name": "...", "role": "dokter|perawat|rtt|fismed|administrasi"}`.

> Matikan sign-up publik di Supabase → Authentication → Sign In / Providers → "Allow new users to sign up".

## Deploy ke Vercel

Tambahkan environment variable `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (atau `ANON_KEY`) di project Vercel, lalu deploy. **Jangan** pasang `SUPABASE_SERVICE_ROLE_KEY` di Vercel karena aplikasi tidak membutuhkannya.

## Keamanan

- Semua tabel memakai Row Level Security. User yang login hanya bisa membaca, dan tidak bisa insert/update/delete langsung.
- Setiap perpindahan tahap lewat fungsi Postgres (`security definer`) yang mengecek role user dan tahap pasien saat itu. Tombol yang disembunyikan di UI hanyalah tampilan, aturan sebenarnya ada di database.
- Setiap ACC dan pengembalian tercatat di `stage_events` (siapa, role, kapan, catatan).
