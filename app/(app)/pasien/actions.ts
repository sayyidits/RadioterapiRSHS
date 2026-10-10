"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPatientStage } from "@/lib/data";
import { rpc } from "@/lib/rpc";
import type { ActionState } from "@/lib/types";
import { PATIENT_IDENTITY_FIELDS, STAGE_MAP, isStageKey, type FieldDef } from "@/lib/workflow";

function readPayload(fields: FieldDef[], formData: FormData) {
  const payload: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "checkboxes") {
      const values = formData.getAll(f.name).map(String);
      if (f.required && values.length === 0) return { error: `${f.label} wajib dipilih minimal satu` };
      payload[f.name] = values;
      continue;
    }
    const raw = String(formData.get(f.name) ?? "").trim();
    if (f.required && !raw) return { error: `${f.label} wajib diisi` };
    if (!raw) continue;
    if (f.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) return { error: `${f.label} harus berupa angka lebih dari 0` };
      if (f.step === "1" && !Number.isInteger(n)) return { error: `${f.label} harus bilangan bulat` };
      payload[f.name] = n;
    } else {
      payload[f.name] = raw;
    }
  }
  return { payload };
}

/** Isian teks opsional: kosong = null */
function optional(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim() || null;
}

/** Setiap perubahan bisa tampil di semua halaman (dashboard, daftar, penyinaran, info pesawat, pasien) */
function refresh() {
  revalidatePath("/", "layout");
}

export async function createPatientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { payload, error } = readPayload(PATIENT_IDENTITY_FIELDS, formData);
  if (error || !payload) return { error };
  const dpjp = optional(formData, "dpjp");
  if (!dpjp) return { error: "Dokter DPJP wajib dipilih" };

  const { data, error: rpcError } = await rpc<string>("create_patient", {
    p_no_rm: payload.no_rm,
    p_nama: payload.nama,
    p_tgl_lahir: payload.tgl_lahir,
    p_jenis_kelamin: payload.jenis_kelamin,
    p_no_hp: payload.no_hp ?? null,
    p_diagnosis: payload.diagnosis,
    p_dpjp: dpjp,
    p_note: optional(formData, "note"),
  });
  if (rpcError) return { error: rpcError.message };

  refresh();
  redirect(`/pasien/${data}`);
}

export async function advanceAction(patientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const stage = formData.get("stage");
  if (!isStageKey(stage)) return { error: "Tahap tidak valid" };

  const current = await getPatientStage(patientId);
  if (current !== stage) {
    return { error: "Status pasien sudah berubah oleh pengguna lain. Muat ulang halaman." };
  }

  const { payload, error } = readPayload(STAGE_MAP[stage].fields, formData);
  if (error || !payload) return { error };

  const { error: rpcError } = await rpc("advance_stage", {
    p_patient: patientId,
    p_payload: payload,
    p_note: optional(formData, "note"),
  });
  if (rpcError) return { error: rpcError.message };

  refresh();
  return { success: "Tersimpan. Pasien dipindahkan ke tahap berikutnya." };
}

export async function returnAction(patientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const target = formData.get("target");
  const note = optional(formData, "note");
  if (!isStageKey(target)) return { error: "Pilih tahap tujuan" };
  if (!note) return { error: "Alasan pengembalian wajib diisi" };

  const { error } = await rpc("return_stage", { p_patient: patientId, p_target: target, p_note: note });
  if (error) return { error: error.message };

  refresh();
  return { success: `Pasien dikembalikan ke ${STAGE_MAP[target].label}.` };
}

/** Tanggal fraksi selalu hari ini (ditentukan di database). */
export async function recordFractionAction(patientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { data, error } = await rpc<number>("record_fraction", {
    p_patient: patientId,
    p_mesin: optional(formData, "mesin"),
    p_catatan: optional(formData, "catatan"),
  });
  if (error) return { error: error.message };

  refresh();
  return { success: `Fraksi ke-${data} tercatat.` };
}

export async function setAttendanceAction(patientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const hadir = formData.get("hadir");
  if (hadir !== "true" && hadir !== "false") return { error: "Pilih hadir atau tidak hadir" };

  const { error } = await rpc("set_attendance", {
    p_patient: patientId,
    p_hadir: hadir === "true",
    p_catatan: optional(formData, "catatan"),
  });
  if (error) return { error: error.message };

  refresh();
  return { success: hadir === "true" ? "Tercatat hadir." : "Tercatat tidak hadir." };
}

/** Kunjungan Poli yang hangus didaftarkan ulang oleh administrasi, berlaku hari ini. */
export async function reRegisterPoliAction(patientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { error } = await rpc("daftar_ulang_poli", {
    p_patient: patientId,
    p_note: optional(formData, "note"),
  });
  if (error) return { error: error.message };

  refresh();
  return { success: "Pasien didaftarkan ulang ke Poli untuk hari ini." };
}
