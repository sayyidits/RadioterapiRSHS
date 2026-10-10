import { redirect } from "next/navigation";
import { CountPill } from "@/components/badges";
import { getCurrentUser } from "@/lib/auth";
import { listAccounts } from "@/lib/data";
import type { Akun } from "@/lib/types";
import { kelolaAkun } from "@/lib/workflow";
import { AccountRow } from "./account-row";

const GROUPS: { title: string; hint: string; status: Akun["status"][] }[] = [
  {
    title: "Menunggu persetujuan",
    hint: "Periksa nama dan role yang diminta. Role boleh diganti sebelum menyetujui.",
    status: ["menunggu"],
  },
  { title: "Akun aktif", hint: "Ubah role kerja atau nonaktifkan akun yang tidak lagi bertugas.", status: ["aktif"] },
  { title: "Belum melengkapi profil", hint: "Sudah membuat akun tetapi belum mengisi nama dan role.", status: ["baru"] },
  { title: "Ditolak / nonaktif", hint: "Tidak dapat masuk ke aplikasi sampai diaktifkan kembali.", status: ["ditolak", "nonaktif"] },
];

/** Halaman Admin/Master: persetujuan pendaftaran, role kerja, dan hak akses semua akun. */
export default async function AkunPage() {
  const user = await getCurrentUser();
  if (!kelolaAkun(user.akses)) redirect("/");
  const accounts = await listAccounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Akun</h1>
        <p className="text-sm text-slate-500">
          {user.akses === "master"
            ? "Sebagai Master, Anda mengelola semua akun dan dapat memberi hak akses Admin atau Master."
            : "Sebagai Admin, Anda mengelola akun Nakes. Akun Admin dan Master hanya dapat diubah oleh Master."}{" "}
          Akun baru hanya dapat melihat data pasien setelah disetujui. Status dan hak akses akun sendiri tidak dapat diubah.
        </p>
      </div>

      {GROUPS.map((g) => {
        const list = accounts.filter((a) => g.status.includes(a.status));
        if (list.length === 0 && g.status[0] !== "menunggu") return null;
        return (
          <section key={g.title} className="card">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold">
                {g.title}
                <CountPill n={list.length} className="ml-2" />
              </h2>
              <p className="text-xs text-slate-500">{g.hint}</p>
            </div>
            {list.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">Tidak ada pendaftaran yang menunggu.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {list.map((a) => (
                  <AccountRow key={a.id} akun={a} saya={{ id: user.id, akses: user.akses }} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
