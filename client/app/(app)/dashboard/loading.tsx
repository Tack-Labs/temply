import { PageLoading } from '~/components/ui/page-loading';

/** Shown in the content pane while a dashboard page's server fetch runs; the
 *  sidebar and header above it stay put. */
export default function DashboardLoading() {
  return <PageLoading />;
}
