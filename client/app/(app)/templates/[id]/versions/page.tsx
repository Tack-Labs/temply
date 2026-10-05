import { loadTemplatePage } from '~/lib/template-page';
import { TemplateNavigation } from '~/components/template-navigation';
import { TemplateVersions } from '~/components/template-versions';

export const metadata = { title: 'Template versions | Temply', robots: 'noindex' };
export default async function VersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const props = await loadTemplatePage(id);
  return <div className="space-y-6"><TemplateNavigation id={id} title={props.template.title} /><TemplateVersions {...props} /></div>;
}
