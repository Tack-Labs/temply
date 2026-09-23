import { PageLoading } from '~/components/ui/page-loading';

/** The editor header stays; the mark holds the canvas while the template is
 *  fetched on the server. */
export default function TemplateLoading() {
  return <PageLoading label="Loading the template…" />;
}
