import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In | Pathify',
  description:
    'Sign in to Pathify to sync your vectorization history, manage credits, and unlock SVG downloads.',
  robots: { index: false, follow: false },
};

export default function SigninLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
