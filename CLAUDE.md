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
- **Delineasi**: contouring targets and OARs. Total dose (Gy) and number of fractions are set earlier, at Poli.
- **Fraksi**: one treatment session. Dose per fraction = total dose / number of fractions.
- **DRR / CBCT / EPID / QA**: verification methods selectable at the Verifikasi stage
- **No. RM**: rekam medis (medical record) number, unique per patient
- **DPJP**: dokter penanggung jawab pelayanan, the one doctor responsible for a patient. Chosen by administrasi at registration, and it cannot be changed yet (the user plans that for later).
- **Mesin** / **pesawat**: treatment machine. Fixed list: Synergy, Precise, Cobalt (external beam, shown in Info Pesawat), and Brakiterapi.
- **Replanning**: sending a patient back from Penyinaran (e.g. the tumor grew) to redo planning, or at most a new CT Sim ("CT ulang"). Fractions already given stay counted.
- **H / H+14**: H is the CT Sim date. Verifikasi is H+14 calendar days (moved to the next working day if that is a weekend or holiday), and fraction 1 is given on the same day as verifikasi.
- **Kuota pesawat**: patients per machine **per working day**: Synergy 65, Precise 65, Cobalt 30, Brakiterapi none.
- **Kuota CT Sim**: at most 7 patients per CT Sim date, across all machines (including Brakiterapi).

## Accounts (invite-only, access levels)

Every account has two separate things:
- **Role kerja** (`profiles.role`, `Role` in TS): dokter, perawat, rtt, fismed, administrasi. Decides which stages it can ACC.
- **Hak akses** (`profiles.akses`, `akses_akun` enum, 0009; `AKSES` in `lib/workflow.ts`): **master > admin > nakes**. Decides who manages accounts. Nakes manage nothing. Admin approves/rejects sign-ups and changes role, deactivates, or reactivates **Nakes** accounts only, and cannot grant Admin/Master. Master manages every account, including granting and removing Admin/Master. Nobody can change their own status or access level (only their own role kerja), so nobody locks themselves out. The user set this hierarchy on 2026-10-10; that Admins cannot manage other Admins is my reading of it, so confirm before relying on it.

**Accounts are created only by Admin/Master** (decided by the user on 2026-10-10; there is no
self sign-up). On `/akun`, "Daftarkan akun" pre-registers an email with name, role kerja, and
access (one at a time or pasted from Excel: email | name | role | access, separated by Tab, `;`, or
`|`), through the `undang_akun` RPC into `undangan_akun` (0010). When that email first signs in with
Google, `terapkan_undangan` activates the profile with the invitation's data.
It runs from `handle_new_user` when the email is already confirmed at insert, and from the
`on_auth_user_confirmed` trigger when Supabase confirms it in a separate update (Google can do
either). Since 0011 (security audit A1, 2026-10-12) every path that activates a never-active account
(`terapkan_undangan`, the "langsung aktif" branch of `undang_akun`, and `atur_akun` from
baru/menunggu/ditolak) requires `akun_google_terverifikasi()`: confirmed email, a Google identity with
the same email, no other identity, and no password. The publishable key is public, so anyone can
`signUp` with a staff email and their own password; without this check such an account got activated
when the real owner clicked the confirmation link, or when an Admin registered it. `getSessionProfile`
calls `klaim_undangan()` for `baru` accounts as a safety net in case the trigger missed. `/akun` shows
"Bukan akun Google terverifikasi" (from `verifikasi_pendaftar()`) and hides Daftarkan for those rows.
`nonaktif` is only for accounts that were active and `ditolak` only for ones that never were, so
reactivating a `nonaktif` account (which may have set a password) skips the Google check. Admins can only invite and delete Nakes
invitations. Inviting an email that already has a non-active profile activates it at once.
"Allow new users to sign up" must stay on in Supabase, because an invited person's first Google
sign-in creates their auth user.

The login page offers only "Masuk dengan Google". Email + password login and "Atur password" on `/profil` were removed on 2026-10-12 (audit A5: every account is Google, so there is no password to guess), and the user is to disable the Email provider in Supabase so the API refuses password sign-ins and email sign-ups too. The
`profiles.status` (`status_akun` enum, 0008) gates everything:
- `baru`: signed in but not invited. `getCurrentUser()` sends them to `/daftar`, which only says the account is not registered. Admin/Master can register them from the "Belum terdaftar" group on `/akun` (pick a role, then Daftarkan, which calls `atur_akun`).
- `menunggu`: legacy from the self sign-up flow (0008). The app no longer creates it.
- `aktif`: approved. Only active accounts have a role in `current_user_role()` (so every RPC rejects the rest) and pass RLS on patients, stage_events, fractions, and attendance (`akun_aktif()`). Non-active accounts can read only their own profile.
- `ditolak` / `nonaktif`: blocked, shown on `/menunggu`.
- An active account with no role kerja (a Master converted from the old 0007 `master` role) is sent to `/daftar`, and `lengkapi_profil` lets it pick one while staying active.

Accounts are managed on `/akun` via `atur_akun(p_user, p_status, p_role, p_akses)`. `hakAtas()` in
`lib/workflow.ts` mirrors its rules to decide which controls each row shows. The `master` value of
the `user_role` enum (0007) is obsolete, like `ACC_PLAN`: Postgres cannot drop it, and every RPC
rejects it. The first Master is set with `npm run akun:master -- email` (direct SQL through
`SUPABASE_DB_URL`, sets `akses` only and keeps the role kerja) after that person signs up once.

