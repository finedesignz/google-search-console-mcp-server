/**
 * Sites Management Tools
 */

import { SearchConsoleClient } from '../client/index.js';

export async function listSites(client: SearchConsoleClient) {
  const data = await client.listSites();
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export async function getSite(
  client: SearchConsoleClient,
  args: { site_url: string }
) {
  if (!args.site_url) {
    throw new Error('site_url is required');
  }
  const data = await client.getSite(args.site_url);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export async function addSite(
  client: SearchConsoleClient,
  args: { site_url: string }
) {
  if (!args.site_url) {
    throw new Error('site_url is required');
  }
  await client.addSite(args.site_url);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ success: true, site_url: args.site_url, message: 'Site added successfully' }),
      },
    ],
  };
}

export async function deleteSite(
  client: SearchConsoleClient,
  args: { site_url: string }
) {
  if (!args.site_url) {
    throw new Error('site_url is required');
  }
  await client.deleteSite(args.site_url);
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ success: true, site_url: args.site_url, message: 'Site deleted successfully' }),
      },
    ],
  };
}
