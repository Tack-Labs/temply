import { EditorHeader } from './editor-header';
import { TemplateNavigation } from './template-navigation';

/**
 * The frame of every page of a template except the editor: the same header
 * and tab row, and a body that scrolls on its own while they stay put. The
 * editor draws its own header because the status and the actions it carries
 * come from the editor's model; this one passes none, so no page here grows a
 * Publish or Delete button just by sitting in the frame.
 *
 * The body is `main`, and the target of the skip link in the root layout.
 */
export function TemplateFrame({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <>
      <EditorHeader title={title} />
      <TemplateNavigation id={id} />
      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] p-4 lg:p-6">{children}</div>
      </main>
    </>
  );
}
