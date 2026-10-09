import { loadTemplatePage } from '~/lib/template-page';
import { TemplateFrame } from '~/components/template-frame';
import { ConnectApp } from '~/components/connect-app';

export const metadata = { title: 'Connect your app', robots: 'noindex' };
export default async function ConnectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { template } = await loadTemplatePage(id);
  return <TemplateFrame id={id} title={template.title}><ConnectApp key={template.updated_at} template={template} /></TemplateFrame>;
}
