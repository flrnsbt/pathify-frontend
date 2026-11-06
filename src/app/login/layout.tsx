import type { Metadata } from 'next';

// Alias of /signin — noindex like the primary auth page.
export const metadata: Metadata = {
  title: 'Sign In | Vectorizerr',
  robots: { index: false, follow: false },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
