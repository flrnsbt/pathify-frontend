import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In | Vectorizerr',
  description:
    'Sign in to Vectorizerr to sync your vectorization history, manage credits, and unlock SVG downloads.',
  robots: { index: false, follow: false },
};

export default function SigninLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
