import Link from "next/link";

/** Tombol utama untuk mendaftarkan pasien (hanya ditampilkan untuk administrasi). */
export function AddPatientButton() {
  return (
    <Link href="/pasien/baru" className="btn btn-primary">
      + Pasien baru
    </Link>
  );
}
