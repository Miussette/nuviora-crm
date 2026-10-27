import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { chileDate } from "../../packages/domain/src";
import { resourceFixture } from "./resource-fixture";
test("Operaciones y cobros: pedido, trabajo, conversión, abonos, reverso, historial y móvil", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(240000);
  const f = await resourceFixture();
  const base = `/app/${f.org.slug}`;
  try {
    const customer = await f.db.customer.create({
      data: {
        organizationId: f.org.id,
        type: "PERSON",
        name: `Cliente operaciones ${f.marker}`,
      },
    });
    const product = await f.db.catalogItem.create({
      data: {
        organizationId: f.org.id,
        type: "SERVICE",
        name: `Servicio operaciones ${f.marker}`,
        unit: "Hora",
        unitPrice: "100",
        taxMode: "VAT_19",
      },
    });
    await f.authenticate(page.context(), baseURL!);
    await page.goto(`${base}/operaciones`);
    await page
      .getByRole("link", { name: "Nueva operación", exact: true })
      .click();
    await page
      .getByLabel("Cliente *", { exact: true })
      .selectOption(customer.id);
    await page
      .getByLabel("Descripción del pedido o trabajo *")
      .fill("Pedido real de prueba");
    await page
      .getByRole("button", { name: `Agregar ${product.name}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Crear operación", exact: true })
      .click();
    await expect(page).toHaveURL(/\/operaciones\/[a-f0-9-]+$/);
    const operationId = page.url().split("/").at(-1)!;
    await expect(
      page.getByRole("heading", { name: "OP-000001", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Iniciar operación", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar cambio", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Completar operación", exact: true }),
    ).toBeVisible();
    async function payment(amount: string) {
      await page
        .getByRole("link", { name: "Registrar pago", exact: true })
        .click();
      await expect(page.getByText(`Cliente:`, { exact: false })).toBeVisible();
      await page.getByLabel("Monto recibido *").fill(amount);
      await page
        .getByLabel("Referencia", { exact: true })
        .fill(`Prueba ${amount}`);
      await page
        .getByRole("button", { name: "Registrar pago", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Pagos y abonos", exact: true }),
      ).toBeVisible();
    }
    await payment("40");
    await page.goto(`${base}/operaciones/${operationId}`);
    await expect(
      page.getByText("Parcial", { exact: true }).first(),
    ).toBeVisible();
    await payment("79");
    await expect(page.getByText("Pagado", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Revertir pago", exact: true })
      .first()
      .click();
    await page
      .getByLabel("Motivo del reverso *")
      .fill("Registro de prueba ingresado por error");
    await page
      .getByRole("button", { name: "Confirmar reverso", exact: true })
      .click();
    await expect(
      page.getByText("Parcial", { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Historial", exact: true }).click();
    await expect(
      page.getByText("Pago revertido", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Completar operación", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar cambio", exact: true })
      .click();
    await expect(
      page.getByText("Completado", { exact: true }).first(),
    ).toBeVisible();
    await page.goto(`${base}/cobros`);
    await expect(
      page.getByText("Total por cobrar", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "OP-000001", exact: true }).first(),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("heading", { name: "Cobros", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/phase4-cobros-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/operaciones/nueva`);
    await page.getByLabel("Tipo *").selectOption("WORK");
    await page
      .getByLabel("Cliente *", { exact: true })
      .selectOption(customer.id);
    await page
      .getByLabel("Descripción del pedido o trabajo *")
      .fill("Trabajo manual");
    await page
      .getByRole("button", { name: "Agregar concepto personalizado" })
      .click();
    const item = page.getByRole("group", { name: "Ítem 1", exact: true });
    await item
      .getByLabel("Nombre", { exact: true })
      .fill("Trabajo personalizado");
    await item.getByLabel("Precio unitario", { exact: true }).fill("50");
    await page
      .getByRole("button", { name: "Crear operación", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "OP-000002", exact: true }),
    ).toBeVisible();
    const headers = { Origin: baseURL!, "X-Organization-Slug": f.org.slug };
    const quoteResponse = await page.request.post("/api/v1/quotes", {
      headers,
      data: {
        customerId: customer.id,
        issueDate: chileDate(),
        expiryDate: chileDate(new Date(Date.now() + 30 * 86400000)),
        requestKey: randomUUID(),
        items: [
          {
            catalogItemId: product.id,
            name: product.name,
            description: "",
            unit: "Hora",
            quantity: "1",
            unitPrice: "100",
            discount: "0",
            taxMode: "VAT_19",
          },
        ],
      },
    });
    expect(quoteResponse.status()).toBe(201);
    const quote = await quoteResponse.json();
    const sent = await page.request
      .post(`/api/v1/quotes/${quote.id}/send`, {
        headers,
        data: { documentVersion: 1 },
      })
      .then((r) => r.json());
    const share = await page.request
      .post(`/api/v1/quotes/${quote.id}/share`, {
        headers,
        data: { expiresInDays: 7 },
      })
      .then((r) => r.json());
    const token = new URL(share.url).pathname.split("/").at(-1);
    expect(
      (
        await page.request.post(`/api/v1/public/quotes/${token}/approve`, {
          headers,
          data: { documentVersion: sent.documentVersion, confirmed: true },
        })
      ).status(),
    ).toBe(201);
    await page.goto(`${base}/cotizaciones/${quote.id}`);
    await page
      .getByRole("link", { name: "Crear operación", exact: true })
      .click();
    await page
      .getByLabel("Descripción del pedido o trabajo *")
      .fill("Trabajo aprobado");
    await page
      .getByRole("button", { name: "Crear operación", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "OP-000003", exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Detalle", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: product.name, exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/phase4-operation-desktop.png",
      fullPage: true,
    });
    await page.goto(`${base}/clientes/${customer.id}`);
    await expect(
      page.getByRole("heading", {
        name: "Operaciones del cliente",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await f.cleanup();
  }
});
test("Operaciones y cobros: lectura para miembro y bloqueo de empresa ajena", async ({
  page,
  baseURL,
}) => {
  const f = await resourceFixture();
  try {
    await f.authenticate(page.context(), baseURL!, 2);
    await page.goto(`/app/${f.org.slug}/operaciones`);
    await expect(
      page.getByRole("heading", { name: "Operaciones", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Nueva operación", exact: true }),
    ).toHaveCount(0);
    await page.goto(`/app/${f.org.slug}/cobros/nuevo`);
    await expect(
      page.getByText("No tienes permiso para registrar pagos.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(`/app/${f.org.slug}/operaciones/nueva`);
    await expect(
      page.getByText("No tienes permiso para crear operaciones.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(`/app/${f.foreignOrg.slug}/operaciones`);
    await expect(
      page.getByRole("heading", { name: "No pudimos abrir esta empresa" }),
    ).toBeVisible();
  } finally {
    await f.cleanup();
  }
});
