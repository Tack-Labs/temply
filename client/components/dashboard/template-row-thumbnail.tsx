import { TemplateThumbnail } from '~/components/dashboard/template-thumbnail';
import { cn } from '~/lib/classname';
import type { TemplatePillTone } from '~/lib/template-stage';

/**
 * The frame takes its tint from the row's status pill, so the two read as one
 * mark. Exported for the home's recent-template cards, whose larger frame
 * wears the same tints.
 */
export const frameTints: Record<TemplatePillTone, string> = {
  neutral: 'bg-track',
  lavender: 'bg-accent-wash',
  mint: 'bg-success-wash',
  butter: 'bg-warn-wash',
  rose: 'bg-danger-wash',
  sky: 'bg-sky-wash',
};

/** The preview's window inside the frame: 56x64 less a 4px frame on each side. */
const PREVIEW_ASPECT = 48 / 56;

/**
 * The thumbnail as the templates list and the home's recent list both draw it:
 * a 56x64 tinted tile with the email's own preview set inside it. At this size
 * the preview has no room for its "Preview unavailable" caption; the icon
 * alone says it, and the caption would spill out of the frame. The tile is a
 * fixed size on every width, so a row's text column starts 56px plus the
 * row's gap in from its edge.
 */
export function TemplateRowThumbnail({
  templateId,
  updatedAt,
  tone = 'lavender',
}: {
  templateId: string;
  updatedAt: string | null;
  tone?: TemplatePillTone;
}) {
  return (
    <div
      className={cn(
        'h-16 w-14 shrink-0 rounded-lg p-1 [&>div]:rounded-md [&>div]:border-b-0 [&_span]:hidden',
        frameTints[tone],
      )}
    >
      <TemplateThumbnail templateId={templateId} updatedAt={updatedAt} aspect={PREVIEW_ASPECT} />
    </div>
  );
}
