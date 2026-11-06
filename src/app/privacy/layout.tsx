import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Pathify',
  description:
    'How Pathify handles your images, vector assets, account data, and crypto payment records — strict confidentiality, no AI training, no secondary use.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
