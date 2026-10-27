import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import sharp from "../../apps/api/node_modules/sharp";
import { chileDate } from "../../packages/domain/src";
import { resourceFixture } from "./resource-fixture";
test("Dashboard y reportes: datos reales, filtros, gráficos accesibles, CSV y móvil", async ({
  page,
  baseURL,
}) => {
  const f = await resourceFixture();
  const base = `/app/${f.org.slug}`;
  try {
    const customer = await f.db.customer.create({
      data: { organizationId: f.org.id, type: "PERSON", name: "=SUM(1;1)" },
    });
    await f.authenticate(page.context(), baseURL!);
    const headers = { Origin: baseURL!, "X-Organization-Slug": f.org.slug };
    const opResponse = await page.request.post("/api/v1/operations", {
      headers,
      data: {
        type: "ORDER",
        customerId: customer.id,
        issueDate: chileDate(),
        description: "Venta QA",
        status: "PENDING",
        items: [
          {
            name: "Servicio",
            unit: "Hora",
            quantity: "1",
            unitPrice: "100",
            discount: "0",
            taxMode: "EXEMPT",
          },
        ],
        requestKey: randomUUID(),
      },
    });
    expect(opResponse.status()).toBe(201);
    const op = await opResponse.json();
    expect(
      (
        await page.request.post("/api/v1/payments", {
          headers,
          data: {
            operationId: op.id,
            amount: "25",
            method: "CASH",
            paidAt: chileDate(),
            requestKey: randomUUID(),
          },
        })
      ).status(),
    ).toBe(201);
    await page.goto(`${base}/inicio`);
    await expect(
      page.getByRole("heading", { name: "Ventas registradas", exact: true }),
    ).toBeVisible();
    const sales = page.locator("article").filter({
      has: page.getByRole("heading", {
        name: "Ventas registradas",
        exact: true,
      }),
    });
    await expect(sales.getByText("$100", { exact: true })).toBeVisible();
    await expect(
      page
        .locator("article")
        .filter({
          has: page.getByRole("heading", {
            name: "Cobros recibidos",
            exact: true,
          }),
        })
        .getByText("$25", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator("article")
        .filter({
          has: page.getByRole("heading", {
            name: "Saldo pendiente",
            exact: true,
          }),
        })
        .getByText("$75", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Período", exact: true })
      .selectOption("TODAY");
    await expect(sales.getByText("$100", { exact: true })).toBeVisible();
    await page
      .getByText("Ver datos del gráfico", { exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("table", { name: "Evolución de ventas: valores exactos" }),
    ).toContainText("$100");
    await page.screenshot({
      path: "test-results/phase5-dashboard-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("heading", { name: "Ventas registradas", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/phase5-dashboard-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/reportes`);
    await expect(
      page.getByRole("heading", { name: "Reportes", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "=SUM(1;1)", exact: true }),
    ).toBeVisible();
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Exportar CSV", exact: true })
      .click();
    const file = await downloaded;
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const csv = Buffer.concat(chunks);
    expect(csv.subarray(0, 3).toString("hex")).toBe("efbbbf");
    expect(csv.toString("utf8")).toContain('"\'=SUM(1;1)"');
    for (const kind of ["quotes", "operations", "payments"]) {
      await page
        .getByRole("combobox", { name: "Reporte", exact: true })
        .selectOption(kind);
      await expect(
        page.getByRole("heading", { name: "Reportes", exact: true }),
      ).toBeVisible();
    }
    await page
      .getByRole("combobox", { name: "Reporte", exact: true })
      .selectOption("sales");
    await page
      .getByRole("combobox", { name: "Período", exact: true })
      .selectOption("CUSTOM");
    await page.getByLabel("Desde", { exact: true }).fill("2025-01-01");
    await page.getByLabel("Hasta", { exact: true }).fill("2025-01-02");
    await expect(
      page.getByText("Sin registros para estos filtros.", { exact: true }),
    ).toBeVisible();
  } finally {
    await f.cleanup();
  }
});
test("Usuarios: invitar por correo, aceptar, cambiar rol y desactivar acceso", async ({
  page,
  browser,
  baseURL,
}) => {
  const f = await resourceFixture();
  const invitedContext = await browser.newContext({ baseURL });
  try {
    const target = await f.db.membership.findFirstOrThrow({
      where: { organizationId: f.foreignOrg.id },
      include: { user: true },
    });
    await f.authenticate(page.context(), baseURL!);
    const base = `/app/${f.org.slug}`;
    await page.goto(`${base}/configuracion/usuarios`);
    await page
      .getByRole("button", { name: "Invitar usuario", exact: true })
      .click();
    await page.getByLabel("Correo del usuario *").fill(target.user.email);
    await page
      .getByRole("button", { name: "Enviar invitación", exact: true })
      .click();
    await expect(
      page.getByText("Invitación enviada", { exact: true }),
    ).toBeVisible();
    const messages = (await page.request
      .get("http://localhost:8025/api/v1/messages?limit=200")
      .then((r) => r.json())) as {
      messages: { ID: string; To: { Address: string }[] }[];
    };
    const message = messages.messages.find((m) =>
      m.To.some((to) => to.Address === target.user.email),
    );
    expect(message).toBeTruthy();
    const mail = (await page.request
      .get(`http://localhost:8025/api/v1/message/${message!.ID}`)
      .then((r) => r.json())) as { Text: string };
    const link = mail.Text.match(
      /https?:\/\/[^\s]+\/aceptar-invitacion#token=[a-f0-9]{64}/,
    )?.[0];
    expect(link).toBeTruthy();
    await f.authenticate(invitedContext, baseURL!, 1);
    const invitedPage = await invitedContext.newPage();
    await invitedPage.goto(link!);
    await invitedPage
      .getByRole("button", { name: "Aceptar y continuar", exact: true })
      .click();
    await expect(invitedPage).toHaveURL(
      new RegExp(`/app/${f.org.slug}/inicio`),
    );
    await page.reload();
    const row = page.getByRole("row").filter({ hasText: target.user.email });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Cambiar rol", exact: true }).click();
    await page
      .getByRole("button", { name: "Confirmar cambio", exact: true })
      .click();
    await expect(row.getByText("Administrador", { exact: true })).toBeVisible();
    await row
      .getByRole("button", { name: "Desactivar acceso", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar cambio", exact: true })
      .click();
    await expect(row.getByText("Desactivado", { exact: true })).toBeVisible();
    await invitedPage.reload();
    await expect(
      invitedPage.getByRole("heading", {
        name: "No pudimos abrir esta empresa",
        exact: true,
      }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/phase5-users-mobile.png",
      fullPage: true,
    });
  } finally {
    await invitedContext.close();
    await f.cleanup();
  }
});
test("Configuración: empresa, logo, módulos, plan sin cobro y miembro sin exportación", async ({
  page,
  baseURL,
}) => {
  const f = await resourceFixture();
  try {
    await f.authenticate(page.context(), baseURL!);
    const base = `/app/${f.org.slug}`;
    await page.goto(`${base}/configuracion/empresa`);
    await page
      .getByLabel("Nombre comercial *", { exact: true })
      .fill(`Empresa actualizada ${f.marker}`);
    await page
      .getByLabel("Dirección", { exact: true })
      .fill("Av. de prueba 123");
    await page.getByLabel("Zona horaria *").fill("America/Punta_Arenas");
    await page
      .getByRole("button", { name: "Guardar empresa", exact: true })
      .click();
    await expect(
      page.getByText("Empresa guardada", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Logo del negocio", { exact: false }).setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: await sharp({
        create: { width: 120, height: 50, channels: 4, background: "#7759A6" },
      })
        .png()
        .toBuffer(),
    });
    await page
      .getByRole("button", {
        name: "Guardar diseño de cotizaciones",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Diseño de cotizaciones guardado", { exact: true }),
    ).toBeVisible();
    await page.goto(`${base}/configuracion/modulos`);
    await page.getByLabel("Catálogo", { exact: true }).uncheck();
    await page
      .getByRole("button", { name: "Guardar módulos", exact: true })
      .click();
    await expect(
      page.getByText("Configuración guardada", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Navegación principal" })
        .getByRole("link", { name: "Catálogo", exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Catálogo", { exact: true }).check();
    await page
      .getByRole("button", { name: "Guardar módulos", exact: true })
      .click();
    await page.goto(`${base}/configuracion/suscripcion`);
    await expect(
      page.getByRole("heading", { name: "Plan y suscripción", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Sin fecha de renovación", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/phase5-subscription-desktop.png",
      fullPage: true,
    });
    await page.context().clearCookies();
    await f.authenticate(page.context(), baseURL!, 2);
    await page.goto(`${base}/reportes`);
    await expect(
      page.getByRole("heading", { name: "Reportes", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Exportar CSV", exact: true }),
    ).toHaveCount(0);
    await page.goto(`${base}/configuracion/usuarios`);
    await expect(
      page.getByText("Tu rol no permite administrar usuarios.", {
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await f.cleanup();
  }
});
