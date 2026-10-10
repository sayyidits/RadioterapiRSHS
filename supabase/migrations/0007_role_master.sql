-- =====================================================================
-- Flow Radioterapi — 0007
-- Role master: mengelola akun (menyetujui pendaftaran, mengubah role,
-- menonaktifkan akun). Tidak ikut ACC pasien. Dipisah dari 0008 karena nilai
-- enum baru belum bisa dipakai di transaksi yang sama dengan penambahannya.
-- =====================================================================

alter type public.user_role add value if not exists 'master';