Roles and access are never read from `user_metadata` (users can set it themselves at sign-up).
`handle_new_user()` makes an account active immediately only when `app_metadata.role` is set
(optionally with `app_metadata.akses`), which needs the service role (`db:seed`, demo mode).
`listDoctors()` (DPJP choices) returns active doctors only.

Google sign-in sends `redirectTo = <request origin>/auth/callback` (`siteOrigin()` in
`app/login/actions.ts`). If that URL is not in Supabase's Redirect URLs allowlist, Supabase
silently falls back to the **Site URL**. On 2026-10-11 the Site URL was still `http://localhost:3000`,
so Google login from a phone landed on localhost (the auth logs' `referer` shows the redirect
Supabase actually used). The fix is in the Supabase dashboard: set Site URL to the Vercel domain and
allow the exact `https://<domain>/auth/callback` (narrowed from `/**` on 2026-10-11, see KEAMANAN.md #4). As a safety net, `lib/supabase/proxy.ts` forwards any `?code=` that
lands outside `/auth` to `/auth/callback`.

`lib/auth.ts`: `getSessionProfile()` returns the logged-in account whatever its status (used by
`/daftar` and `/menunggu`, outside the `(app)` layout). `getCurrentUser()` returns active users
with a role kerja (`CurrentUser`: role + akses) and redirects the rest. Google sign-in
comes back to `app/auth/callback/route.ts` (code exchange), which is a
public path in `lib/supabase/proxy.ts`.

## Workflow (the core rule set)

| # | Stage key | Who can ACC / return | Can be returned to |
|---|---|---|---|
| 1 | `PENDAFTARAN` | administrasi | – |
| 2 | `POLI` | DPJP **or any perawat** (same form fields: dose, fraction count, planned machine, CT Sim date) | – |
| 3 | `CT_SIM` | rtt | – |
| 4 | `DELINEASI` | DPJP | CT_SIM |
| 5 | `PLANNING` | fismed (the plan ACC, may change the machine only to one with quota left) | any earlier, down to CT_SIM |
| 6 | `VERIFIKASI` | rtt | any earlier, down to CT_SIM |
| 7 | `PENYINARAN` | rtt, one `record_fraction` call per fraction, no manual ACC | any earlier, down to CT_SIM (replanning) |
| 8 | `SELESAI` | automatic when fraction N of N is recorded | – |

The doctor's ACC Planning stage was removed: fismed and the doctor already discuss the plan
offline, so the fismed ACC at `PLANNING` goes straight to `VERIFIKASI`. Postgres cannot drop
an enum value, so `ACC_PLAN` still exists in the `stage` enum, but `next_stage()` skips it,
`can_return()` rejects it, and it is absent from `lib/workflow.ts`. Old `stage_events` rows can
still mention it (the timeline has a label fallback).

Kembalikan goes straight to **any earlier stage, down to CT_SIM** ("CT ulang"), so nobody has
to step back one stage at a time. The user confirmed a patient is never sent back to Poli: once
past Poli, Poli is done. So POLI and PENDAFTARAN are never return targets, and neither POLI nor
CT_SIM has Kembalikan (`can_return()` in 0004 enforces this). Returning from `PENYINARAN` keeps
the recorded fractions.

**Poli is valid for one day** (`poli_hangus()` in SQL, `poliHangus()` in `lib/workflow.ts`).
A Poli visit counts only on the WIB date the patient entered POLI (`stage_entered_at`). The
schedule must be fixed at the visit, so an un-ACC'd visit is **hangus** the next day:
- `advance_stage` rejects it, and `canActOn()` returns false.
- The patient page shows `components/poli-expired.tsx`.
- The administrasi dashboard lists it under "Poli hangus" (that card replaces administrasi's always-empty Tugas saya).
- Administrasi re-registers the patient when they come back (`daftar_ulang_poli` RPC: resets `stage_entered_at`, logs a `create` event "Didaftarkan ulang ke Poli").

Doctor stages accept only the patient's DPJP (`patients.dpjp_id`). A patient with no DPJP
(legacy rows) can be handled by any doctor. `perawat` acts only at `POLI` (ACC), because a
nurse may ACC when the doctor forgets (agreed between them offline). Everywhere else perawat is
view-only. Registering a patient (`create_patient`, DPJP required) inserts it directly at `POLI`.

**Scheduling by machine quota** (the reason for the date-based design: CT Sim used to be
booked without regard for treatment capacity, so patients piled up at Penyinaran). At the POLI
ACC, the doctor or nurse picks a planned machine and a CT Sim date (H). That fixes
`patients.tgl_ct_sim` and `patients.tgl_verifikasi` (= H+14, see glossary). A patient occupies
one slot per working day on their machine, from `tgl_verifikasi` for (total − given) fractions.
A CT Sim date can be picked only if **every** one of those days still has quota, **and** the CT
Simulator itself has fewer than 7 patients booked that day (`KUOTA_CT_SIM`, one CT Simulator for
all machines; counts patients past POLI with that `tgl_ct_sim`, via `jumlah_ct_sim()`). This is
absolute: `advance_stage` re-checks both (CT Sim count behind a `kuota:ct_sim` advisory lock,
then `kuota_penuh_pada` behind a per-machine lock, always in that order), so a stale UI cannot
overbook. A CT ulang return does not book a new CT Sim slot. Fismed can change the machine at PLANNING only to one with quota
on the patient's days. Recording fractions is never blocked by quota.
Occupancy is defined once, in SQL `jadwal_sinar(from, to, exclude)`:
- Fractions already given count on their real dates.
- Patients in CT_SIM–VERIFIKASI are projected from `tgl_verifikasi`, or from today if that date has passed.
- Patients in PENYINARAN are projected from today, with the same rule as `buildSchedule`.
- Anyone who already received a fraction today (also when returned for replanning the same day) is projected from the next working day (0005), so they are never counted twice on one day.
- Patients at POLI hold no slots.
- Returning (to CT_SIM at most) keeps the booking. Projection restarts from today once `tgl_verifikasi` has passed.

`hunian_pesawat()` sums `jadwal_sinar()` per machine and day. The UI side (`lib/booking.ts`,
`components/ct-sim-picker.tsx`) recomputes availability in the browser from
`hunianPesawat()` while the form is filled in. The UI is only a preview, and SQL decides.

**Due dates** (`dueDate()` in `lib/workflow.ts`, shown **only** in the dashboard's "Tugas saya"):

| Stage | Due date |
|---|---|
| CT_SIM | `tgl_ct_sim` |
| DELINEASI, PLANNING, VERIFIKASI | `tgl_verifikasi` |
| (any of the above, after a return) | never before the day the patient entered the stage, so a replanning/CT-ulang return is due the day it was returned, not on the old date |
| PENYINARAN | today, or the next working day once today's fraction is recorded |
| POLI | none ("Belum dijadwalkan") |

Besides Tugas saya, the due date also appears next to the stage name on the patient page for
DELINEASI and PLANNING (`DueBadge`, `components/due-badge.tsx`). Tugas saya is numbered by priority: overdue first, then nearest due date. POLI tasks come last
and show "Menunggu N hari" instead of a due date. **Doctors** get the POLI queue split off into
its own section, **"Poli hari ini"** (above Tugas saya, oldest waiting first), so their Tugas saya
holds only Delineasi. Perawat (POLI only) keeps a single Tugas saya list.

**Attendance during treatment** (`attendance` table, `set_attendance` RPC): each day
administrasi or RTT marks a `PENYINARAN` patient hadir / tidak hadir. Rows are append-only,
and the latest row for that patient and date is the current status, so changes stay visible
("Diubah oleh ... (RTT)"). Rules enforced in SQL:
- `record_fraction` requires today's status to be hadir. The fraction date is always today (WIB, `today_wib()`), and the machine defaults to `patients.mesin` and can be overridden per fraction.
- More than one fraction per day is allowed (hyperfractionation).
- Both roles can flip the status either way, except to tidak hadir once a fraction was recorded today.

**Fraction schedule** ("Catatan & jadwal fraksi" on the patient page, `lib/schedule.ts` +
`components/fraction-schedule.tsx`): computed on every render, nothing is stored. It appears
once fraction 1 is recorded and lists, in date order, the given fractions ("Sudah disinar"),
days marked tidak hadir, and the remaining fractions projected one per working day from today
("Hari ini" / "Belum disinar"). Today is used only if it is a working day, not marked tidak
hadir, and has no fraction yet. Because the projection restarts from today, every absence
pushes the rest back. Working days skip Saturday, Sunday, and every date in `HARI_LIBUR`
(`lib/holidays.ts`: libur nasional **and** cuti bersama from the SKB 3 Menteri, 2026 and 2027
only). The same dates live in SQL as the `public.hari_libur` table (seeded in 0004), which the
quota check uses. **Add the next year's dates when its SKB is published, in both places** (a new
migration inserting into `hari_libur`, plus `HARI_LIBUR`). Otherwise later schedules will treat
those holidays as working days. During replanning or after SELESAI the table shows only what
happened, with no projection.

**These rules live in two places that must stay in sync:**
- `lib/workflow.ts`: labels, `owner` + `alsoBy` per stage (`stageActors()`, `canActOn()` with the DPJP check), form fields per stage (`FieldDef[]`), return targets, `MESIN`, `KUOTA_PESAWAT`, `JEDA_CT_VERIFIKASI`, `dueDate()`. Drives the whole UI. Forms are generated from field definitions, so there is no per-stage form component (the `ctsim` field type renders the CT Sim date picker). `lib/booking.ts` and `lib/holidays.ts` mirror the SQL scheduling rules for display.
- `supabase/migrations/`, applied in order, later files replacing functions from earlier ones. `0001_init.sql`: schema, RLS, first versions of the RPCs. `0002_dpjp_mesin_absensi.sql`: DPJP, `can_act()` (DPJP + perawat rule), `is_valid_mesin()`, `today_wib()`, the `attendance` table, `set_attendance`, and new signatures for `create_patient`/`record_fraction`. `0003_alur_ringkas.sql`: current `stage_owner()`, `next_stage()` (enum order, skipping `ACC_PLAN`), `can_return()` (any earlier stage, by enum order). `0004_jadwal_kuota.sql`: `hari_libur`, `is_working_day()`, `working_days()`, `tgl_verifikasi_dari()`, `kuota_pesawat()`, `patients.tgl_ct_sim`/`tgl_verifikasi`, `jadwal_sinar()`, `hunian_pesawat()`, `kuota_penuh_pada()`, the current `can_return()` (down to CT_SIM), `poli_hangus()`, `daftar_ulang_poli`, and the current `advance_stage`. `0005_jadwal_fraksi_hari_ini.sql`: current `jadwal_sinar()` (fixes the same-day replanning double count). `0006_kuota_ct_sim.sql`: `kuota_ct_sim()`, `jumlah_ct_sim()`, and the current `advance_stage` (adds the CT Sim quota check at POLI). `0007_role_master.sql`: the `master` role value (obsolete since 0009). `0008_akun_mandiri.sql`: `status_akun`, `profiles.email`/`status`, the current `current_user_role()`, `akun_aktif()`, the RLS policies. `0009_hak_akses.sql`: `akses_akun`, `profiles.akses`, `akses_saya()`, and the current `lengkapi_profil` and `atur_akun`. `0010_undangan_akun.sql`: `undangan_akun`, `terapkan_undangan`, `undang_akun`, `hapus_undangan`, the `on_auth_user_confirmed` trigger, and the current `handle_new_user()`. `0011_undangan_google.sql`: `akun_google_terverifikasi()`, `klaim_undangan()`, `verifikasi_pendaftar()`, and the current `terapkan_undangan`, `undang_akun`, and `atur_akun` (see Accounts). `0012_batas_rentang_jadwal.sql`: `batas_jadwal_hari()` and the current `jadwal_sinar()` (same query as 0005, wrapped in plpgsql that rejects a `p_to` more than 730 days after today, so a user cannot make it build a calendar to the year 9999; the app asks for today + 200 days at most), and revokes the internal helpers (`is_working_day`, `next_working_day_from`, `working_days`, `tgl_verifikasi_dari`, `kuota_pesawat`, `kuota_ct_sim`, `kuota_penuh_pada`, `poli_hangus`) from users. They are only called inside `security definer` RPCs, which run as the owner. A new helper that an invoker function like `jadwal_sinar` calls needs `grant execute ... to authenticated`. **This is the actual enforcement.** Hiding a button in the UI is cosmetic.
  To read the live version of a function, find the latest file that defines it (`grep -n "function public.<name>" supabase/migrations/*.sql`, last hit wins). As of 0012: `return_stage`, `create_patient`, `record_fraction`, and `set_attendance` are last defined in 0002, `stage_owner` and `next_stage` in 0003, `can_return` in 0004, `advance_stage` in 0006, `current_user_role` in 0008, `lengkapi_profil` in 0009, `handle_new_user` in 0010, `terapkan_undangan`, `undang_akun`, and `atur_akun` in 0011, and `jadwal_sinar` in 0012.
  Migrations must also run in demo mode, so read **Security fixes stay out of demo mode** under Two runtime modes before writing SQL that touches Supabase-only objects.

Stage-specific SQL logic in `advance_stage`: `PENDAFTARAN` updates identity columns from the
payload. `POLI` writes `dosis_total_gy`/`total_fraksi` (required, > 0, not below fractions
already given), plus `mesin`, `tgl_ct_sim`, and `tgl_verifikasi`. The CT Sim date is required,
must be a working day ≥ today, and must pass the quota check. `PLANNING` writes `patients.mesin`
(required, must pass `is_valid_mesin`, quota-checked when it changes).
Every stage's form payload is merged into `patients.data[STAGE_KEY]` (jsonb) with `_at`/`_by`,
and every transition writes a row to `stage_events` (audit trail shown as "Riwayat").

All tables have RLS: authenticated users may only SELECT, and all writes go through the RPCs.
Adding a stage means adding it to the `stage` enum **in the right position**, then to
`stage_owner` (and `can_act` if a second role may act), checking the ranges in `can_return`,
then adding it to `STAGE_KEYS`/`STAGES` (including every later stage's `returnTargets`) in
`lib/workflow.ts`. Adding a machine means editing both `is_valid_mesin()` and `MESIN` (plus
`MESIN_EKSTERNAL` if it is external beam), and `kuota_pesawat()` + `KUOTA_PESAWAT` if it has a quota.

Put SQL changes in a **new numbered migration file**:
- `npm run db:setup` skips any file name already recorded in `app_private.migrations`, so editing an applied file does nothing on an existing Supabase database. Use `create or replace` for functions, or `drop` first when the signature changes (as 0002 does for `create_patient` and `record_fraction`), and repeat the `revoke`/`grant` lines for new signatures.
- Demo mode stores a hash of all migration files in `app_private.demo_meta`. When the hash changes, the demo data is wiped and re-created from the migrations and seed. In development, `getDemoDb()` re-checks the hash on every request, so a running dev server picks up SQL edits without a restart. Changes to `lib/demo-seed.ts` alone do not trigger this: use "Reset data demo" on `/login`.

## Commands

```bash
npm run dev          # dev server, Supabase mode (demo mode if .env.local has no Supabase URL)
npm run dev:demo     # dev server forced into demo mode (PGlite + dummy data), even with .env.local
npm run build        # production build
npm run lint         # eslint
npm run typecheck    # next typegen && tsc --noEmit (PageProps/LayoutProps types come from typegen)

npm run db:setup     # apply supabase/migrations/*.sql to SUPABASE_DB_URL (tracked in app_private.migrations)
npm run db:seed      # create 6 demo accounts + ~350 dummy patients in Supabase (needs service role key; not for the real database)
npm run akun:master -- email  # give a signed-up account Master access (the first Master), via SUPABASE_DB_URL
```

The `db:*` scripts read `.env.local` (template in `.env.example`). `db:setup` uses
`SUPABASE_DB_URL`, falling back to `POSTGRES_URL_NON_POOLING`. `db:seed` needs
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DEMO_PASSWORD` (min. 8 chars).
None of them are needed for demo mode.

There is no test suite, so `npm run lint` and `npm run typecheck` are the checks after a TS change. The SQL rules were verified with an ad-hoc PGlite script (run with
`node --input-type=module` from the project root so `@electric-sql/pglite` resolves) that
loads the Supabase stub from `lib/demo/db.ts`, applies every migration, and runs each forbidden
action: wrong role ACC, non-DPJP doctor, perawat outside POLI, missing/invalid machine, fraction
without attendance, tidak hadir after a fraction, return to PENDAFTARAN/ACC_PLAN/a later stage,
fraction count below fractions given, direct INSERT/UPDATE, return without reason, fraction
beyond total, and so on. For 0004 it also covered POLI without machine/date, CT Sim dates in the
past, on weekends, or on holidays, a full day (fill Cobalt to 30), a full day in the middle of a
course, switching to a full machine at PLANNING, slot release on return to POLI, Brakiterapi
without quota, `hari_libur` matching `HARI_LIBUR`, and `jadwal_sinar` matching `buildSchedule`
for every seeded PENYINARAN patient. For 0005: record a fraction then return to PLANNING on the
same day (2 rows that day under 0004, 1 under 0005), and every other patient's `jadwal_sinar`
rows unchanged. For 0006: POLI patients hold no CT slot, ACC up to 7 on one date (Brakiterapi, to
isolate the CT check) then the 8th is rejected and stays at POLI, `exclude` skips the patient
itself, `ctSimOptions` agrees with `jumlah_ct_sim`, and no seeded CT Sim date exceeds 7.
For 0008: a Google sign-up that puts `role: dokter` in its own `user_metadata` stays `baru` with no role and cannot read patients, events, fractions, attendance, `jadwal_sinar`, or call any RPC until a Master approves it. It cannot pick `master` or approve itself, a non-Master cannot approve, deactivation removes access again, and accounts created before 0008 stay active. For 0009: an old `master`-role account becomes akses master with no role kerja and can pick one while staying active; Admin approves and edits Nakes but cannot grant Admin, touch Admin or Master accounts, or change its own status or access; Master can promote, demote, and edit other Masters but not itself; a demoted Admin loses account management at once. For 0010: Nakes cannot invite; Admin cannot invite as Admin or change/delete an Admin invitation; bad email/name/role is reported per row; an unconfirmed sign-up with an invited email stays `baru` and leaves the invitation unused; confirmation (separate update, or confirmed at insert) activates with the invitation's name/role/access; uninvited accounts read nothing; inviting an already-signed-in `baru` account activates it; active accounts are not changed by invitations; deleted invitations no longer apply. For 0011 the script ran in two environments. First a Supabase-like stub (the demo stub plus `auth.identities` and `encrypted_password`, with users created in Supabase's real Google order: insert unconfirmed, attach the Google identity, then confirm, as seen on the live project): an invited password sign-up stays `baru` after confirmation, and also after a Google identity is linked to it; `undang_akun` and `atur_akun` refuse to activate it; a real Google account activates via the trigger, or via `klaim_undangan` when confirmed before the identity existed; `verifikasi_pendaftar` is empty for Nakes; baru→nonaktif and aktif→ditolak are refused; a `nonaktif` account with a password can be reactivated; users cannot execute `akun_google_terverifikasi`/`terapkan_undangan`. Second the plain demo stub: registering and inviting the `DEMO_PENDAFTAR`-style account works as before. For 0012 (`npx tsx` script, the full demo seed loaded into one DB with migrations up to 0011 and one with 0012): `jadwal_sinar` and `hunian_pesawat` return identical rows for today, past ranges, and up to today + 730, with and without `exclude`; today + 731, the year 9999, and NULL are rejected; `jumlah_ct_sim` still accepts any range (it is cheap); users get `permission denied` on every revoked helper; and the Poli ACC (CT Sim and Cobalt quota checks), the Planning machine change, and `daftar_ulang_poli` still work. Note `x in (...)` is NULL, not false, when `x` is NULL, which once kept `not v_valid` from ever being true; use `coalesce`. Patients created with `create_patient` get the real `now()`, so set their `stage_entered_at` to
the mocked day or POLI counts as hangus. Most bugs here only show on a working day, so when today is a weekend, override
`today_wib()` after the migrations and pass the same date as `now` to `buildDemoPatients(ids, now)`.
A script that imports TS from the project and lives
outside it runs with `npx tsx file.mts`, using `file:///` URLs for project imports (including
`node_modules/@electric-sql/pglite/dist/index.js`). To test a data migration (like 0003 moving `ACC_PLAN` patients), apply
the earlier files, insert the old-state rows, then apply the new file. If you change the SQL,
re-verify the same way.

Run only **one** dev server at a time. Demo mode's PGlite holds the data directory open, and two
processes on it will corrupt it. `.claude/launch.json` defines two configurations on port 3000 for
the preview tools: `dev` (Supabase mode when `.env.local` is filled in) and `dev-demo`. Stop one
before starting the other, and reuse a running one instead of starting a second `next dev`.

## Two runtime modes

`lib/mode.ts`: `IS_DEMO = NEXT_PUBLIC_DEMO === "1" || !NEXT_PUBLIC_SUPABASE_URL` (inlined when the
dev server or build starts, so switching mode means restarting). `.env.local` now holds the user's
real Supabase project, so `npm run dev` is Supabase mode and `npm run dev:demo`
(`scripts/dev-demo.mjs`, sets `NEXT_PUBLIC_DEMO=1`) is demo mode. Never set `NEXT_PUBLIC_DEMO` on
Vercel: it would turn the public site into the login-free demo.

**Demo mode** (`npm run dev:demo`, used for presentations):
- `lib/demo/db.ts` runs PGlite (Postgres in WASM) inside the Next.js process. On first open it creates a minimal Supabase stub (`anon`/`authenticated`/`service_role` roles, `auth.users`, `auth.uid()` reading `request.jwt.claim.sub`), runs the **same** migration files, and seeds from `lib/demo-seed.ts`.
- Queries run through `asUser(uid, fn)`: a transaction with `set_config('request.jwt.claim.sub', uid)` + `set local role authenticated`, so RLS and the RPC role checks behave exactly as in production.
- Data dir: `node_modules/.cache/demo-db`. Keep it out of the project root, or Turbopack watches it and reloads endlessly. On Vercel it falls back to `memory://`, which is not suitable for shared use: each instance holds its own copy and resets on cold start.
- `lib/demo-seed.ts` places past fractions on working days only, counted back from yesterday, so the projected schedule starts cleanly today. All dates follow the H / H+14 rules.
- Besides the ~18 named patients (6 at POLI for the doctors/nurse to book, plus late examples like Teguh at CT Sim and Hendra at Verifikasi, Wayan returned from Penyinaran to PLANNING today for replanning, and Nurhayati, whose Poli visit from yesterday is hangus; every other POLI patient is registered today), `fillerSpecs()` generates ~330 filler patients with a fixed-seed PRNG. They fill occupancy up to the quota on the working-day ranges in `FULL` (today through about 4 weeks, with a gap so short courses fit earlier than long ones). Day 0 is filled with PENYINARAN patients, and later days with patients whose verifikasi falls on that day (stage derived from their CT Sim date). No CT Sim date gets more than `KUOTA_CT_SIM` patients (past dates included), so days whose CT Sim date is full are filled later and the machines sit at roughly 80–100% instead of exactly full. Days are filled for all three machines in turn so the CT Sim slots are shared fairly. Changing `FULL`, `COURSES`, or the named patients changes the whole picture, so check occupancy afterwards (Info Pesawat, or `hunian_pesawat()` in PGlite).
- Seeding inserts multi-row batches (`insertMany` in `lib/demo/db.ts`, 500-row chunks in `scripts/seed.ts`), because the seed has thousands of fraction/attendance rows.
- "Reset data demo" asks for a browser `confirm()`. An automated browser dismisses it, so the reset silently does nothing. Ask the user to click it.
- No login: the `demo_uid` cookie holds one of the fixed `DEMO_USERS` ids (two doctors, `dokter` and `dokter2`, so the DPJP split is visible, and one account for each other role). dr. Andi (`dokter`) also has Master access and Dewi Lestari (`administrasi`) Admin access. `DEMO_UNDANGAN` adds two unused invitations and `DEMO_PENDAFTAR` one Google account that signed in without an invitation (not selectable as a demo account). There is no Google login, `/daftar`, or `/menunggu` flow in demo mode. Seed code addresses accounts by `DemoKey`, not by role. You pick an account on `/login`, and a "Lihat sebagai" dropdown in the header switches account while staying on the same page. "Reset data demo" is on the `/login` role-picker page, which `proxy.ts` only shows when no account is selected.
- `getDemoDb()` caches the open promise on `globalThis`, and a failed open clears it. If you ever see the same init error repeating, restart the dev server.

**Security fixes stay out of demo mode** (agreed with the user on 2026-10-12). The demo is for
explaining the workflow to the supervisor, and security hardening is not part of that story.
- Do not add security features or security UI to the demo, and do not edit `lib/demo/db.ts` or `lib/demo-seed.ts` for security work. The user will say when a new feature should appear in the demo (for example, if they want to show the supervisor the "Bukan akun Google terverifikasi" label).
- When asked whether a security fix is in the demo, the answer is normally no. Explain what the demo shows instead.
- Demo runs the **same migrations**, so SQL that needs Supabase-only objects must tolerate their absence and keep the demo's behavior unchanged. The demo stub has no `auth.identities` or `encrypted_password`, so `akun_google_terverifikasi()` (0011) is plpgsql and returns true when `auth.identities` does not exist (always present in Supabase).
- Shared pages change in both modes. The only visible demo change so far: `/profil` lost its password box (the demo branch only said demo has no login), and the menu label is "Profil".
- Status per fix (audit 2026-10-12):

  | Fix | Website (Supabase) | Demo |
  |---|---|---|
  | A1, invitations only for verified Google accounts (0011) | enforced | check skipped, no label, Fitri Amelia can still be registered |
  | A5, Google-only login (password form and "Atur password" removed) | enforced | not applicable: the demo has no login, only the role picker |
  | A7, schedule range at most 730 days ahead, internal helpers revoked (0012) | enforced | also active (same SQL), not noticeable in normal use |
  | Security headers / CSP (`next.config.ts`) | enforced | also active (same config) |
  | `IS_DEMO` off when `VERCEL_ENV=production` (`lib/mode.ts`) | guards production | local demo unaffected |

**Supabase mode** (the production path, see Deployment): `@supabase/ssr` cookie sessions
refreshed in `proxy.ts` → `lib/supabase/proxy.ts`, Google login only, no sign-up
(`app/login/actions.ts`), roles and approval status in `profiles` (see Accounts).

Every data access goes through a mode-agnostic layer, so pages and actions never touch a
backend directly:
- `lib/auth.ts`: `getSessionProfile()` and `getCurrentUser()` (React `cache`, see Accounts)
- `lib/data.ts`: `listPatients` (optional `dpjp` filter), `getPatient`, `getPatientStage`, `fractionCounts` (optional `tanggal`, e.g. today's fractions), `listDoctors`, `listAccounts`, `attendanceToday`, `attendanceDays`, `jadwalSinar`, `hunianPesawat`, `jumlahCtSim` (these three call the SQL functions, via `supabase.rpc` in Supabase mode). Supabase silently caps responses at 1000 rows, so list queries go through `fetchAll` (paged with `.range()`, needs a stable order down to a unique column). Demo queries use `selectJson` (`row_to_json`) so dates and numbers come back in the same JSON shape as PostgREST, including the embedded `dpjp: { full_name }` (`profiles!patients_dpjp_id_fkey` in Supabase, a subquery in demo).
- `lib/rpc.ts`: `rpc(name, args)` calls the Postgres functions with named arguments. Raised exception messages are user-facing Indonesian text and are shown as-is in forms.

## UI rules decided with the user

- **Phone layout** (the user asked for it to work well on phones, 2026-10-11). The page must never scroll sideways at 375px. Below `md`, the header shows only the logo and a ☰ button (`components/mobile-menu.tsx`, which holds the nav links, profile, role badge or demo switcher, and Keluar). Wide tables get a card/list variant on narrow screens instead of horizontal scrolling: the patient list below `lg`, the fraction schedule and the CT Sim picker (per-week, 2 columns) below `sm`, and `StageStepper` becomes "Tahap n dari 8" with a segmented bar below `md`. `.input` uses `text-base` below `sm` so iOS Safari does not zoom on focus. Grid children holding tables need `min-w-0`, or `overflow-x-auto` inside them stops working.

- The **"Alur pasien" kanban board** on the dashboard (`StageBoard` in `app/(app)/page.tsx`) is **demo/presentation only**. It renders only when `IS_DEMO` and must not appear in the production website.
- The primary action is a **"+ Pasien baru" button** (`components/add-patient-button.tsx`, top-right of the dashboard and the patient list, administrasi only) instead of relying on the header nav link, because the user found people miss the link at the top. Keep it in production. Style: the standard teal `btn btn-primary` at normal size. The user tried a larger emerald "Tambah pasien" variant and preferred this one.
- Patient list (`components/patient-table.tsx`): the stage column is labeled **"Status"**, and so is the list filter. The **Fraksi** column only shows a value while the patient is in `PENYINARAN` (to avoid distraction) and renders `done/total` with a pastel light-blue (`bg-sky-300`) progress bar under it. Every other status shows "-".
- Registration form fields: No. RM, nama, tanggal lahir, jenis kelamin (L/P), no HP, diagnosis rujukan, and a required **Dokter DPJP** select.
- `/profil` (the user's name in the header, "Profil" in the ☰ menu on phones): own profile, read-only. There is no password setting (Google only, see Accounts). Name, role, and access are changed only by Admin/Master.
- `/privasi`: public privacy policy (no login, allowed in both `proxy.ts` paths), linked from the login page and used as the privacy policy URL on the Google consent screen. Rewritten on 2026-10-12 after research, in 13 numbered sections with a table of contents, following UU 27/2022 (PDP: data kesehatan is specific data under Pasal 4(2), bases in Pasal 20(2), subject rights in Pasal 5–13, breach notice within 3×24 hours in Pasal 46, cross-border transfer in Pasal 56), UU 17/2023, Permenkes 24/2022 (confidentiality in Pasal 32, retention of at least 25 years in Pasal 39(1)), and Google's API Services User Data Policy (Limited Use statement). **It must match what the app actually does**: when data collected, providers, login method, cookies, or who can see what changes, update the page too. It honestly discloses that every active account can read all radiotherapy patients (audit A2, accepted) and that data is stored in Singapore. Still a draft (`DRAF` shows an amber notice): `PENGENDALI` (official controller name), the hospital's DPO contact, and the legal basis wording need the hospital's legal/PDP review. The contact email is `KONTAK`.
- Login page (Supabase mode): only the "Masuk dengan Google" button. Accounts are created by Admin/Master (see Accounts). `?error=` codes from the callback are shown as Indonesian messages. Admin and Master get an "Akun" nav tab, and their usual role-kerja dashboard gets an extra "Akun belum terdaftar" card while accounts that signed in without an invitation (`baru`, or legacy `menunggu`) are waiting.
- Doctors get two nav tabs: **"Daftar Pasien"** (`/pasien/saya`, only their DPJP patients) and **"Daftar Pasien Penuh"** (`/pasien`, everyone). Other roles have one "Daftar Pasien" tab. Both pages render `components/patient-list.tsx`. A doctor's "Tugas saya" on the dashboard only lists their own patients.
- `/penyinaran` lists `PENYINARAN` patients grouped by machine, with today's attendance. The nav tab is labeled "Absen Penyinaran" for administrasi and "Penyinaran Hari Ini" for RTT, and RTT can record fractions inline there for patients marked hadir.
- **"Info Pesawat"** tab (`/pesawat`, all roles, right after the patient-list tab(s)) is **per day**. For each external machine (Synergy, Precise, Cobalt, not Brakiterapi) it shows occupancy on the selected date (`?tanggal=`, `DateNav`) against the daily quota (65 / 65 / 30). Below that is a 20-working-day bar strip (sky, amber at ≥ 90%, rose when full; click a day to select it) and that day's patients ("Fx k/n" or "Verifikasi & mulai"). The quota is a hard limit only when booking at POLI (and changing the machine at PLANNING). Delays can still push a day over, and that shows in rose. The Planning machine dropdown labels each machine "tersedia" / "penuh N hari" for this patient's remaining days.
- **Dashboard is date-oriented** for all roles: for doctors, "Poli hari ini" then "Tugas saya" (Delineasi), for others "Tugas saya", stays at the top (numbered by due-date priority, see Due dates). Under it is an **Agenda** with a `DateNav` (`?tanggal=`, ‹ › by working day) listing CT Sim (count shown as n/7, rose when full), Verifikasi & mulai penyinaran (also the Delineasi + Planning due date), Selesai penyinaran, and per-machine occupancy against quota for that date. Due dates appear **only** in Tugas saya.
- Patient list has a **"Verifikasi"** column (all list tabs, including the doctor's two). It shows the planned `tgl_verifikasi` (or the actual verification date once done), "terlambat" in rose when it has passed, and "-" before the POLI ACC. The user asked for this to be the only date in the list.
- Poli form: "Rencana pesawat" select + the `ctsim` picker (40 working days in a Mon–Fri grid). Full dates are struck through and disabled ("CT Sim penuh" when only the CT Simulator is full, "Penuh" otherwise, the reason in the tooltip), and free ones show "Verif dd MMM", the machine's smallest remaining quota ("Synergy sisa n"), and "CT sisa n". The ACC confirmation dialog also lists Verifikasi & fraksi 1 and the expected last fraction.
- Kembalikan uses `components/return-form.tsx` (target select + required reason), both inside `StageActionPanel` and, for RTT during `PENYINARAN`, in a "Kembalikan untuk replanning" section.
- Every ACC opens a confirmation dialog (`StageActionPanel`) that says "Perhatikan baik-baik kembali datanya sebelum ACC dan melanjutkan ke proses berikutnya." and lists the values being submitted.

## Next.js 16 specifics used here

- Middleware is `proxy.ts` (Node runtime). It only does optimistic redirects. Real auth checks happen in `getCurrentUser()`.
- `cacheComponents` is deliberately **off** (`next.config.ts`). Every page reads the session per request, and with it on, any `cookies()` read outside `<Suspense>` is a build error.
- `params`/`searchParams` are Promises, and `PageProps<"/route">`/`LayoutProps` are global types generated by `next typegen`.
- `serverExternalPackages: ["@electric-sql/pglite"]` plus `outputFileTracingIncludes` for the migration SQL, which is read at runtime in demo mode.
- Tailwind CSS 4 is wired through the `@tailwindcss/turbopack` loader in `next.config.ts` (`turbopack.rules`), not PostCSS.
- Forms use server actions + `useActionState`, returning `ActionState` (`{ error } | { success }`), and `revalidatePath` after writes.

## Deployment: Supabase + Vercel

On 2026-10-10 the user chose to go live on **Supabase + Vercel**, the existing production path
(not the Neon + Auth.js plan once proposed to match `kalibrasi-radiologi`). The step-by-step
setup (migrations, Vercel env vars, Supabase URL config, Google OAuth client, first Master via
`npm run akun:master`) is in the README. Keep demo mode working for future presentations, and
keep the UI rules above (no kanban in production, the teal "+ Pasien baru" button).

Before going live with real data: agree on the confirmed workflow with the department, and check
hospital policy for storing patient data on Vercel/Supabase.

Open questions for the supervisor: exact fields per stage, which returns are allowed, whether
nurses need more actions (e.g. weekly side-effect checks during treatment), whether stages
like weekly review or end-of-treatment evaluation are missing, and how a patient's DPJP can be
transferred to another doctor (deliberately not possible yet).
