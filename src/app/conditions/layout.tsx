import type { Metadata } from 'next';

// Alias of /terms — canonicalize so search engines consolidate signals.
export const metadata: Metadata = {
  title: 'Terms of Service | Pathify',
  description:
    'Pathify terms of service: free previews, credit-based SVG unlocks, crypto payments, acceptable use, and liability.',
  alternates: { canonical: '/terms' },
};

export default function ConditionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
