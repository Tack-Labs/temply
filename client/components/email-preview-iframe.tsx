import { useMemo } from 'react';
import { MailOpenIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '~/lib/classname';
import { Button } from './ui/button';

type EmailPreviewIFrameProps = {
  innerHTML: string;
  showOpenInNewTab?: boolean;
  wrapperClassName?: string;
  /** Render the email the way a client that forces dark mode would. */
  forceDark?: boolean;
} & React.HTMLProps<HTMLIFrameElement>;

/**
 * Approximates an aggressive client-side dark-mode transform. It is not a
 * reproduction of any particular email client — different clients invert,
 * blend, or leave the message alone, and several ignore CSS entirely. This is
 * the worst case: if a design survives here, the gentler transforms are safe.
 *
 * The counter-filter on media matters. Without it every image renders as a
 * negative, which would make the preview lie in the other direction.
 */
const FORCE_DARK_STYLE = `
  html {
    filter: invert(1) hue-rotate(180deg);
    background-color: #ffffff;
  }
  img, video, picture, svg, [style*="background-image"] {
    filter: invert(1) hue-rotate(180deg);
  }
`;

/** The page the frame shows: the email, in a document of its own. */
function emailDocument(html: string, forceDark: boolean): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
    ${forceDark ? `<style>${FORCE_DARK_STYLE}</style>` : ''}
  </head>
  <body>
    ${html}
  </body>
</html>`;
}

/**
 * The email, shown inert.
 *
 * A Custom HTML block is whatever the author typed, and the render passes it
 * through as written; so the preview is the one place in the app where a
 * customer's markup runs. It used to be written straight into a frame that
 * shared the app's origin, which made a `<script>` in one member's template
 * run as whoever previewed it next — with their session, against the API.
 * `sandbox=""` gives the frame an origin of its own and no script at all,
 * the same footing the share page and the dashboard thumbnails already put
 * an email on. Nothing an email client would honour is lost: scripts never
 * ran in an inbox either.
 */
export function EmailPreviewIFrame(props: EmailPreviewIFrameProps) {
  const {
    innerHTML,
    showOpenInNewTab = true,
    wrapperClassName,
    forceDark = false,
    ...defaultProps
  } = props;

  const document = useMemo(() => emailDocument(innerHTML, forceDark), [innerHTML, forceDark]);

  // The new tab is the app's own page around a frame on the same terms as
  // the one below — a popup written the email directly would be back on the
  // app's origin, and a Blob URL inherits it too.
  function handleOpen() {
    if (innerHTML.trim().length === 0) {
      toast.error('There is no data to preview.');
      return;
    }

    const newWindow = window.open('about:blank', '_blank');
    newWindow?.focus();

    const newDoc = newWindow?.document;
    if (!newDoc) {
      toast.error('Something went wrong.');
      return;
    }

    newDoc.title = 'Email preview';
    newDoc.body.style.margin = '0';
    const frame = newDoc.createElement('iframe');
    frame.setAttribute('sandbox', '');
    frame.title = 'Email preview';
    frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';
    frame.srcdoc = document;
    newDoc.body.appendChild(frame);
  }

  return (
    <div className={cn('relative', wrapperClassName)}>
      <iframe title="Email preview" {...defaultProps} sandbox="" srcDoc={document} />

      {showOpenInNewTab ? (
        <Button
          className="absolute right-0 bottom-0 h-8 gap-1.5 rounded-none rounded-tl-md border-t border-l border-line text-sm font-normal"
          onClick={handleOpen}
          type="button"
          variant="secondary"
        >
          <MailOpenIcon className="h-3.5 w-3.5 shrink-0" />
          <span>Open in new tab</span>
        </Button>
      ) : null}
    </div>
  );
}
