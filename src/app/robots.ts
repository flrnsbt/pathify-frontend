import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const SITE_URL = 'https://pathify.art';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Auth and transactional pages are user-specific — keep them out of the index
      disallow: ['/transactions', '/signin', '/login', '/admin'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
