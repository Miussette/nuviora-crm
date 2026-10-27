import { createRequire } from "node:module";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  createHash,
  timingSafeEqual,
} from "node:crypto";
const require = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const { PrismaClient } = require("@prisma/client");
const {
  calculateQuote,
  chileDate,
  endOfChileDate,
  shiftDate,
} = require("@nuviora/domain");

if (process.env.DEMO_MODE !== "true")
  throw new Error("El seed solo puede usarse con DEMO_MODE=true");
if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL debe apuntar explícitamente a una base dedicada de demostración",
  );
const email = (process.env.DEMO_EMAIL ?? "demo@nuviora.example")
  .trim()
  .toLowerCase();
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 16 || password.length > 128)
  throw new Error("Configura DEMO_PASSWORD con entre 16 y 128 caracteres");
const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
function passwordHash() {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function matches(stored) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex"),
    actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
const db = new PrismaClient();
try {
  await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('nuviora-demo-seed'))::text`;
      const existing = await tx.organization.findUnique({
        where: { slug: "nuviora-demo" },
      });
      if (existing) {
        const member = await tx.membership.findFirst({
          where: { organizationId: existing.id, user: { email } },
          include: { user: true },
        });
        if (!member)
          throw new Error(
            "El slug de demo ya está ocupado por otra organización; no se modificó",
          );
        if (!matches(member.user.passwordHash)) {
          await tx.user.update({
            where: { id: member.userId },
            data: { passwordHash: passwordHash() },
          });
          await tx.session.deleteMany({ where: { userId: member.userId } });
        }
        return;
      }
      if ((await tx.organization.count()) || (await tx.user.count()))
        throw new Error(
          "El seed se negó a modificar una base con datos existentes. Usa un PostgreSQL dedicado y vacío",
        );
      const user = await tx.user.create({
        data: {
          name: "Cuenta Demo",
          email,
          passwordHash: passwordHash(),
          emailVerifiedAt: new Date(),
        },
      });
      const org = await tx.organization.create({
        data: {
          slug: "nuviora-demo",
          name: "Empresa de demostración",
          email: "negocio@example.test",
          legalName: "Datos ficticios para explorar Nuviora",
          timeZone: "America/Santiago",
          settings: { create: { businessType: "MIXED" } },
          memberships: { create: { userId: user.id, role: "OWNER" } },
        },
      });
      const customerData = [
        ["Cafetería Ejemplo", "cafe@example.test"],
        ["Taller Demostración", "taller@example.test"],
        ["Estudio de Prueba", "estudio@example.test"],
      ];
      const customers = [];
      for (const [name, contact] of customerData)
        customers.push(
          await tx.customer.create({
            data: {
              organizationId: org.id,
              type: "COMPANY",
              name,
              email: contact,
              notes: "Registro ficticio de demostración",
            },
          }),
        );
      const product = await tx.catalogItem.create({
        data: {
          organizationId: org.id,
          type: "PRODUCT",
          name: "Kit de insumos de ejemplo",
          sku: "DEMO-001",
          unit: "Kit",
          unitPrice: "25000.00",
          taxMode: "VAT_19",
          description: "Producto ficticio para probar cotizaciones",
        },
      });
      const service = await tx.catalogItem.create({
        data: {
          organizationId: org.id,
          type: "SERVICE",
          name: "Servicio de instalación de ejemplo",
          sku: "DEMO-002",
          unit: "Servicio",
          unitPrice: "75000.00",
          taxMode: "EXEMPT",
          description: "Servicio ficticio de demostración",
        },
      });
      const today = chileDate(),
        date = new Date(`${today}T00:00:00Z`),
        expiry = shiftDate(today, 30);
      const issuer = {
        name: org.name,
        legalName: org.legalName,
        rut: null,
        email: org.email,
        phone: null,
        logoDataUrl: null,
        accentColor: "#7759A6",
        footer: "Demostración · Datos ficticios",
      };
      const recipient = (c) => ({
        name: c.name,
        rut: null,
        email: c.email,
        phone: null,
        address: null,
        commune: null,
        region: null,
        country: "Chile",
      });
      const inputs = [
        {
          catalogItemId: product.id,
          name: product.name,
          description: product.description,
          unit: product.unit,
          quantity: "4",
          unitPrice: "25000.00",
          discount: "0",
          taxMode: "VAT_19",
        },
        {
          catalogItemId: service.id,
          name: service.name,
          description: service.description,
          unit: service.unit,
          quantity: "1",
          unitPrice: "75000.00",
          discount: "0",
          taxMode: "EXEMPT",
        },
      ];
      const calculated = inputs.map((i) => calculateQuote([i]));
      const commercial = (n) => {
        const { lines, ...totals } = calculated[n];
        return { totals, item: { ...inputs[n], ...lines[0], position: 0 } };
      };
      let approvedQuote;
      for (let n = 0; n < 2; n++) {
        const { totals, item } = commercial(n);
        const content = {
          ...totals,
          issuer,
          customer: recipient(customers[n]),
          items: [item],
        };
        const documentHash = hash(content);
        const quote = await tx.quote.create({
          data: {
            organizationId: org.id,
            customerId: customers[n].id,
            customerName: customers[n].name,
            createdById: user.id,
            number: `COT-${String(n + 1).padStart(6, "0")}`,
            status: n === 0 ? "APPROVED" : "SENT",
            documentVersion: 2,
            documentHash,
            requestKey: randomUUID(),
            requestHash: hash({ demo: n }),
            issueDate: date,
            expiryDate: new Date(`${expiry}T00:00:00Z`),
            expiryAt: endOfChileDate(expiry),
            reference: "Ejemplo de demostración",
            issuerSnapshot: issuer,
            customerSnapshot: recipient(customers[n]),
            sentAt: new Date(),
            ...totals,
          },
        });
        await tx.quoteItem.create({
          data: { ...item, organizationId: org.id, quoteId: quote.id },
        });
        await tx.quoteEvent.create({
          data: {
            organizationId: org.id,
            quoteId: quote.id,
            eventType: "SENT",
            actorId: user.id,
            metadata: { demo: true },
          },
        });
        if (n === 0) {
          approvedQuote = quote;
          await tx.quoteApproval.create({
            data: {
              organizationId: org.id,
              quoteId: quote.id,
              documentVersion: 2,
              documentHash,
              decision: "APPROVED",
              approverName: "Cliente de demostración",
              evidenceMetadata: {
                method: "demo_seed",
                identityAssurance: "synthetic",
                confirmed: true,
                consentVersion: "demo",
                interactionId: randomUUID(),
              },
            },
          });
          await tx.quoteEvent.create({
            data: {
              organizationId: org.id,
              quoteId: quote.id,
              eventType: "APPROVED",
              metadata: { demo: true },
            },
          });
        }
      }
      for (let n = 0; n < 3; n++) {
        const source = n === 0 ? 0 : 1;
        const { totals, item } = commercial(source);
        const customer = customers[n];
        const status =
          n === 0 ? "IN_PROGRESS" : n === 1 ? "COMPLETED" : "PENDING";
        const operation = await tx.operation.create({
          data: {
            organizationId: org.id,
            customerId: customer.id,
            customerName: customer.name,
            customerSnapshot: recipient(customer),
            quoteId: n === 0 ? approvedQuote.id : null,
            number: `OP-${String(n + 1).padStart(6, "0")}`,
            type: n === 0 ? "ORDER" : "WORK",
            status,
            requestKey: randomUUID(),
            requestHash: hash({ demoOperation: n }),
            issueDate: date,
            dueDate: new Date(`${shiftDate(today, 7)}T00:00:00Z`),
            assignedUserId: user.id,
            description: "Operación ficticia para explorar el flujo comercial",
            instructions:
              "Ejemplo de demostración; no corresponde a un trabajo real",
            ...totals,
          },
        });
        await tx.operationItem.create({
          data: { ...item, organizationId: org.id, operationId: operation.id },
        });
        await tx.operationEvent.create({
          data: {
            organizationId: org.id,
            operationId: operation.id,
            actorId: user.id,
            eventType: "CREATED",
            metadata: { demo: true },
          },
        });
        await tx.activityLog.create({
          data: {
            organizationId: org.id,
            actorId: user.id,
            resourceId: operation.id,
            action: "operation.created",
            metadata: { demo: true },
          },
        });
        if (n === 0)
          await tx.quoteEvent.create({
            data: {
              organizationId: org.id,
              quoteId: approvedQuote.id,
              eventType: "CONVERTED",
              actorId: user.id,
              metadata: { operationId: operation.id, demo: true },
            },
          });
        if (n < 2) {
          const amount = n === 0 ? "50000.00" : totals.total;
          const payment = await tx.payment.create({
            data: {
              organizationId: org.id,
              operationId: operation.id,
              amount,
              method: "TRANSFER",
              reference: "Ejemplo ficticio, sin movimiento bancario",
              paidAt: date,
              createdById: user.id,
              requestKey: randomUUID(),
              requestHash: hash({ demoPayment: n }),
            },
          });
          await tx.operationEvent.create({
            data: {
              organizationId: org.id,
              operationId: operation.id,
              actorId: user.id,
              eventType: "PAYMENT_REGISTERED",
              metadata: { paymentId: payment.id, amount, demo: true },
            },
          });
          await tx.activityLog.create({
            data: {
              organizationId: org.id,
              actorId: user.id,
              resourceId: operation.id,
              action: "operation.payment_registered",
              metadata: { demo: true },
            },
          });
        }
      }
      await tx.quoteSequence.create({
        data: { organizationId: org.id, lastNumber: 2 },
      });
      await tx.operationSequence.create({
        data: { organizationId: org.id, lastNumber: 3 },
      });
      await tx.activityLog.create({
        data: {
          organizationId: org.id,
          actorId: user.id,
          action: "demo.seed.completed",
          metadata: { synthetic: true },
        },
      });
    },
    { timeout: 30000, maxWait: 30000 },
  );
  console.log(
    "Cuenta y datos de demostración preparados; no se imprimieron credenciales",
  );
} finally {
  await db.$disconnect();
}
