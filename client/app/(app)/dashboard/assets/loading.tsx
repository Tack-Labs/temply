import { PageLoading } from '~/components/ui/page-loading';

/** Without its own boundary Assets would fall back to the home skeleton in
 *  dashboard/loading.tsx. The label matches the page's own loader, so the
 *  hand-off from route to data is one unbroken state. */
export default function AssetsLoading() {
  return <PageLoading label="Loading your images…" />;
}
