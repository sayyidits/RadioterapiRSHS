import { JENIS_KELAMIN, type FieldDef } from "@/lib/workflow";

/** Render input form dari definisi field di lib/workflow.ts */
export function StageFields({
  fields,
  defaults = {},
}: {
  fields: FieldDef[];
  defaults?: Record<string, unknown>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const id = `f_${f.name}`;
        const def = defaults[f.name];
        const wide = f.type === "textarea" || f.type === "checkboxes";
        return (
          <div key={f.name} className={wide ? "sm:col-span-2" : ""}>
            {f.type === "checkboxes" ? (
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
                {f.type === "textarea" ? (
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
                        {f.name === "jenis_kelamin" ? JENIS_KELAMIN[opt] : opt}
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
