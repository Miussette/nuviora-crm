import { test, expect } from "@playwright/test";
import { resourceFixture } from "./resource-fixture";

test("Clientes y catálogo: crear, validar, editar, buscar, filtrar y archivar desde la interfaz", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  const fixture = await resourceFixture();
  const base = `/app/${fixture.org.slug}`;
  try {
    await fixture.authenticate(page.context(), baseURL!);
    await page.goto(`${base}/clientes`);
    await expect(
      page.getByRole("heading", { name: "Clientes", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No hay registros para mostrar" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Nuevo cliente", exact: true })
      .click();
    await page.getByLabel("Tipo de cliente").selectOption("COMPANY");
    await page
      .getByLabel("Nombre o razón social")
      .fill(`Cliente Álamo ${fixture.marker}`);
    await page.getByLabel("RUT (opcional)").fill("12.345.678-9");
    await page.getByRole("button", { name: "Guardar cliente" }).click();
    await expect(
      page.getByText("RUT inválido: revisa el formato y dígito verificador"),
    ).toBeVisible();
    await page.getByLabel("RUT (opcional)").fill("12.345.678-5");
    await page.getByLabel("Correo electrónico").fill("contacto@example.test");
    await page.getByLabel("Comuna").fill("Providencia");
    await page
      .getByLabel("Notas internas")
      .fill("<script>window.qaXss=true</script>");
    await page.getByRole("button", { name: "Guardar cliente" }).click();
    await expect(
      page.getByRole("heading", {
        name: `Cliente Álamo ${fixture.marker}`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("12345678-5", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => "qaXss" in window)).toBe(false);
    await page.getByRole("link", { name: "Editar", exact: true }).click();
    await page
      .getByLabel("Nombre o razón social")
      .fill(`Cliente Editado ${fixture.marker}`);
    await page.getByLabel("Correo electrónico").fill("");
    await page.getByRole("button", { name: "Guardar cliente" }).click();
    await expect(
      page.getByRole("heading", { name: `Cliente Editado ${fixture.marker}` }),
    ).toBeVisible();
    const customerId = new URL(page.url()).pathname.split("/").at(-1)!;
    await page.goto(`${base}/clientes`);
    await page
      .getByRole("searchbox", { name: "Buscar" })
      .fill("sin resultados");
    await expect(
      page.getByRole("heading", { name: "No hay registros para mostrar" }),
    ).toBeVisible();
    await page.getByRole("searchbox", { name: "Buscar" }).fill("Editado");
    await page.getByLabel("Tipo", { exact: true }).selectOption("COMPANY");
    await page
      .getByRole("link", {
        name: `Cliente Editado ${fixture.marker}`,
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Archivar", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancelar" })
      .click();
    await expect(page.getByText("Activo", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Archivar", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Archivar", exact: true })
      .click();
    await expect(page.getByText("Archivado", { exact: true })).toBeVisible();
    expect(
      (
        await fixture.db.customer.findUniqueOrThrow({
          where: { id: customerId },
        })
      ).archivedAt,
    ).not.toBeNull();
    await page.goto(`${base}/clientes`);
    await page.getByLabel("Estado", { exact: true }).selectOption("ARCHIVED");
    await expect(
      page.getByRole("link", { name: `Cliente Editado ${fixture.marker}` }),
    ).toBeVisible();
    await fixture.db.customer.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({
        organizationId: fixture.org.id,
        name: `Paginado ${i}`,
        type: "PERSON" as const,
      })),
    });
    await page.goto(`${base}/clientes`);
    await expect(page.getByText("12 registros · Página 1 de 2")).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("12 registros · Página 2 de 2")).toBeVisible();
    await page.screenshot({
      path: "test-results/customers-desktop.png",
      fullPage: true,
    });

    await page.goto(`${base}/catalogo`);
    await page.getByRole("link", { name: "Agregar", exact: true }).click();
    await page
      .getByLabel("Nombre *", { exact: true })
      .fill(`Producto ${fixture.marker}`);
    await page.getByLabel("SKU (opcional)").fill(`SKU-${fixture.marker}`);
    await page.getByLabel("Precio unitario neto en CLP").fill("-1");
    await page.getByRole("button", { name: "Guardar elemento" }).click();
    await expect(
      page.getByText("Usa un precio no negativo", { exact: false }),
    ).toBeVisible();
    await page.getByLabel("Precio unitario neto en CLP").fill("19990.25");
    await page.getByRole("button", { name: "Guardar elemento" }).click();
    await expect(
      page.getByRole("heading", { name: `Producto ${fixture.marker}` }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Editar", exact: true }).click();
    await page
      .getByLabel("Precio unitario neto en CLP")
      .fill("9007199254740993.01");
    await page.getByRole("button", { name: "Guardar elemento" }).click();
    await expect(
      page.getByText("$9.007.199.254.740.993,01", { exact: true }),
    ).toBeVisible();
    await page.goto(`${base}/catalogo/nuevo`);
    await page.getByLabel("Tipo", { exact: true }).selectOption("SERVICE");
    await page
      .getByLabel("Nombre *", { exact: true })
      .fill(`Servicio ${fixture.marker}`);
    await page.getByLabel("Precio unitario neto en CLP").fill("25000");
    await page.getByLabel("Unidad de medida").fill("Hora");
    await page.getByLabel("Activo", { exact: true }).uncheck();
    await page.getByRole("button", { name: "Guardar elemento" }).click();
    await expect(
      page.getByRole("heading", { name: `Servicio ${fixture.marker}` }),
    ).toBeVisible();
    await expect(page.getByText("Inactivo", { exact: true })).toBeVisible();
    await page.goto(`${base}/catalogo`);
    await page.getByLabel("Estado", { exact: true }).selectOption("INACTIVE");
    await page.getByLabel("Tipo", { exact: true }).selectOption("SERVICE");
    await page.getByRole("searchbox", { name: "Buscar" }).fill(fixture.marker);
    await page
      .getByRole("link", { name: `Servicio ${fixture.marker}` })
      .click();
    await page.getByRole("button", { name: "Archivar", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Archivar", exact: true })
      .click();
    await expect(page.getByText("Archivado", { exact: true })).toBeVisible();
    await page.goto(`${base}/catalogo`);
    await page.getByLabel("Estado", { exact: true }).selectOption("ALL");
    await page.screenshot({
      path: "test-results/catalog-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("heading", { name: "Catálogo", exact: true })
      .waitFor();
    await expect(page.locator("aside")).toBeHidden();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/catalog-mobile.png",
      fullPage: true,
    });
  } finally {
    await fixture.cleanup();
  }
});

test("La interfaz y la API respetan el rol MEMBER y rechazan recursos de otra empresa", async ({
  page,
  browser,
  baseURL,
}) => {
  const fixture = await resourceFixture();
  const memberContext = await browser.newContext({ baseURL });
  const foreignContext = await browser.newContext({ baseURL });
  try {
    const customer = await fixture.db.customer.create({
      data: {
        organizationId: fixture.org.id,
        name: "Cliente privado",
        type: "PERSON",
      },
    });
    const item = await fixture.db.catalogItem.create({
      data: {
        organizationId: fixture.org.id,
        name: "Producto privado",
        type: "PRODUCT",
        unitPrice: "10.25",
        unit: "Unidad",
      },
    });
    await fixture.authenticate(memberContext, baseURL!, 2);
    const member = await memberContext.newPage();
    await member.goto(`/app/${fixture.org.slug}/clientes`);
    await expect(
      member.getByRole("link", { name: "Cliente privado", exact: true }),
    ).toBeVisible();
    await expect(
      member.getByRole("link", { name: "Nuevo cliente", exact: true }),
    ).toHaveCount(0);
    await member.goto(`/app/${fixture.org.slug}/clientes/nuevo`);
    await expect(
      member.getByRole("alert").filter({ hasText: "Tu rol no permite" }),
    ).toBeVisible();
    await member.goto(`/app/${fixture.org.slug}/catalogo/${item.id}`);
    await expect(
      member.getByRole("link", { name: "Editar", exact: true }),
    ).toHaveCount(0);
    const deniedWrite = await memberContext.request.patch(
      `/api/v1/catalog-items/${item.id}`,
      {
        headers: { Origin: baseURL!, "X-Organization-Slug": fixture.org.slug },
        data: { unitPrice: "1" },
      },
    );
    expect(deniedWrite.status()).toBe(403);
    await fixture.authenticate(foreignContext, baseURL!, 1);
    const foreign = await foreignContext.newPage();
    await foreign.goto(`/app/${fixture.org.slug}/clientes/${customer.id}`);
    await expect(
      foreign.getByRole("heading", { name: "No pudimos abrir esta empresa" }),
    ).toBeVisible();
    for (const [resource, id] of [
      ["customers", customer.id],
      ["catalog-items", item.id],
    ]) {
      const response = await foreignContext.request.get(
        `/api/v1/${resource}/${id}`,
        { headers: { "X-Organization-Slug": fixture.foreignOrg.slug } },
      );
      expect(response.status()).toBe(404);
    }
    await fixture.authenticate(page.context(), baseURL!);
    await page.goto(`/app/${fixture.org.slug}/catalogo/nuevo`);
    await page
      .getByLabel("Nombre *", { exact: true })
      .fill("Cambios sin guardar");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("link", { name: "Cancelar", exact: true }).click();
    await expect(page).toHaveURL(/catalogo\/nuevo$/);
    await page.getByLabel("Nombre *", { exact: true }).fill("");
  } finally {
    await memberContext.close();
    await foreignContext.close();
    await fixture.cleanup();
  }
});
