/** The review page stands alone: no marketing header, no dashboard chrome —
 *  a reviewer was sent here to look at one email. */
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
