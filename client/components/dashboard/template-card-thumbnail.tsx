import { frameTints } from '~/components/dashboard/template-row-thumbnail';
import { TemplateThumbnail } from '~/components/dashboard/template-thumbnail';
import { cn } from '~/lib/classname';
import type { TemplatePillTone } from '~/lib/template-stage';

/** The window the email shows through: 120px wide and 116px tall, the 140px frame less 12px of tint above and below. */
const WINDOW_ASPECT = 120 / 116;

/**
 * The thumbnail as the home's recent-template cards draw it: the email's own
 * preview in a small window, centred in a 140px frame tinted from the card's
 * status pill. The frame is a tile like the list row's, at card size: the
 * tint names the place and the email, which keeps its own theme, is what it
 * is a picture of.
 */
export function TemplateCardThumbnail({
  templateId,
  updatedAt,
  tone,
}: {
  templateId: string;
  updatedAt: string | null;
  tone: TemplatePillTone;
}) {
  return (
    <div className={cn('grid h-35 place-items-center rounded-xl', frameTints[tone])}>
      {/* The preview draws a hairline under itself for the cards that stack it
          over a title; inside a frame it would only underline the window. */}
      <div className="w-30 overflow-hidden rounded-md shadow-xs [&>div]:border-b-0">
        <TemplateThumbnail templateId={templateId} updatedAt={updatedAt} aspect={WINDOW_ASPECT} />
      </div>
    </div>
  );
}
