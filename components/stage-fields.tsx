import { CtSimPicker } from "@/components/ct-sim-picker";
import type { Hunian } from "@/lib/booking";
import { JENIS_KELAMIN, type FieldDef, type Kategori } from "@/lib/workflow";

/** Data untuk field "ctsim": hunian pesawat dan isian form yang sedang diketik */
export type BookingInput = {
  /** Kategori pasien yang sedang dipilih (Standar / CITO); hunian & ctSim milik kategori ini */
  kategori: Kategori;
  hunian: Hunian;
  /** Pasien yang sudah dijadwalkan CT Sim per tanggal */
  ctSim: Record<string, number>;
  today: string;
  mesin: string;
  /** Sisa fraksi (jumlah fraksi − fraksi yang sudah diberikan) */
  jumlahFraksi: number;
};

/** Render input form dari definisi field di lib/workflow.ts */
export function StageFields({
  fields,
  defaults = {},
  optionLabels = {},
  booking,
}: {
  fields: FieldDef[];
  defaults?: Record<string, unknown>;
  /** Label pilihan per field, mis. { mesin: { Synergy: "Synergy (tersedia)" } } */
  optionLabels?: Record<string, Record<string, string>>;
  booking?: BookingInput;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const id = `f_${f.name}`;
        const def = defaults[f.name];
        const wide = f.type === "textarea" || f.type === "checkboxes" || f.type === "ctsim" || f.type === "kategori";
        return (
          <div key={f.name} className={wide ? "sm:col-span-2" : ""}>
            {f.type === "kategori" ? (
              <KategoriSwitch
                name={f.name}
                label={f.label}
                options={f.options ?? []}
                defaultValue={def == null ? undefined : String(def)}
              />
            ) : f.type === "checkboxes" ? (
              <fieldset>
                <legend className="label">
                  {f.label}
                  {f.required && <span className="text-rose-600"> *</span>}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {f.options?.map((opt) => (
                    <label
                      key={opt}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50 has-[:checked]:text-teal-800"
                    >
                      <input
                        type="checkbox"
                        name={f.name}
                        value={opt}
                        defaultChecked={Array.isArray(def) && def.includes(opt)}
                        className="accent-teal-700"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <>
                <label htmlFor={id} className="label">
                  {f.label}
                  {f.required && <span className="text-rose-600"> *</span>}
                </label>
                {f.type === "ctsim" ? (
                  booking && (
                    <CtSimPicker
                      id={id}
                      name={f.name}
                      hunian={booking.hunian}
                      ctSim={booking.ctSim}
                      today={booking.today}
                      kategori={booking.kategori}
                      mesin={booking.mesin}
                      jumlahFraksi={booking.jumlahFraksi}
                    />
                  )
                ) : f.type === "textarea" ? (
                  <textarea
                    id={id}
                    name={f.name}
                    rows={3}
                    required={f.required}
                    placeholder={f.placeholder}
                    defaultValue={def == null ? "" : String(def)}
                    className="input"
                  />
                ) : f.type === "select" ? (
                  <select
                    id={id}
                    name={f.name}
                    required={f.required}
                    defaultValue={def == null ? "" : String(def)}
                    className="input"
                  >
                    <option value="" disabled>
                      Pilih…
                    </option>
                    {f.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {f.name === "jenis_kelamin" ? JENIS_KELAMIN[opt] : (optionLabels[f.name]?.[opt] ?? opt)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    name={f.name}
                    type={f.type}
                    step={f.step}
                    min={f.type === "number" ? 0 : undefined}
                    required={f.required}
                    placeholder={f.placeholder}
                    defaultValue={def == null ? "" : String(def)}
                    className="input"
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Geser dua pilihan (Standar / CITO). Radio biasa supaya ikut terkirim di form dan perubahannya
 * terbaca lewat onChange form (pemilih tanggal CT Sim memakai kuota kategori yang dipilih).
 */
function KategoriSwitch({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: string[];
  defaultValue?: string;
}) {
  const initial = defaultValue && options.includes(defaultValue) ? defaultValue : options[0];
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="inline-grid grid-cols-2 rounded-full bg-slate-100 p-1 text-sm ring-1 ring-inset ring-slate-200">
          {options.map((opt) => (
            <label
              key={opt}
              className={`cursor-pointer rounded-full px-5 py-1.5 text-center font-medium text-slate-600 transition has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-500 ${
                opt === "CITO" ? "has-[:checked]:bg-rose-600 has-[:checked]:text-white" : "has-[:checked]:bg-white has-[:checked]:text-teal-800"
              }`}
            >
              <input type="radio" name={name} value={opt} defaultChecked={opt === initial} className="sr-only" />
              {opt}
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500">CITO: butuh penanganan segera, memakai kuota CITO dan tanpa jeda CT Sim ke verifikasi.</p>
      </div>
    </fieldset>
  );
}
