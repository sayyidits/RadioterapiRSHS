import Link from "next/link";

/** Tombol utama hijau untuk mendaftarkan pasien (hanya ditampilkan untuk administrasi). */
export function AddPatientButton() {
  return (
    <Link href="/pasien/baru" className="btn bg-emerald-600 px-5 py-2.5 text-white shadow-sm hover:bg-emerald-700">
      <span className="text-lg leading-none" aria-hidden="true">+</span>
      Tambah pasien
    </Link>
  );
}
