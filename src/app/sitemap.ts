import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const SITE_URL = 'https://vectorizerr.pages.dev';

/**
 * Canonical, indexable routes only. Alias pages (/policy, /conditions,
 * /contact) canonicalize to their primary counterparts and auth/app pages
 * are disallowed in robots.ts — none belong here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/support`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
