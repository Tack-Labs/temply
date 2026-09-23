import { PageLoading } from '~/components/ui/page-loading';

/** Settings has its own boundary so the title and tabs stay while a tab's
 *  page arrives, and the mark lands where the tab's own data loader will. */
export default function SettingsLoading() {
  return <PageLoading />;
}
