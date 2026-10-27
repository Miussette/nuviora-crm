import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 3001)
  throw new Error("PORT debe ser válido y distinto del puerto interno 3001");
if (process.env.DEMO_MODE !== "true")
  throw new Error(
    "Este arranque está reservado a la demo: configura DEMO_MODE=true",
  );
const origin =
  process.env.APP_ORIGIN ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "");
if (!origin || new URL(origin).protocol !== "https:")
  throw new Error(
    "Configura APP_ORIGIN HTTPS o genera el dominio público de Railway",
  );
const env = {
  ...process.env,
  NODE_ENV: "production",
  APP_ORIGIN: new URL(origin).origin,
  SMTP_HOST: process.env.SMTP_HOST ?? "127.0.0.1",
  SMTP_PORT: process.env.SMTP_PORT ?? "1025",
  MAIL_FROM: process.env.MAIL_FROM ?? "Nuviora Demo <demo@nuviora.example>",
  API_INTERNAL_ORIGIN: "http://127.0.0.1:3001",
};
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children)
    if (child.exitCode === null) child.kill("SIGTERM");
  const force = setTimeout(() => {
    for (const child of children)
      if (child.exitCode === null) child.kill("SIGKILL");
    process.exit(code);
  }, 10000);
  force.unref();
  Promise.all(
    children.map((c) =>
      c.exitCode !== null
        ? Promise.resolve()
        : new Promise((r) => c.once("exit", r)),
    ),
  ).then(() => process.exit(code));
}
function start(args, cwd, childEnv) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: childEnv,
    stdio: "inherit",
  });
  children.push(child);
  child.once("error", () => stop(1));
  child.once("exit", (code) => {
    if (!stopping) stop(code || 1);
  });
  return child;
}
process.on("SIGTERM", () => stop());
process.on("SIGINT", () => stop());
start(["apps/api/dist/main.js"], root, { ...env, PORT: "3001" });
let ready = false;
for (let n = 0; n < 60 && !stopping; n++) {
  try {
    const response = await fetch("http://127.0.0.1:3001/api/v1/health", {
      signal: AbortSignal.timeout(1500),
    });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    /* Wait for the API and its database. */
  }
  await delay(1000);
}
if (!ready) {
  console.error("La API no superó la comprobación de arranque");
  stop(1);
} else if (!stopping)
  start(
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "0.0.0.0",
      "--port",
      String(port),
    ],
    resolve(root, "apps/web"),
    { ...env, PORT: String(port) },
  );
