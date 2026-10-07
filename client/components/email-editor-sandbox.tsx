'use client';

import { useRef } from 'react';
import { PageLoading } from './ui/page-loading';
import { useHydrated } from '~/hooks/use-hydrated';
import { useMediaQuery } from '~/hooks/use-media-query';
import { DesktopEditorLayout } from './editor/desktop-layout';
import { MobileEditorLayout } from './editor/mobile-layout';
import { useTemplateEditor, type EmailEditorSandboxProps } from './editor/use-template-editor';
import { TemplateWorkflowPanel } from './template-workflow-panel';
import { EditorHeader } from './editor-header';
import { TemplateNavigation } from './template-navigation';
import { EditorActions, EditorStatus } from './editor/editor-actions';
import { EditorViewSwitch } from './editor/editor-view-switch';
import { SaveStatus } from './save-status';

export type { EmailEditorSandboxProps };

// The phone's frame imports it from here; the implementation lives in a leaf
// module so a test can mount it without the whole editor behind it.
export { SaveStatus };

export function EmailEditorSandbox(props: EmailEditorSandboxProps) {
  const { imageUploads = true, autofocus } = props;
  const model = useTemplateEditor(props);
  // Width chooses the shell. The server and the first client render pick
  // desktop, so the markup agrees during hydration; a phone switches on its
  // first effect, before the editor has mounted.
  const phone = useMediaQuery('(max-width: 639px)');
  const hydrated = useHydrated();
  // The two shells are different trees, so crossing 640px unmounts one editor
  // and mounts another from `model.editorContent` — which the autosave only
  // refreshes on a 1000 ms debounce. Rotating a phone within a second of the
  // last keystroke would drop that run of typing with no history to undo it
  // back, so the live document is taken here, during render, before the new
  // shell mounts. A layout effect runs after the new editor already has the
  // stale content and is too late.
  const lastShell = useRef(phone);
  if (lastShell.current !== phone) {
    lastShell.current = phone;
    model.flushContent();
  }
  if (phone) {
    // The phone shell is a fixed frame that covers the page, so the workflow
    // lives inside it, in a sheet, rather than in a card around it.
    return <MobileEditorLayout model={model} autofocus={autofocus} imageUploads={imageUploads} />;
  }
  // Until the client has hydrated, only CSS knows the width: the server's
  // desktop markup is hidden below `sm` and the page's wait state shows in
  // its place, so a phone never paints the desktop page while its JavaScript
  // is still on the way. The wrapper stays after hydration, as `contents`,
  // so lifting the class does not remount the desktop shell.
  const wrapper = hydrated ? 'contents' : 'contents max-sm:hidden';
  const waiting = hydrated ? null : (
    <div className="sm:hidden">
      <PageLoading label="Loading the editor…" />
    </div>
  );

  // The anonymous playground has no template, so no header, tabs or actions
  // to put in a frame: it is the one section on a page of its own.
  if (!model.template) {
    return (
      <div className="space-y-5">
        <div className={wrapper}>
          <DesktopEditorLayout model={model} autofocus={autofocus} imageUploads={imageUploads} framed={false} />
        </div>
        {waiting}
      </div>
    );
  }

  // A saved template is the full-height frame the route's layout makes: the
  // header and the tab row keep their height, and the body under them is the
  // one thing that scrolls. The header carries the status and the actions
  // because the model that knows them lives here; the other pages in the
  // frame pass the header neither.
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={wrapper}>
        <EditorHeader
          title={model.subject}
          status={<EditorStatus model={model} />}
          actions={<EditorActions model={model} />}
          beforeNavigate={model.beforeStage}
        />
        <TemplateNavigation
          id={model.template.id}
          beforeNavigate={model.beforeStage}
          trailing={<EditorViewSwitch model={model} />}
        />
        {/* From `lg` this is a fixed shell: the docked bar and the canvas under
            it scroll themselves. Below it the page scrolls as one. */}
        <main id="main-content" className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-sunken lg:overflow-hidden">
          <TemplateWorkflowPanel model={model}>
            <DesktopEditorLayout model={model} autofocus={autofocus} imageUploads={imageUploads} framed />
          </TemplateWorkflowPanel>
        </main>
      </div>
      {waiting}
    </div>
  );
}
