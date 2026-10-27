import assert from "node:assert/strict";

const base = process.env.DEMO_CHECK_URL?.replace(/\/$/, "");
const password = process.env.DEMO_PASSWORD;
if (!base || !password)
  throw new Error("Configura DEMO_CHECK_URL y DEMO_PASSWORD");
const email = process.env.DEMO_EMAIL ?? "demo@nuviora.example";
const origin = process.env.APP_ORIGIN ?? new URL(base).origin;
const headers = { "Content-Type": "application/json", Origin: origin };
const request = (path, options = {}) =>
  fetch(`${base}/api/v1${path}`, { ...options, headers });
assert.equal((await fetch(`${base}/login`)).status, 200);
const info = await request("/demo");
assert.deepEqual(await info.json(), { enabled: true, email });
const login = await request("/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password }),
});
assert.equal(login.status, 201, "Login demo");
assert.ok(login.headers.get("set-cookie"), "Cookie de sesión");
headers.Cookie = login.headers.get("set-cookie").split(";")[0];
headers["X-Organization-Slug"] = "nuviora-demo";
const summary = await request("/dashboard/summary");
assert.equal(summary.status, 200);
assert.match(summary.headers.get("cache-control"), /no-store/);
const dashboard = await summary.json();
assert.ok(dashboard.metrics.balance);
const quotes = await request("/quotes");
assert.equal(quotes.status, 200);
const list = await quotes.json();
assert.ok(list.data.length > 0);
const pdf = await request(`/quotes/${list.data[0].id}/pdf`);
assert.equal(pdf.status, 200);
assert.match(pdf.headers.get("content-type"), /application\/pdf/);
assert.equal(
  Buffer.from(await pdf.arrayBuffer())
    .subarray(0, 5)
    .toString(),
  "%PDF-",
);
const csv = await request("/reports/export?report=sales");
assert.equal(csv.status, 200);
assert.match(csv.headers.get("content-type"), /text\/csv/);
assert.ok((await csv.text()).length > 10);
const blocked = await request("/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Prueba Demo",
    email: "blocked@example.test",
    password,
    terms: true,
  }),
});
assert.equal(blocked.status, 403, "Registro público bloqueado");
const invitation = await request("/organizations/current/invitations", {
  method: "POST",
  body: JSON.stringify({ email: "blocked@example.test", role: "MEMBER" }),
});
assert.equal(invitation.status, 403, "Invitaciones bloqueadas");
console.log(
  "OK: demo, acceso, dashboard, cotizaciones PDF, CSV y bloqueos de registro/invitaciones",
);
