export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /* The page never scrolls: whatever a route draws here owns its own
       scrolling, so a header and a tab row can stay put above it. `dvh` on
       the phone, where `100vh` sits under iOS Safari's own chrome and would
       put the editor's bottom bar off the bottom of the screen. */
    <div className="flex h-dvh flex-col bg-surface sm:h-screen">{children}</div>
  );
}
