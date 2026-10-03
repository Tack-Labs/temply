import { TemplateThumbnail } from '~/components/dashboard/template-thumbnail';

/**
 * The thumbnail as the templates list and the home's recent list both draw it,
 * 64px wide and 80px on a wide list. At 64px it has no room for its "Preview
 * unavailable" caption; the icon alone says it, and the caption would spill
 * out of the frame. The rows' meta cell indents by `pl-19`, this width plus
 * the row's gap, so the width changes there too.
 */
export function TemplateRowThumbnail({ templateId, updatedAt }: { templateId: string; updatedAt: string | null }) {
  return (
    <div className="w-16 overflow-hidden rounded-md border border-line @2xl:w-20 [&>div]:border-b-0 [&_span]:hidden">
      <TemplateThumbnail templateId={templateId} updatedAt={updatedAt} />
    </div>
  );
}
