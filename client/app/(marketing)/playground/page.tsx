import type { Metadata } from 'next';
import PlaygroundClient from './playground-client';

export const metadata: Metadata = {
  title: 'Playground',
  description:
    'Try the Temply editor in your browser: drag blocks into an email, put a brand on it and read the HTML it makes. No account needed.',
};

export default function PlaygroundPage() {
  return <PlaygroundClient />;
}

export const dynamic = 'force-dynamic';
