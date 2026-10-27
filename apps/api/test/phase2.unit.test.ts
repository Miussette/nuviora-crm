import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  formatClp,
  isValidMoney,
  isValidRut,
  normalizeRut,
} from "@nuviora/domain";
import {
  CustomerDto,
  UpdateCustomerDto,
} from "../dist/modules/customers/customer.dto";
import {
  CatalogDto,
  UpdateCatalogDto,
} from "../dist/modules/catalog/catalog.dto";
import {
  customerSchema,
  catalogSchema,
} from "../../web/src/features/resources/schemas";

test("RUT: formatos, módulo 11, K y rechazo de datos inválidos", () => {
  for (const value of ["12.345.678-5", "12345678-5", "1.000.005-k"])
    assert.equal(isValidRut(value), true, value);
  for (const value of [
    "12.345.678-9",
    "123456785",
    "00.000.000-0",
    "12a345678-5",
    "12..345.678-5",
    "",
    "123-4",
  ])
    assert.equal(isValidRut(value), false, value);
  assert.equal(normalizeRut("12.345.678-5"), "12345678-5");
  assert.equal(normalizeRut("1.000.005-k"), "1000005-K");
});
test("dinero: sin exponentes, negativos, exceso de decimales ni pérdida de precisión", () => {
  for (const value of ["0", "0.01", "100.50", "9999999999999999.99"])
    assert.equal(isValidMoney(value), true);
  for (const value of [
    "-1",
    "1e3",
    "0.001",
    "10000000000000000",
    "01",
    "1,5",
    "NaN",
    "Infinity",
    " 10",
  ])
    assert.equal(isValidMoney(value), false);
  assert.equal(formatClp("9007199254740993.01"), "$9.007.199.254.740.993,01");
});
test("DTO de cliente valida RUT, correo y nombre; permite omitir opcionales", async () => {
  assert.equal(
    (
      await validate(
        plainToInstance(CustomerDto, { type: "PERSON", name: " Ana " }),
      )
    ).length,
    0,
  );
  const invalid = await validate(
    plainToInstance(CustomerDto, {
      type: "PERSON",
      name: " ",
      rut: "12345678-9",
      email: "correo inválido",
    }),
  );
  assert.deepEqual(
    new Set(invalid.map((e) => e.property)),
    new Set(["name", "rut", "email"]),
  );
  assert.ok(
    (await validate(plainToInstance(UpdateCustomerDto, { country: null })))
      .length,
  );
  assert.equal(
    (await validate(plainToInstance(UpdateCustomerDto, { email: "" }))).length,
    0,
  );
});
test("DTO catálogo rechaza precio numérico, negativo y null en campos obligatorios", async () => {
  const valid = {
    type: "PRODUCT",
    name: "Producto",
    unitPrice: "10.25",
    unit: "Unidad",
    active: true,
    taxMode: "VAT_19",
  };
  assert.equal((await validate(plainToInstance(CatalogDto, valid))).length, 0);
  for (const unitPrice of [-1, 12.5, "-1", "0.001"])
    assert.ok(
      (
        await validate(plainToInstance(CatalogDto, { ...valid, unitPrice }))
      ).some((e) => e.property === "unitPrice"),
    );
  for (const field of [
    "unitPrice",
    "name",
    "unit",
    "active",
    "taxMode",
    "type",
  ])
    assert.ok(
      (await validate(plainToInstance(UpdateCatalogDto, { [field]: null })))
        .length,
      field,
    );
});
test("schemas frontend mantienen las reglas críticas de los formularios", () => {
  const customer = {
    type: "PERSON",
    name: "Ana",
    rut: "12.345.678-5",
    email: "",
    phone: "",
    address: "",
    commune: "",
    region: "",
    country: "Chile",
    notes: "",
  };
  assert.equal(customerSchema.safeParse(customer).success, true);
  assert.equal(
    customerSchema.safeParse({ ...customer, rut: "12.345.678-9" }).success,
    false,
  );
  const item = {
    type: "SERVICE",
    name: "Servicio",
    sku: "",
    description: "",
    unitPrice: "123.45",
    unit: "Hora",
    taxMode: "EXEMPT",
    active: true,
  };
  assert.equal(catalogSchema.safeParse(item).success, true);
  assert.equal(
    catalogSchema.safeParse({ ...item, unitPrice: "-1" }).success,
    false,
  );
});
