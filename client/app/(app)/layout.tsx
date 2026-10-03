import type { Metadata } from 'next';
import { Clerk } from '~/components/clerk';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Clerk>{children}</Clerk>;
}
