export type Role = "OWNER" | "ADMIN" | "MEMBER";
export * from './quotes';
export type BusinessType = "PRODUCTS" | "SERVICES" | "MIXED";
export interface Organization {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  rut: string | null;
  email: string;
  phone: string | null;
  country: string;
  currency: string;
  address?:string|null;
  commune?:string|null;
  region?:string|null;
  timeZone?:string;
  settings: { businessType: BusinessType; hiddenModules?:string[] } | null;
}
export interface Membership {
  role: Role;
  organization: Organization;
}
export interface Profile {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
  memberships: Membership[];
}
export interface Customer {
  id: string;
  organizationId: string;
  type: "PERSON" | "COMPANY";
  name: string;
  rut: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  commune: string | null;
  region: string | null;
  country: string;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CatalogItem {
  id: string;
  organizationId: string;
  type: "PRODUCT" | "SERVICE";
  name: string;
  sku: string | null;
  description: string | null;
  unitPrice: string;
  unit: string;
  taxMode: "VAT_19" | "EXEMPT";
  active: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
export * from './operations';
export * from './analytics';
