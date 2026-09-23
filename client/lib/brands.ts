import { queryOptions } from '@tanstack/react-query';
import { httpGet } from '~/lib/http';

export type Brand = { id: string; name: string; theme: string; is_default: number; created_at: string | null };
export type BrandsResponse = { brands: Brand[]; limit: number | null; defaultBrandId: string | null };

export function brandsQueryOptions() {
  return queryOptions({
    queryKey: ['brands'],
    queryFn: () => httpGet<BrandsResponse>('/api/v1/brands', {}),
  });
}
