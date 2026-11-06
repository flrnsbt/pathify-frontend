import type { Metadata } from 'next';

// Alias of /support — canonicalize so search engines consolidate signals.
export const metadata: Metadata = {
  title: 'Support | Pathify',
  description:
    'Get help with Pathify — billing, crypto transactions, vectorization issues, and account questions.',
  alternates: { canonical: '/support' },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
