// Server dev dalam mode demo (PGlite lokal + data dummy) walaupun .env.local berisi Supabase.
// Pakai: npm run dev:demo
import { spawn } from "node:child_process";

const child = spawn("npx", ["next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_DEMO: "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
