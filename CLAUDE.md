# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Patient-tracking web app for a radiotherapy department. Each patient moves through a fixed
sequence of stages, and only the role responsible for the current stage can ACC (approve) it
to move the patient forward, or send it back ("Kembalikan") with a mandatory reason. Treatment
is logged per fraction until the last one auto-completes the patient.

**Status: prototype for a presentation to the user's supervisor.** The workflow below is the
user's own understanding and has **not been confirmed** by the department yet. Expect changes
to stages, form fields, and return targets after that meeting. Use dummy data only. These are
real health records once in use.

The UI, code comments, and commit messages are in Indonesian. Match that when editing.

### Domain glossary

- **Dokter Sp.Onk.Rad**: radiation oncologist
- **RTT**: radiotherapy technologist (runs the CT simulator and the treatment machine)
- **Fismed**: fisikawan medis (medical physicist, does treatment planning)
- **Delineasi**: contouring targets and OARs. The doctor also sets total dose (Gy) and number of fractions here.
- **Fraksi**: one treatment session. Dose per fraction = total dose / number of fractions.
- **DRR / CBCT / EPID / QA**: verification methods selectable at the Verifikasi stage
- **No. RM**: rekam medis (medical record) number, unique per patient

## Workflow (the core rule set)

| # | Stage key | Owner role | Can be returned to |
|---|---|---|---|
| 1 | `PENDAFTARAN` | administrasi | – |
| 2 | `POLI` | dokter | PENDAFTARAN |
| 3 | `CT_SIM` | rtt | POLI |
| 4 | `DELINEASI` | dokter (sets dose + fraction count) | CT_SIM |
| 5 | `PLANNING` | fismed | DELINEASI |
| 6 | `ACC_PLAN` | dokter (may revise dose/fractions) | PLANNING |
| 7 | `VERIFIKASI` | rtt | PLANNING, CT_SIM |
| 8 | `PENYINARAN` | rtt, one `record_fraction` call per fraction, no manual ACC | – |
| 9 | `SELESAI` | automatic when fraction N of N is recorded | – |

`perawat` (nurse) is view-only everywhere. Registering a patient (`create_patient`) inserts it
directly at `POLI`. `PENDAFTARAN` is only reached again when a doctor returns the patient
(e.g. wrong identity data), and then administrasi edits and re-sends.

**These rules live in two places that must stay in sync:**
- `lib/workflow.ts`: labels, owner per stage, form fields per stage (`FieldDef[]`), return targets. Drives the whole UI. Forms are generated from field definitions, so there is no per-stage form component.
- `supabase/migrations/0001_init.sql`: `stage_owner()`, `can_return()`, `next_stage()` (uses enum declaration order), and the `security definer` RPCs `create_patient`, `advance_stage`, `return_stage`, `record_fraction`. **This is the actual enforcement.** Hiding a button in the UI is cosmetic.

Stage-specific SQL logic in `advance_stage`: `PENDAFTARAN` updates identity columns from the
payload, and `DELINEASI`/`ACC_PLAN` write `dosis_total_gy`/`total_fraksi` (required, > 0).
Every stage's form payload is merged into `patients.data[STAGE_KEY]` (jsonb) with `_at`/`_by`,
and every transition writes a row to `stage_events` (audit trail shown as "Riwayat").

All tables have RLS: authenticated users may only SELECT, and all writes go through the RPCs.
Adding a stage means adding it to the `stage` enum **in the right position**, then to
`stage_owner`/`can_return`, then to `STAGE_KEYS`/`STAGES` in `lib/workflow.ts`.

## Commands

```bash
npm run dev          # dev server (demo mode if no Supabase env, see below)
npm run build        # production build
npm run lint         # eslint
npm run typecheck    # next typegen && tsc --noEmit (PageProps/LayoutProps types come from typegen)

npm run db:setup     # apply supabase/migrations/*.sql to SUPABASE_DB_URL (tracked in app_private.migrations)
npm run db:seed      # create 5 demo accounts + 10 dummy patients in Supabase (needs service role key)
```

There is no test suite. The SQL rules were verified with an ad-hoc PGlite script that ran
every forbidden action (wrong role ACC, direct INSERT/UPDATE, return without reason, fraction
beyond total, ...). If you change the SQL, re-verify the same way. Demo mode is a convenient
harness for this because it runs the real migration.

Run only **one** dev server at a time. Demo mode's PGlite holds the data directory open, and two
processes on it will corrupt it.

## Two runtime modes

`lib/mode.ts`: `IS_DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL` (inlined at build time).

