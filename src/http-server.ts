/**
 * HTTP Server for Google Search Console MCP Tools
 *
 * Provides HTTP REST API access with header-based authentication.
 * Agent provides OAuth credentials via headers - no credentials stored in env.
 * Token refresh is handled automatically by the googleapis library.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { createClient, SearchConsoleClient } from './client/index.js';
import { GSCCredentials } from './auth/index.js';
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

// Extend Express Request to carry the client
declare global {
  namespace Express {
    interface Request {
      gscClient?: SearchConsoleClient;
    }
  }
}

/**
 * Extract GSC credentials from request headers
 */
function extractCredentials(req: Request): GSCCredentials | null {
  const clientId = req.headers['gsc-client-id'] as string;
  const clientSecret = req.headers['gsc-client-secret'] as string;
  const refreshToken = req.headers['gsc-refresh-token'] as string;

  if (clientId && clientSecret && refreshToken) {
    return {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    };
  }

  // Fallback to env
  const envClientId = process.env.GSC_CLIENT_ID;
  const envClientSecret = process.env.GSC_CLIENT_SECRET;
  const envRefreshToken = process.env.GSC_REFRESH_TOKEN;

  if (envClientId && envClientSecret && envRefreshToken) {
    return {
      client_id: envClientId,
      client_secret: envClientSecret,
      refresh_token: envRefreshToken,
    };
  }

  return null;
}

/**
 * Middleware: validate API key if configured
 */
function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) {
    next();
    return;
  }

  const authHeader = req.headers['authorization'] || '';
  if (authHeader === `Bearer ${apiKey}`) {
    next();
    return;
  }

  res.status(401).json({
    error: { code: 'unauthorized', message: 'Invalid or missing API key' },
  });
}

/**
 * Middleware: create GSC client from request credentials
 */
function credentialsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip for health/info endpoints
  if (req.path === '/health' || req.path === '/mcp' || (req.path === '/tools' && req.method === 'GET')) {
    next();
    return;
  }

  const credentials = extractCredentials(req);
  if (!credentials) {
    res.status(401).json({
      error: {
        code: 'missing_credentials',
        message:
          'Google OAuth credentials required. Provide GSC-Client-ID, GSC-Client-Secret, and GSC-Refresh-Token headers.',
      },
    });
    return;
  }

  req.gscClient = createClient(credentials);
  next();
}

/**
 * Error handling middleware
 */
function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('[HTTP] Error:', error.message);

  if (error instanceof McpError) {
    const statusCode = error.code === ErrorCode.InvalidParams ? 400 : 500;
    res.status(statusCode).json({
      error: { code: error.code, message: error.message },
    });
  } else {
    res.status(500).json({
      error: { code: 'internal_error', message: error.message || 'Internal server error' },
    });
  }
}

/**
 * Create and configure Express server
 */
export function createHttpServer(port = 9100): {
  app: express.Application;
  start: () => Promise<void>;
} {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(apiKeyMiddleware);
  app.use(credentialsMiddleware);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      server: 'google-search-console-mcp-server',
      version: '0.1.0',
      transport: 'http',
    });
  });

  // MCP info endpoint
  app.get('/mcp', (_req, res) => {
    res.json({
      name: 'google-search-console-mcp-server',
      version: '0.1.0',
      description: 'Google Search Console API MCP Server',
      protocol: 'mcp',
      tools: 10,
    });
  });

  // List available tools
  app.get('/tools', (_req, res) => {
    res.json({
      tools: [
        'list_sites',
        'get_site',
        'add_site',
        'delete_site',
        'query_search_analytics',
        'list_sitemaps',
        'get_sitemap',
        'submit_sitemap',
        'delete_sitemap',
        'inspect_url',
      ],
      count: 10,
    });
  });

  // Tool execution endpoint
  app.post('/tools/:toolName', async (req, res, next) => {
    try {
      const { toolName } = req.params;
      const args = req.body;
      const client = req.gscClient!;

      let result;

      switch (toolName) {
        // Sites
        case 'list_sites':
          result = await listSites(client);
          break;
        case 'get_site':
          result = await getSite(client, args);
          break;
        case 'add_site':
          result = await addSite(client, args);
          break;
        case 'delete_site':
          result = await deleteSite(client, args);
          break;

        // Search Analytics
        case 'query_search_analytics':
          result = await querySearchAnalytics(client, args);
          break;

        // Sitemaps
        case 'list_sitemaps':
          result = await listSitemaps(client, args);
          break;
        case 'get_sitemap':
          result = await getSitemap(client, args);
          break;
        case 'submit_sitemap':
          result = await submitSitemap(client, args);
          break;
        case 'delete_sitemap':
          result = await deleteSitemap(client, args);
          break;

        // URL Inspection
        case 'inspect_url':
          result = await inspectUrl(client, args);
          break;

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${toolName}`
          );
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use(errorHandler);

  return {
    app,
    async start() {
      return new Promise<void>((resolve) => {
        app.listen(port, '0.0.0.0', () => {
          console.log(`Google Search Console MCP Server (HTTP Mode)`);
          console.log(`  Port: ${port}`);
          console.log(`  Health: http://localhost:${port}/health`);
          console.log(`  Tools: http://localhost:${port}/tools`);
          console.log(`\nCredentials: Provide via headers per request`);
          console.log(`  GSC-Client-ID, GSC-Client-Secret, GSC-Refresh-Token`);
          resolve();
        });
      });
    },
  };
}
