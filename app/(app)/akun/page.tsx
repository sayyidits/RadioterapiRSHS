import { redirect } from "next/navigation";
import { CountPill } from "@/components/badges";
import { getCurrentUser } from "@/lib/auth";
import { listAccounts, listUndangan } from "@/lib/data";
import type { Akun } from "@/lib/types";
import { kelolaAkun } from "@/lib/workflow";
import { AccountRow } from "./account-row";
import { UndanganRow, UndangForm } from "./undang-form";

const GROUPS: { title: string; hint: string; status: Akun["status"][] }[] = [
  {
    title: "Belum terdaftar",
    hint: "Sudah masuk dengan Google tetapi belum didaftarkan. Pilih role lalu Daftarkan, atau Tolak bila bukan staf.",
    status: ["baru"],
  },
  { title: "Menunggu persetujuan", hint: "Pendaftaran lama yang belum diproses.", status: ["menunggu"] },
  { title: "Akun aktif", hint: "Ubah role kerja atau nonaktifkan akun yang tidak lagi bertugas.", status: ["aktif"] },
  { title: "Ditolak / nonaktif", hint: "Tidak dapat masuk ke aplikasi sampai diaktifkan kembali.", status: ["ditolak", "nonaktif"] },
];

/** Halaman Admin/Master: pendaftaran akun (undangan), role kerja, dan hak akses semua akun. */
export default async function AkunPage() {
  const user = await getCurrentUser();
  if (!kelolaAkun(user.akses)) redirect("/");
  const [accounts, undangan] = await Promise.all([listAccounts(), listUndangan()]);
  const saya = { id: user.id, akses: user.akses };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Akun</h1>
        <p className="text-sm text-slate-500">
          Akun hanya bisa dibuat oleh Admin atau Master.{" "}
          {user.akses === "master"
            ? "Sebagai Master, Anda mengelola semua akun dan dapat memberi hak akses Admin atau Master."
            : "Sebagai Admin, Anda mendaftarkan dan mengelola akun Nakes. Akun Admin dan Master hanya dapat diubah oleh Master."}{" "}
          Status dan hak akses akun sendiri tidak dapat diubah.
        </p>
      </div>

      <section className="card">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">Daftarkan akun</h2>
          <p className="text-xs text-slate-500">
            Masukkan email Google nakes. Saat pemilik email masuk dengan Google pertama kali, akunnya langsung aktif dengan
            nama dan role ini, tanpa perlu persetujuan lagi.
          </p>
        </div>
        <div className="px-5 py-4">
          <UndangForm akses={user.akses} />
        </div>
      </section>

      {undangan.length > 0 && (
        <section className="card">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">
              Terdaftar, belum pernah masuk
              <CountPill n={undangan.length} className="ml-2" />
            </h2>
            <p className="text-xs text-slate-500">Akun aktif otomatis saat pemilik email masuk pertama kali.</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {undangan.map((u) => (
              <UndanganRow key={u.email} undangan={u} bisaHapus={user.akses === "master" || u.akses === "nakes"} />
            ))}
          </ul>
        </section>
      )}

      {GROUPS.map((g) => {
        const list = accounts.filter((a) => g.status.includes(a.status));
        if (list.length === 0) return null;
        return (
          <section key={g.title} className="card">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold">
                {g.title}
                <CountPill n={list.length} className="ml-2" />
              </h2>
              <p className="text-xs text-slate-500">{g.hint}</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {list.map((a) => (
                <AccountRow key={a.id} akun={a} saya={saya} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