**Demo mode** (current default, used for the presentation):
- `lib/demo/db.ts` runs PGlite (Postgres in WASM) inside the Next.js process. On first open it creates a minimal Supabase stub (`anon`/`authenticated`/`service_role` roles, `auth.users`, `auth.uid()` reading `request.jwt.claim.sub`), runs the **same** migration files, and seeds from `lib/demo-seed.ts`.
- Queries run through `asUser(uid, fn)`: a transaction with `set_config('request.jwt.claim.sub', uid)` + `set local role authenticated`, so RLS and the RPC role checks behave exactly as in production.
- Data dir: `node_modules/.cache/demo-db`. Keep it out of the project root, or Turbopack watches it and reloads endlessly. On Vercel it falls back to `memory://`, which is not suitable for shared use: each instance holds its own copy and resets on cold start.
- No login: the `demo_uid` cookie holds one of the fixed `DEMO_USERS` ids. You pick a role on `/login`, and a "Lihat sebagai" dropdown in the header switches role while staying on the same page. "Reset data demo" is on the `/login` role-picker page.
- `getDemoDb()` caches the open promise on `globalThis`, and a failed open clears it. If you ever see the same init error repeating, restart the dev server.

**Supabase mode** (current production path, likely to be replaced, see below): `@supabase/ssr`
cookie sessions refreshed in `proxy.ts` → `lib/supabase/proxy.ts`, email/password login,
roles stored in `profiles` (created by a trigger from `user_metadata` at user creation).

Every data access goes through a mode-agnostic layer, so pages and actions never touch a
backend directly:
- `lib/auth.ts`: `getCurrentUser()` (React `cache`, redirects to `/login`)
- `lib/data.ts`: `listPatients`, `getPatient`, `getPatientStage`, `fractionCounts`. Demo queries use `selectJson` (`row_to_json`) so dates and numbers come back in the same JSON shape as PostgREST.
- `lib/rpc.ts`: `rpc(name, args)` calls the Postgres functions with named arguments. Raised exception messages are user-facing Indonesian text and are shown as-is in forms.

## UI rules decided with the user

- The **"Alur pasien" kanban board** on the dashboard (`StageBoard` in `app/(app)/page.tsx`) is **demo/presentation only**. It renders only when `IS_DEMO` and must not appear in the production website.
- The primary action is a **"+ Pasien baru" button** (`components/add-patient-button.tsx`, top-right of the dashboard and the patient list, administrasi only) instead of relying on the header nav link, because the user found people miss the link at the top. Keep it in production. Style: the standard teal `btn btn-primary` at normal size. The user tried a larger emerald "Tambah pasien" variant and preferred this one.
- Patient list (`components/patient-table.tsx`): the stage column is labeled **"Status"**, and so is the list filter. The **Fraksi** column only shows a value while the patient is in `PENYINARAN` (to avoid distraction) and renders `done/total` with a pastel light-blue (`bg-sky-300`) progress bar under it. Every other status shows "-".
- Registration form fields: No. RM, nama, tanggal lahir, jenis kelamin (L/P), no HP, diagnosis rujukan.

## Next.js 16 specifics used here

- Middleware is `proxy.ts` (Node runtime). It only does optimistic redirects. Real auth checks happen in `getCurrentUser()`.
- `cacheComponents` is deliberately **off** (`next.config.ts`). Every page reads the session per request, and with it on, any `cookies()` read outside `<Suspense>` is a build error.
- `params`/`searchParams` are Promises, and `PageProps<"/route">`/`LayoutProps` are global types generated by `next typegen`.
- `serverExternalPackages: ["@electric-sql/pglite"]` plus `outputFileTracingIncludes` for the migration SQL, which is read at runtime in demo mode.
- Forms use server actions + `useActionState`, returning `ActionState` (`{ error } | { success }`), and `revalidatePath` after writes.

## Planned next step: migrate to the real website

The user wants to "init and migrate to the website" (deploy on Vercel) after the supervisor
demo. The direction proposed was to **match the user's other project,
`C:\Users\sayyi\Documents\kalibrasi-radiologi`** (Neon Postgres via Vercel Storage +
Auth.js v5 credentials with bcrypt) instead of Supabase. Confirm this choice with the user
before removing the Supabase code. The rough plan:

1. Production backend: replace PGlite with a Neon connection in the same `asUser` pattern (`set_config` + `set local role authenticated`), keeping the migration SQL and RPCs unchanged. The `auth.users`/`auth.uid()` stub from `lib/demo/db.ts` becomes part of the migration, or a real `users` table with `password_hash`.
2. Auth: Auth.js credentials provider, following kalibrasi-radiologi's `src/auth.ts` (including its handling of stale-cookie decryption errors). No public sign-up. Accounts are created by an admin or a seed script.
3. Remove `@supabase/*`, `lib/supabase/`, and the Supabase parts of the README and `.env.example`. Keep demo mode working for future presentations.
4. Apply the UI rules above: no kanban in production, keep the green "Tambah pasien" button.
5. Before going live with real data: agree on the confirmed workflow with the department, decide on account management (who creates users and changes roles), and check hospital policy for storing patient data on Vercel/Neon.

Open questions for the supervisor: exact fields per stage, which returns are allowed, whether
nurses need any action (e.g. weekly side-effect checks during treatment), and whether stages
like weekly review or end-of-treatment evaluation are missing.
