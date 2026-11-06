import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support | Vectorizerr',
  description:
    'Get help with Vectorizerr — billing, crypto transactions, vectorization issues, and account questions.',
  alternates: { canonical: '/support' },
};

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
