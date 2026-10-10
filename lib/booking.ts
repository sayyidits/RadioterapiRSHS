// Pemesanan slot pesawat: dipakai pemilih tanggal CT Sim di Poli dan pilihan pesawat di Planning.
// Aturan harus sama dengan tgl_verifikasi_dari / kuota_penuh_pada di 0004_jadwal_kuota.sql
// (database tetap yang menegakkan; di sini hanya untuk tampilan).
import { addDays, workingDayFrom, workingDaysFrom } from "./holidays";
import { JEDA_CT_VERIFIKASI, kuotaOf } from "./workflow";

/** Jumlah pasien per pesawat per tanggal, mis. { Cobalt: { "2026-10-26": 30 } } */
export type Hunian = Record<string, Record<string, number>>;

/** Verifikasi (= fraksi 1) dari tanggal CT Sim: +14 hari kalender, digeser ke hari kerja. */
export function tglVerifikasiDari(ct: string) {
  return workingDayFrom(addDays(ct, JEDA_CT_VERIFIKASI));
}

export type CekKuota = {
  tersedia: boolean;
  /** Hari pertama yang kuotanya sudah habis */
  penuhPada: string | null;
  hariPenuh: number;
  /** Sisa kuota terkecil di sepanjang rangkaian (null = pesawat tanpa kuota) */
  sisaMin: number | null;
  /** Hari-hari penyinaran pasien (1 fraksi per hari kerja) */
  hari: string[];
};

/** Apakah pesawat masih punya kuota di setiap hari kerja mulai `mulai`, sebanyak `jumlahHari`. */
export function cekKuota(hunian: Hunian, mesin: string, mulai: string, jumlahHari: number): CekKuota {
  const hari = jumlahHari > 0 ? workingDaysFrom(mulai, jumlahHari) : [];
  const kuota = kuotaOf(mesin);
  if (!kuota) return { tersedia: true, penuhPada: null, hariPenuh: 0, sisaMin: null, hari };

  let penuhPada: string | null = null;
  let hariPenuh = 0;
  let sisaMin = kuota;
  for (const d of hari) {
    const sisa = kuota - (hunian[mesin]?.[d] ?? 0);
    if (sisa <= 0) {
      hariPenuh++;
      penuhPada ??= d;
    }
    sisaMin = Math.min(sisaMin, sisa);
  }
  return { tersedia: hariPenuh === 0, penuhPada, hariPenuh, sisaMin: Math.max(0, sisaMin), hari };
}

export type CtSimOption = CekKuota & { ct: string; verifikasi: string; selesai: string };

/** Kandidat tanggal CT Sim (hari kerja mulai `dari`) beserta ketersediaan kuotanya. */
export function ctSimOptions({
  hunian,
  mesin,
  jumlahFraksi,
  dari,
  jumlah,
}: {
  hunian: Hunian;
  mesin: string;
  /** Sisa fraksi yang akan diberikan */
  jumlahFraksi: number;
  dari: string;
  jumlah: number;
}): CtSimOption[] {
  return workingDaysFrom(dari, jumlah).map((ct) => {
    const verifikasi = tglVerifikasiDari(ct);
    const cek = cekKuota(hunian, mesin, verifikasi, jumlahFraksi);
    return { ct, verifikasi, selesai: cek.hari.at(-1) ?? verifikasi, ...cek };
  });
}
