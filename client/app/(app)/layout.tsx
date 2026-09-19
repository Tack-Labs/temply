import { Clerk } from '~/components/clerk';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Clerk>{children}</Clerk>;
}
