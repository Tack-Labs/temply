/**
 * The title of a block on the dashboard home. One definition so the starters,
 * the recent templates and the usage tiles stay the same size as each other.
 */
export function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl font-bold text-ink">
      {children}
    </h2>
  );
}
