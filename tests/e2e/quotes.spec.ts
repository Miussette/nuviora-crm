import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import sharp from "../../apps/api/node_modules/sharp";
import { resourceFixture } from "./resource-fixture";

test("Cotización completa: logo, catálogo real, importes, borrador, PDF, enlace y aprobación pública", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(240000);
  const f = await resourceFixture();
  const publicContext = await browser.newContext({ baseURL });
  const base = `/app/${f.org.slug}`;
  try {
    const customer = await f.db.customer.create({
      data: {
        organizationId: f.org.id,
        name: `Cliente cotización ${f.marker}`,
        type: "COMPANY",
        email: "cliente@example.test",
        notes: "NOTA_PRIVADA_NO_PUBLICAR",
      },
    });
    const product = await f.db.catalogItem.create({
      data: {
        organizationId: f.org.id,
        name: `Producto ${f.marker}`,
        type: "PRODUCT",
        unitPrice: "100",
        unit: "Unidad",
        taxMode: "VAT_19",
      },
    });
    const service = await f.db.catalogItem.create({
      data: {
        organizationId: f.org.id,
        name: `Servicio ${f.marker}`,
        type: "SERVICE",
        unitPrice: "50",
        unit: "Hora",
        taxMode: "EXEMPT",
      },
    });
    await f.authenticate(page.context(), baseURL!);
    await page.goto(`${base}/configuracion/empresa`);
    const png = await sharp({
      create: { width: 160, height: 50, channels: 4, background: "#7759A6" },
    })
      .png()
      .toBuffer();
    await page.getByLabel("Logo del negocio", { exact: false }).setInputFiles({
      name: "logo-emisor.png",
      mimeType: "image/png",
      buffer: png,
    });
    await page
      .getByLabel("Pie de documento")
      .fill("Condiciones del negocio emisor");
    await page
      .getByRole("button", {
        name: "Guardar diseño de cotizaciones",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Diseño de cotizaciones guardado", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Cotizaciones", exact: true }).click();
    await page
      .getByRole("link", { name: "Nueva cotización", exact: true })
      .click();
    await page
      .getByLabel("Cliente *", { exact: true })
      .selectOption(customer.id);
    await page
      .getByRole("button", { name: `Agregar ${product.name}`, exact: true })
      .click();
    const first = page.getByRole("group", { name: "Ítem 1", exact: true });
    await first.getByLabel("Cantidad *", { exact: true }).fill("2");
    await first.getByLabel("Descuento %", { exact: true }).fill("10");
    await page
      .getByRole("button", { name: `Agregar ${service.name}`, exact: true })
      .click();
    await page
      .getByRole("group", { name: "Ítem 2", exact: true })
      .getByLabel("Cantidad *", { exact: true })
      .fill("1.5");
    await page
      .getByRole("button", { name: "Subir ítem 2", exact: true })
      .click();
    await expect(
      page
        .getByRole("group", { name: "Ítem 1", exact: true })
        .getByLabel("Concepto *", { exact: true }),
    ).toHaveValue(service.name);
    await page
      .getByRole("button", { name: "Bajar ítem 1", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Agregar concepto personalizado",
        exact: true,
      })
      .click();
    await page
      .getByRole("group", { name: "Ítem 3", exact: true })
      .getByLabel("Concepto *", { exact: true })
      .fill("Concepto adicional");
    await page
      .getByRole("button", { name: "Eliminar ítem 3", exact: true })
      .click();
    await page
      .getByLabel("Condiciones de pago", { exact: true })
      .fill("Transferencia contra entrega");
    await page
      .getByLabel("Observaciones", { exact: true })
      .fill("Observación comercial pública");
    await expect(page.getByText("$289,20", { exact: true })).toBeVisible();
    await page.screenshot({
      path: "test-results/quote-editor-desktop.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Vista previa", exact: true })
      .click();
    const preview = page.getByRole("dialog", {
      name: "Vista previa del borrador",
      exact: true,
    });
    await expect(preview.getByText("$289,20", { exact: true })).toBeVisible();
    await expect(
      preview.getByRole("img", {
        name: `Logo de Empresa recursos ${f.marker}`,
        exact: true,
      }),
    ).toBeVisible();
    await preview
      .getByRole("button", { name: "Cerrar diálogo", exact: true })
      .click();
    const createRequest = page.waitForRequest(
      (req) => req.method() === "POST" && req.url().endsWith("/api/v1/quotes"),
    );
    await page
      .getByRole("button", { name: "Guardar borrador", exact: true })
      .click();
    expect("total" in (await createRequest).postDataJSON()).toBe(false);
    await expect(
      page.getByRole("heading", { name: "COT-000001", exact: true }),
    ).toBeVisible();
    const id = new URL(page.url()).pathname.split("/").at(-1)!;
    expect(
      (await f.db.quote.findUniqueOrThrow({ where: { id } })).total.toFixed(2),
    ).toBe("289.20");
    await page
      .getByRole("link", { name: "Editar borrador", exact: true })
      .click();
    await page
      .getByLabel("Referencia", { exact: true })
      .fill("Referencia editada");
    await page
      .getByRole("button", { name: "Guardar borrador", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Enviar y compartir", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Enviar cotización", exact: true })
      .getByRole("button", { name: "Enviar cotización", exact: true })
      .click();
    const sharing = page.getByRole("dialog", {
      name: "Compartir cotización",
      exact: true,
    });
    await sharing
      .getByRole("button", { name: "Generar enlace", exact: true })
      .click();
    const linkField = sharing.getByLabel("Enlace público", { exact: true });
    await expect(linkField).toHaveValue(/\/cotizacion\/[a-f0-9]{64}$/);
    const url = await linkField.inputValue();
    await expect(
      sharing.getByRole("link", {
        name: "Compartir por WhatsApp",
        exact: true,
      }),
    ).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
    await sharing
      .getByRole("button", { name: "Cerrar diálogo", exact: true })
      .click();
    const publicPage = await publicContext.newPage();
    const publicResponse = await publicPage.goto(url);
    expect(publicResponse?.headers()["x-robots-tag"]).toContain("noindex");
    expect(publicResponse?.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(
      publicPage.getByRole("heading", {
        name: "Cotización COT-000001",
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
    await expect(
      publicPage.getByText("$289,20", { exact: true }),
    ).toBeVisible();
    await expect(publicPage.getByText("NOTA_PRIVADA_NO_PUBLICAR")).toHaveCount(
      0,
    );
    await publicPage.setViewportSize({ width: 390, height: 844 });
    expect(
      await publicPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await publicPage.screenshot({
      path: "test-results/quote-public-mobile.png",
      fullPage: true,
    });
    await publicPage
      .getByRole("button", { name: "Aprobar cotización", exact: true })
      .click();
    const approval = publicPage.getByRole("dialog", {
      name: "Aprobar cotización",
      exact: true,
    });
    await expect(
      approval.getByRole("button", {
        name: "Confirmar aprobación",
        exact: true,
      }),
    ).toBeDisabled();
    await approval
      .getByLabel("Nombre declarado (opcional)")
      .fill("Cliente de prueba");
    await approval.getByRole("checkbox").check();
    await approval
      .getByRole("button", { name: "Confirmar aprobación", exact: true })
      .click();
    await expect(
      publicPage
        .getByRole("status")
        .filter({ hasText: "La aprobación quedó registrada" }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText("Aprobada", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Evidencia de aprobación",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Editar borrador", exact: true }),
    ).toHaveCount(0);
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Descargar PDF", exact: true })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("COT-000001.pdf");
    await download.saveAs("test-results/quote-approved.pdf");
    await page.screenshot({
      path: "test-results/quote-approved-desktop.png",
      fullPage: true,
    });
    await page.goto(`${base}/clientes/${customer.id}`);
    await expect(
      page.getByRole("link", { name: "COT-000001", exact: true }),
    ).toBeVisible();
    await page.goto(`${base}/cotizaciones`);
    await page.getByLabel("Estado", { exact: true }).selectOption("APPROVED");
    await page
      .getByRole("searchbox", { name: "Buscar", exact: true })
      .fill("COT-000001");
    await expect(
      page.getByRole("link", { name: "COT-000001", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "COT-000001", exact: true }).click();
    await page
      .getByRole("button", { name: "Duplicar como borrador", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Duplicar cotización", exact: true })
      .getByRole("button", { name: "Crear nuevo borrador", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "COT-000002", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
  } finally {
    try {
      await f.cleanup();
    } finally {
      await publicContext.close();
    }
  }
});

test("Cotizaciones: rechazo, revocación, vencimiento, rol MEMBER y acceso ajeno", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180000);
  const f = await resourceFixture();
  const anonymous = await browser.newContext({ baseURL });
  const member = await browser.newContext({ baseURL });
  const outsider = await browser.newContext({ baseURL });
  const headers = { Origin: baseURL!, "X-Organization-Slug": f.org.slug };
  try {
    await f.authenticate(page.context(), baseURL!);
    await f.authenticate(member, baseURL!, 2);
    await f.authenticate(outsider, baseURL!, 1);
    const customer = await f.db.customer.create({
      data: {
        organizationId: f.org.id,
        name: "Cliente decisiones",
        type: "PERSON",
      },
    });
    const body = {
      customerId: customer.id,
      issueDate: new Date().toISOString().slice(0, 10),
      expiryDate: new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .slice(0, 10),
      items: [
        {
          name: "Servicio de prueba",
          description: "",
          unit: "Hora",
          quantity: "1",
          unitPrice: "100",
          discount: "0",
          taxMode: "EXEMPT",
        },
      ],
    };
    async function createShare() {
      const created = await page.request.post("/api/v1/quotes", {
        headers,
        data: { ...body, requestKey: randomUUID() },
      });
      expect(created.status()).toBe(201);
      const q = (await created.json()) as { id: string };
      const sent = await page.request.post(`/api/v1/quotes/${q.id}/send`, {
        headers,
        data: { documentVersion: 1 },
      });
      expect(sent.status()).toBe(201);
      const share = await page.request.post(`/api/v1/quotes/${q.id}/share`, {
        headers,
        data: { expiresInDays: 7 },
      });
      expect(share.status()).toBe(201);
      return { ...q, ...((await share.json()) as { url: string }) };
    }
    const rejected = await createShare();
    const publicPage = await anonymous.newPage();
    await publicPage.goto(rejected.url);
    await publicPage
      .getByRole("button", { name: "Rechazar cotización", exact: true })
      .click();
    const dialog = publicPage.getByRole("dialog", {
      name: "Rechazar cotización",
      exact: true,
    });
    await dialog
      .getByLabel("Motivo (opcional)")
      .fill("No corresponde a lo solicitado");
    await dialog.getByRole("checkbox").check();
    await dialog
      .getByRole("button", { name: "Confirmar rechazo", exact: true })
      .click();
    await expect(
      publicPage
        .getByRole("status")
        .filter({ hasText: "El rechazo quedó registrado" }),
    ).toBeVisible();
    const memberPage = await member.newPage();
    await memberPage.goto(`/app/${f.org.slug}/cotizaciones`);
    await expect(
      memberPage.getByRole("link", { name: "Nueva cotización", exact: true }),
    ).toHaveCount(0);
    await memberPage.goto(`/app/${f.org.slug}/cotizaciones/${rejected.id}`);
    await expect(
      memberPage.getByRole("button", {
        name: "Duplicar como borrador",
        exact: true,
      }),
    ).toHaveCount(0);
    const denied = await member.request.post(
      `/api/v1/quotes/${rejected.id}/share`,
      { headers, data: { expiresInDays: 7 } },
    );
    expect(denied.status()).toBe(403);
    const foreign = await outsider.request.get(
      `/api/v1/quotes/${rejected.id}/pdf`,
      { headers: { "X-Organization-Slug": f.foreignOrg.slug } },
    );
    expect(foreign.status()).toBe(404);
    const revoked = await createShare();
    await page.goto(`/app/${f.org.slug}/cotizaciones/${revoked.id}`);
    await page
      .getByRole("button", { name: "Compartir enlace", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Compartir cotización", exact: true })
      .getByRole("button", { name: "Revocar enlaces", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Cerrar diálogo", exact: true })
      .click();
    await publicPage.goto(revoked.url);
    await expect(
      publicPage.getByRole("heading", {
        name: "Este enlace no está disponible",
        exact: true,
      }),
    ).toBeVisible();
    const expired = await createShare();
    await f.db.quote.update({
      where: { id: expired.id },
      data: { expiryAt: new Date(Date.now() - 1000) },
    });
    await publicPage.goto(expired.url);
    await expect(
      publicPage.getByText("Vencida", { exact: true }),
    ).toBeVisible();
    await expect(
      publicPage.getByRole("button", {
        name: "Aprobar cotización",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(
      await f.db.quoteApproval.count({ where: { quoteId: expired.id } }),
    ).toBe(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/app/${f.org.slug}/cotizaciones`);
    await page
      .getByRole("heading", { name: "Cotizaciones", exact: true })
      .waitFor();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/quote-list-mobile.png",
      fullPage: true,
    });
  } finally {
    try {
      await f.cleanup();
    } finally {
      await Promise.all([anonymous.close(), member.close(), outsider.close()]);
    }
  }
});
