/**
 * Sitemaps Management Tools
 */

import { SearchConsoleClient } from '../client/index.js';

export async function listSitemaps(
  client: SearchConsoleClient,
  args: { site_url: string }
) {
  if (!args.site_url) {
    throw new Error('site_url is required');
  }
  const data = await client.listSitemaps(args.site_url);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export async function getSitemap(
  client: SearchConsoleClient,
  args: { site_url: string; feedpath: string }
) {
  if (!args.site_url || !args.feedpath) {
    throw new Error('site_url and feedpath are required');
  }
  const data = await client.getSitemap(args.site_url, args.feedpath);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export async function submitSitemap(
  client: SearchConsoleClient,
  args: { site_url: string; feedpath: string }
) {
  if (!args.site_url || !args.feedpath) {
    throw new Error('site_url and feedpath are required');
  }
  await client.submitSitemap(args.site_url, args.feedpath);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          site_url: args.site_url,
          feedpath: args.feedpath,
          message: 'Sitemap submitted successfully',
        }),
      },
    ],
  };
}

export async function deleteSitemap(
  client: SearchConsoleClient,
  args: { site_url: string; feedpath: string }
) {
  if (!args.site_url || !args.feedpath) {
    throw new Error('site_url and feedpath are required');
  }
  await client.deleteSitemap(args.site_url, args.feedpath);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          site_url: args.site_url,
          feedpath: args.feedpath,
          message: 'Sitemap deleted successfully',
        }),
      },
    ],
  };
}
