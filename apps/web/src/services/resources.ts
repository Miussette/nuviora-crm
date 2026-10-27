import { api } from './api';
export type Resource = 'customers' | 'catalog-items';
export const resourceRoute = (resource: Resource) => resource === 'customers' ? 'clientes' : 'catalogo';
export function organizationApi<T>(slug: string, path: string, options: RequestInit = {}) {
  return api<T>(path, { ...options, headers: { ...options.headers, 'X-Organization-Slug': slug } });
}
