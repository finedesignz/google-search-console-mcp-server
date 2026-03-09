#!/usr/bin/env node

/**
 * Google Search Console MCP Server
 *
 * A Model Context Protocol server providing complete access to
 * Google Search Console API for search analytics, sitemaps,
 * URL inspection, and site management.
 *
 * Supports two transport modes:
 * - stdio: Standard input/output for local Claude Code usage
 * - http: HTTP for remote access with header-based authentication
 *
 * No credentials stored in env - agent provides OAuth credentials
 * via HTTP headers and token refresh is handled automatically.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { createClient, getEnvCredentials } from './client/index.js';
import {
  listSites,
  getSite,
  addSite,
  deleteSite,
  querySearchAnalytics,
  listSitemaps,
  getSitemap,
  submitSitemap,
  deleteSitemap,
  inspectUrl,
} from './tools/index.js';

dotenv.config();

const SERVER_NAME = 'google-search-console-mcp-server';
const SERVER_VERSION = '0.1.0';

const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: {} } }
);

/**
 * List all available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ========== Sites Management ==========
      {
        name: 'list_sites',
        description:
          'List all sites (properties) you have access to in Google Search Console. Returns site URL, permission level, and verification status.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_site',
        description:
          'Get details for a specific site (property) in Google Search Console. Returns permission level and site URL.',
        inputSchema: {
          type: 'object',
          properties: {
            site_url: {
              type: 'string',
              description:
                'The site URL exactly as it appears in Search Console (e.g., "https://example.com/" or "sc-domain:example.com")',
            },
          },
          required: ['site_url'],
        },
      },
      {
        name: 'add_site',
        description:
          'Add a new site (property) to Google Search Console. The site will need to be verified separately.',
        inputSchema: {
          type: 'object',
          properties: {
            site_url: {
              type: 'string',
              description:
                'The URL of the site to add (e.g., "https://example.com/" or "sc-domain:example.com")',
            },
          },
          required: ['site_url'],
        },
      },
      {
        name: 'delete_site',
        description:
          'Remove a site (property) from Google Search Console. This removes your access but does not affect the actual website.',
        inputSchema: {
          type: 'object',
          properties: {
            site_url: {
              type: 'string',
              description: 'The URL of the site to remove',
            },
          },
          required: ['site_url'],
        },
      },

      // ========== Search Analytics ==========
      {
        name: 'query_search_analytics',
        description:
          'Query Google Search Console search analytics data. Returns clicks, impressions, CTR, and position data. ' +
          'Supports filtering by dimensions (query, page, country, device, searchAppearance, date) and applying filters. ' +
          'Maximum date range is 16 months. Data is available with a 2-3 day delay.',
        inputSchema: {
          type: 'object',
          properties: {
            site_url: {
              type: 'string',
              description:
                'The site URL exactly as it appears in Search Console',
            },
            start_date: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format',
            },
            end_date: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format',
            },
            dimensions: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'query',
                  'page',
                  'country',
                  'device',
                  'searchAppearance',
                  'date',
                ],
              },
              description:
                'Dimensions to group results by. Common: ["query", "page"], ["date", "query"]',
            },
            search_type: {
              type: 'string',
              enum: ['web', 'image', 'video', 'news', 'discover', 'googleNews'],
              description: 'Search type filter (default: "web")',
            },
            data_state: {
              type: 'string',
              enum: ['final', 'all'],
              description:
                '"final" for finalized data only, "all" includes fresh/incomplete data (default: "final")',
            },
            aggregation_type: {
              type: 'string',
              enum: ['auto', 'byPage', 'byProperty'],
              description:
                'How to aggregate results. "byPage" shows per-URL data, "byProperty" aggregates across property',
            },
            row_limit: {
              type: 'number',
              description:
                'Maximum rows to return (1-25000, default: 1000)',
            },
            start_row: {
              type: 'number',
              description: 'Zero-based row offset for pagination',
            },
            dimension_filter_groups: {
              type: 'array',
              description: 'Filter groups to apply to the query',
              items: {
                type: 'object',
                properties: {
                  group_type: {
                    type: 'string',
                    enum: ['and'],
                    description: 'Filter group type (default: "and")',
                  },
                  filters: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        dimension: {
                          type: 'string',
                          enum: [
                            'query',
                            'page',
                            'country',
                            'device',
                            'searchAppearance',
                          ],
                          description: 'Dimension to filter on',
                        },
                        operator: {
                          type: 'string',
                          enum: [
                            'equals',
                            'notEquals',
                            'contains',
                            'notContains',
                            'includingRegex',
                            'excludingRegex',
                          ],
                          description: 'Filter operator',
                        },
                        expression: {
                          type: 'string',
                          description: 'Filter value or regex pattern',
                        },
                      },
                      required: ['dimension', 'operator', 'expression'],
                    },
                  },
                },
                required: ['filters'],
              },
            },
          },
          required: ['site_url', 'start_date', 'end_date'],
        },
      },

      // ========== Sitemaps ==========
      {
        name: 'list_sitemaps',
        description:
          'List all sitemaps submitted for a site in Google Search Console. Returns sitemap URL, type, last submitted/downloaded dates, and error counts.',
        inputSchema: {
          type: 'object',
          properties: {
            site_url: {
              type: 'string',
              description:
                'The site URL exactly as it appears in Search Console',
            },
          },
          required: ['site_url'],
        },
      },
      {
        name: 'get_sitemap',
        description:
          'Get details for a specific sitemap including contents, errors, and warnings.',
        inputSchema: {
          type: 'object',
          properties: {
            site_url: {
              type: 'string',
              description:
                'The site URL exactly as it appears in Search Console',
            },
            feedpath: {
              type: 'string',
              description:
                'The URL of the sitemap (e.g., "https://example.com/sitemap.xml")',
            },
          },
          required: ['site_url', 'feedpath'],
        },
      },
      {
        name: 'submit_sitemap',
        description:
          'Submit a new sitemap to Google Search Console for indexing.',
        inputSchema: {
          type: 'object',
          properties: {
            site_url: {
              type: 'string',
              description:
                'The site URL exactly as it appears in Search Console',
            },
            feedpath: {
              type: 'string',
              description:
                'The URL of the sitemap to submit (e.g., "https://example.com/sitemap.xml")',
            },
          },
          required: ['site_url', 'feedpath'],
        },
      },
      {
        name: 'delete_sitemap',
        description:
          'Remove a submitted sitemap from Google Search Console. Does not delete the actual sitemap file.',
        inputSchema: {
          type: 'object',
          properties: {
            site_url: {
              type: 'string',
              description:
                'The site URL exactly as it appears in Search Console',
            },
            feedpath: {
              type: 'string',
              description: 'The URL of the sitemap to remove',
            },
          },
          required: ['site_url', 'feedpath'],
        },
      },

      // ========== URL Inspection ==========
      {
        name: 'inspect_url',
        description:
          'Inspect a URL using the Google Search Console URL Inspection API. ' +
          'Returns indexing status, crawl info, AMP/mobile usability, rich results status, ' +
          'and other details about how Google sees the URL.',
        inputSchema: {
          type: 'object',
          properties: {
            site_url: {
              type: 'string',
              description:
                'The site URL exactly as it appears in Search Console',
            },
            inspection_url: {
              type: 'string',
              description:
                'The fully-qualified URL to inspect (must be under the site_url property)',
            },
            language_code: {
              type: 'string',
              description:
                'Language code for localized results (default: "en")',
            },
          },
          required: ['site_url', 'inspection_url'],
        },
      },
    ],
  };
});

/**
 * Handle tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: _args } = request.params;

  try {
    // Create client from env credentials (stdio mode)
    const credentials = getEnvCredentials();
    const client = createClient(credentials);

    switch (name) {
      // Sites
      case 'list_sites':
        return await listSites(client);
      case 'get_site':
        return await getSite(client, _args as any);
      case 'add_site':
        return await addSite(client, _args as any);
      case 'delete_site':
        return await deleteSite(client, _args as any);

      // Search Analytics
      case 'query_search_analytics':
        return await querySearchAnalytics(client, _args as any);

      // Sitemaps
      case 'list_sitemaps':
        return await listSitemaps(client, _args as any);
      case 'get_sitemap':
        return await getSitemap(client, _args as any);
      case 'submit_sitemap':
        return await submitSitemap(client, _args as any);
      case 'delete_sitemap':
        return await deleteSitemap(client, _args as any);

      // URL Inspection
      case 'inspect_url':
        return await inspectUrl(client, _args as any);

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = process.env.MCP_TRANSPORT || 'stdio';
  const httpPort = parseInt(process.env.HTTP_PORT || '9100', 10);

  try {
    if (transport === 'http') {
      const { createHttpServer } = await import('./http-server.js');
      const httpServer = createHttpServer(httpPort);
      await httpServer.start();
    } else {
      // stdio mode - requires env credentials
      const credentials = getEnvCredentials();
      const client = createClient(credentials);
      console.error('Testing Google Search Console API connection...');
      await client.testConnection();
      console.error('Connection test successful');

      const stdioTransport = new StdioServerTransport();
      await server.connect(stdioTransport);
      console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
