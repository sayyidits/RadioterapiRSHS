"use client";

import { useEffect, useState } from "react";

/**
 * Hitung mundur dari `detik` (sisa waktu menurut server) sejak komponen dipasang. Jam perangkat
 * hanya dipakai untuk selisih, jadi jam HP/laptop yang tidak tepat tidak berpengaruh.
 * Komponen diberi `key` baru untuk setiap kode, jadi `detik` tidak berubah selama terpasang.
 */
function useSisaDetik(detik: number) {
  const [sisa, setSisa] = useState(Math.max(0, Math.floor(detik)));
  useEffect(() => {
    const batas = Date.now() + detik * 1000;
    const t = setInterval(() => setSisa(Math.max(0, Math.ceil((batas - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [detik]);
  return sisa;
}

const menitDetik = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Kode undangan 6 angka yang baru dibuat, dengan hitung mundur 5 menit. Ditampilkan sekali saja
 * (database hanya menyimpan hash-nya), sengaja tanpa tombol salin: Admin dan staf bersebelahan.
 */
export function KodeUndanganTampil({ kode, detik, email }: { kode: string; detik: number; email: string }) {
  const sisa = useSisaDetik(detik);
  const habis = sisa === 0;
  return (
    <div
      className={`rounded-xl px-5 py-4 text-center ring-1 ring-inset ${habis ? "bg-slate-50 ring-slate-200" : "bg-teal-50 ring-teal-200"}`}
    >
      <p className="text-xs text-slate-600">
        Kode untuk <b className="break-all">{email}</b>
      </p>
      <p
        className={`my-2 font-mono text-4xl font-semibold tracking-[0.25em] sm:text-5xl ${habis ? "text-slate-400 line-through" : "text-teal-800"}`}
        aria-label={`Kode ${kode.split("").join(" ")}`}
      >
        {kode.slice(0, 3)} {kode.slice(3)}
      </p>
      {habis ? (
        <p className="text-sm font-medium text-rose-700">
          Kode kedaluwarsa. Klik <b>Buat kode baru</b> di daftar &quot;Terdaftar, belum pernah masuk&quot;.
        </p>
      ) : (
        <>
          <p className="text-sm font-medium text-teal-800" aria-live="polite">
            Berlaku {menitDetik(sisa)} lagi
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Minta yang bersangkutan masuk dengan Google memakai email ini, lalu mengetik kode tersebut.
          </p>
        </>
      )}
    </div>
  );
}

/** Status kode di daftar undangan: sisa waktu kode yang masih berlaku, atau kedaluwarsa */
export function SisaKode({ detik }: { detik: number }) {
  const sisa = useSisaDetik(detik);
  return sisa > 0 ? (
    <span className="text-teal-700">kode berlaku {menitDetik(sisa)} lagi</span>
  ) : (
    <span className="text-rose-700">kode kedaluwarsa</span>
  );
}
