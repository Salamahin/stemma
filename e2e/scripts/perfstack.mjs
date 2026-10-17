// Builds the frontend against a fake backend host (the perf tests answer it with
// page.route) and serves it on :4180. No Docker, DynamoDB or Python needed.
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../frontend");
const build = spawnSync("npm", ["run", "build"], {
  cwd: frontendDir,
  stdio: "inherit",
  env: { ...process.env, E2E_AUTO_LOGIN: "1", GOOGLE_CLIENT_ID: "bench", STEMMA_BACKEND_URL: "http://bench.invalid" },
});
if (build.status !== 0) process.exit(build.status ?? 1);
const server = spawn("npx", ["sirv", "public", "--port", "4180", "--host", "127.0.0.1", "--single", "--no-clear"], {
  cwd: frontendDir,
  stdio: "inherit",
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { server.kill(sig); process.exit(0); });
server.on("exit", (code) => process.exit(code ?? 0));
