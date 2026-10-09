import { loadTemplatePage } from '~/lib/template-page';
import { TemplateFrame } from '~/components/template-frame';
import { TemplateVariables } from '~/components/template-variables';

export const metadata = { title: 'Template variables', robots: 'noindex' };
export default async function VariablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { template } = await loadTemplatePage(id);
  return <TemplateFrame id={id} title={template.title}><TemplateVariables key={template.updated_at} template={template} /></TemplateFrame>;
}
