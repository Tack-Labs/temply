import { EditorHeader } from '~/components/editor-header';

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /* `dvh` on the phone: `100vh` sits under iOS Safari's own chrome, which
       would put the editor's bottom bar off the bottom of the screen. */
    <div className="flex h-dvh flex-col bg-surface sm:h-screen">
      {/* A phone gets neither: the editor's own shell carries a top bar with
          the back link in it, and the canvas runs edge to edge. */}
      <div className="hidden sm:block">
        <EditorHeader />
      </div>
      {/* The editor content had no padding or width cap, so the fields and the
          brand panel ran edge to edge. Match the dashboard's gutter and
          measure. */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl sm:p-4 lg:p-6">{children}</div>
      </div>
    </div>
  );
}
