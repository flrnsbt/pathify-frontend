import type { Metadata } from 'next';

// Alias of /privacy — canonicalize so search engines consolidate signals.
export const metadata: Metadata = {
  title: 'Privacy Policy | Pathify',
  description:
    'How Pathify handles your images, vector assets, account data, and crypto payment records — strict confidentiality, no AI training, no secondary use.',
  alternates: { canonical: '/privacy' },
};

export default function PolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
