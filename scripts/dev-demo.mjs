// Server dev dalam mode demo (PGlite lokal + data dummy) walaupun .env.local berisi Supabase.
// Pakai: npm run dev:demo
// Next dijalankan langsung dengan node (tanpa npx/shell), supaya log Next tampil di terminal
// dan tanpa peringatan DEP0190 dari spawn dengan shell: true.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");

const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_DEMO: "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
