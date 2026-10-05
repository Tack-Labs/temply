import { loadTemplatePage } from '~/lib/template-page';
import { TemplateNavigation } from '~/components/template-navigation';
import { TemplateVariables } from '~/components/template-variables';

export const metadata = { title: 'Template variables | Temply', robots: 'noindex' };
export default async function VariablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { template } = await loadTemplatePage(id);
  return <div className="space-y-6"><TemplateNavigation id={id} title={template.title} /><TemplateVariables key={template.updated_at} template={template} /></div>;
}
