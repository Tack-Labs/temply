import { loadTemplatePage } from '~/lib/template-page';
import { TemplateNavigation } from '~/components/template-navigation';
import { ConnectApp } from '~/components/connect-app';

export const metadata = { title: 'Connect your app | Temply', robots: 'noindex' };
export default async function ConnectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { template } = await loadTemplatePage(id);
  return <div className="space-y-6"><TemplateNavigation id={id} title={template.title} /><ConnectApp key={template.updated_at} template={template} /></div>;
}
