import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const e2eDir = resolve(__dirname, "..");
const repoRoot = resolve(e2eDir, "..");
const backendDir = resolve(repoRoot, "backend");
const frontendDir = resolve(repoRoot, "frontend");

const postgresContainer = "stemma-e2e-postgres";
const postgresPassword = "mysecretpassword";
const postgresDb = "stemma";
const postgresUser = "postgres";

let backendProc = null;
let frontendProc = null;

function runOrThrow(cmd, args, options = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed with exit code ${res.status}`);
  }
}

function killTree(proc) {
  if (!proc || proc.exitCode !== null) return;
  proc.kill("SIGTERM");
}

async function waitForPort(host, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise((resolvePromise) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      socket.once("connect", () => {
        socket.destroy();
        resolvePromise(true);
      });
      socket.once("error", () => resolvePromise(false));
      socket.once("timeout", () => {
        socket.destroy();
        resolvePromise(false);
      });
      socket.connect(port, host);
    });
    if (ok) return;
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status >= 400) return;
    } catch {
      // keep waiting
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function cleanup() {
  killTree(frontendProc);
  killTree(backendProc);
  spawnSync("docker", ["rm", "-f", postgresContainer], { stdio: "inherit" });
}

async function main() {
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });
  process.on("exit", cleanup);

  // 1) Start PostgreSQL in Docker
  spawnSync("docker", ["rm", "-f", postgresContainer], { stdio: "ignore" });
  runOrThrow("docker", [
    "run",
    "--name",
    postgresContainer,
    "-e",
    `POSTGRES_PASSWORD=${postgresPassword}`,
    "-e",
    `POSTGRES_DB=${postgresDb}`,
    "--rm",
    "-d",
    "-p",
    "5432:5432",
    "postgres"
  ]);
  await waitForPort("127.0.0.1", 5432, 60_000);

  // 2) Start backend with auth bypass
  backendProc = spawn(
    process.env.SHELL || "bash",
    [
      "-lc",
      'sbt "project api_impl_restful" run'
    ],
    {
      cwd: backendDir,
      env: {
        ...process.env,
        E2E_AUTH_BYPASS: "1",
        GOOGLE_CLIENT_ID: "e2e",
        INVITE_SECRET: "e2e-secret",
        JDBC_URL: "jdbc:postgresql://localhost:5432/stemma",
        JDBC_USER: postgresUser,
        JDBC_PASSWORD: postgresPassword
      },
      stdio: "inherit"
    }
  );

  // Wait until backend is responsive
  await waitForPort("127.0.0.1", 8090, 120_000);

  // 3) Build frontend with auto-login enabled
  runOrThrow("npm", ["run", "build"], {
    cwd: frontendDir,
    env: {
      ...process.env,
      E2E_AUTO_LOGIN: "1",
      GOOGLE_CLIENT_ID: "e2e",
      STEMMA_BACKEND_URL: "http://127.0.0.1:8090"
    }
  });

  // 4) Serve frontend
  frontendProc = spawn("npm", ["run", "start", "--", "--host", "127.0.0.1", "--port", "4173"], {
    cwd: frontendDir,
    env: process.env,
    stdio: "inherit"
  });

  await waitForHttp("http://127.0.0.1:4173", 60_000);
  await once(frontendProc, "exit");
}

main().catch((err) => {
  console.error(err);
  cleanup();
  process.exit(1);
});
