import { test } from "node:test";
import assert from "node:assert/strict";
import { operationBalance, operationTransitions } from "@nuviora/domain";
test("Cobros: importes exactos, estados derivados y límites", () => {
  assert.deepEqual(operationBalance("0.30", ["0.10", "0.20"]), {
    paidTotal: "0.30",
    balance: "0.00",
    paymentStatus: "PAID",
  });
  assert.deepEqual(
    operationBalance("9999999999999999.99", ["9999999999999999.98"]),
    {
      paidTotal: "9999999999999999.98",
      balance: "0.01",
      paymentStatus: "PARTIAL",
    },
  );
  assert.equal(operationBalance("100.00", []).paymentStatus, "PENDING");
  assert.equal(operationBalance("0.00", []).paymentStatus, "PAID");
  assert.throws(() => operationBalance("1.00", ["1.01"]));
});
test("Operaciones: transiciones cerradas y estado financiero independiente", () => {
  assert.deepEqual(operationTransitions.PENDING, ["IN_PROGRESS", "CANCELLED"]);
  assert.deepEqual(operationTransitions.IN_PROGRESS, [
    "COMPLETED",
    "CANCELLED",
  ]);
  assert.deepEqual(operationTransitions.COMPLETED, []);
  assert.deepEqual(operationTransitions.CANCELLED, []);
});
