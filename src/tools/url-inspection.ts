/**
 * URL Inspection Tool
 */

import { SearchConsoleClient } from '../client/index.js';

interface InspectUrlArgs {
  site_url: string;
  inspection_url: string;
  language_code?: string;
}

export async function inspectUrl(
  client: SearchConsoleClient,
  args: InspectUrlArgs
) {
  if (!args.site_url || !args.inspection_url) {
    throw new Error('site_url and inspection_url are required');
  }
  const data = await client.inspectUrl(
    args.inspection_url,
    args.site_url,
    args.language_code
  );
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}
