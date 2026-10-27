export const PLANS = {
  EMPRENDE: {
    name: "Emprende",
    users: 1,
    modules: ["customers", "catalog", "quotes"],
  },
  NEGOCIO: {
    name: "Negocio",
    users: 3,
    modules: [
      "customers",
      "catalog",
      "quotes",
      "operations",
      "payments",
      "reports",
    ],
  },
  EQUIPO: {
    name: "Equipo",
    users: 8,
    modules: [
      "customers",
      "catalog",
      "quotes",
      "operations",
      "payments",
      "reports",
    ],
  },
} as const;
export type PlanCode = keyof typeof PLANS;
export const COMMERCIAL_MODULES = [
  "customers",
  "catalog",
  "quotes",
  "operations",
  "payments",
  "reports",
] as const;
